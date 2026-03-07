// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {HonkVerifier} from "../../circuits/noir/target/autonomify.sol";
import {IDelegationManager} from "./interfaces/IDelegationManager.sol";
import {IReceiver} from "./interfaces/IReceiver.sol";
import {Execution, ExecutionLib} from "./lib/ExecutionLib.sol";

contract AutonomifyExecutor is IReceiver {
    using ExecutionLib for Execution[];

    HonkVerifier public immutable zkVerifier;
    address public immutable delegationManager;
    address public forwarder;
    address public owner;

    mapping(bytes32 => bool) public usedNullifiers;

    event ExecutedWithProof(bytes32 indexed userAddressHash, bytes32 indexed nullifier, bool success);
    event ExecutedSimple(bytes32 indexed nullifier, address indexed target, bool success);
    event ForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);

    error InvalidProof();
    error NullifierAlreadyUsed();
    error PolicyNotSatisfied();
    error InvalidPublicInputs();
    error UnauthorizedForwarder();
    error OnlyOwner();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier onlyForwarder() {
        if (forwarder != address(0) && msg.sender != forwarder) revert UnauthorizedForwarder();
        _;
    }

    constructor(address _zkVerifier, address _delegationManager) {
        zkVerifier = HonkVerifier(_zkVerifier);
        delegationManager = _delegationManager;
        owner = msg.sender;
    }

    function setForwarder(address _forwarder) external onlyOwner {
        emit ForwarderUpdated(forwarder, _forwarder);
        forwarder = _forwarder;
    }

    function onReport(bytes calldata, bytes calldata report) external override onlyForwarder {
        (
            bytes memory proof,
            bytes32[] memory publicInputs,
            bytes memory permissionsContext,
            Execution[] memory executions
        ) = abi.decode(report, (bytes, bytes32[], bytes, Execution[]));

        _executeWithProofInternal(proof, publicInputs, permissionsContext, executions);
    }

    function executeWithProof(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs,
        bytes calldata _permissionContext,
        Execution[] calldata _executions
    ) external {
        bytes memory proof = _proof;
        bytes32[] memory publicInputs = _publicInputs;
        bytes memory permissionsContext = _permissionContext;
        Execution[] memory executions = new Execution[](_executions.length);
        for (uint256 i = 0; i < _executions.length; i++) {
            executions[i] = _executions[i];
        }

        _executeWithProofInternal(proof, publicInputs, permissionsContext, executions);
    }

    function _executeWithProofInternal(
        bytes memory _proof,
        bytes32[] memory _publicInputs,
        bytes memory _permissionContext,
        Execution[] memory _executions
    ) internal {
        if (_publicInputs.length != 3) revert InvalidPublicInputs();

        bytes32 policySatisfied = _publicInputs[0];
        bytes32 nullifier = _publicInputs[1];
        bytes32 userAddressHash = _publicInputs[2];

        if (!zkVerifier.verify(_proof, _publicInputs)) revert InvalidProof();
        if (policySatisfied != bytes32(uint256(1))) revert PolicyNotSatisfied();
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();

        usedNullifiers[nullifier] = true;

        _redeemDelegationMemory(_permissionContext, _executions);

        emit ExecutedWithProof(userAddressHash, nullifier, true);
    }

    function executeWithDelegation(
        bytes32 _nullifier,
        bytes calldata _permissionContext,
        Execution[] calldata _executions
    ) external {
        if (usedNullifiers[_nullifier]) revert NullifierAlreadyUsed();
        usedNullifiers[_nullifier] = true;

        _redeemDelegation(_permissionContext, _executions);

        emit ExecutedSimple(_nullifier, _executions.length > 0 ? _executions[0].target : address(0), true);
    }

    function _redeemDelegation(
        bytes calldata _permissionContext,
        Execution[] calldata _executions
    ) internal {
        bytes[] memory permissionContexts = new bytes[](1);
        permissionContexts[0] = _permissionContext;

        bytes32[] memory modes = new bytes32[](1);
        modes[0] = _executions.getMode();

        bytes[] memory executionCallDatas = new bytes[](1);
        executionCallDatas[0] = _executions.encode();

        IDelegationManager(delegationManager).redeemDelegations(
            permissionContexts,
            modes,
            executionCallDatas
        );
    }

    function _redeemDelegationMemory(
        bytes memory _permissionContext,
        Execution[] memory _executions
    ) internal {
        bytes[] memory permissionContexts = new bytes[](1);
        permissionContexts[0] = _permissionContext;

        bytes32[] memory modes = new bytes32[](1);
        modes[0] = _getMode(_executions);

        bytes[] memory executionCallDatas = new bytes[](1);
        executionCallDatas[0] = _encodeExecutions(_executions);

        IDelegationManager(delegationManager).redeemDelegations(
            permissionContexts,
            modes,
            executionCallDatas
        );
    }


    function _encodeExecutions(Execution[] memory executions) internal pure returns (bytes memory) {
        if (executions.length == 1) {
            return abi.encodePacked(
                executions[0].target,
                executions[0].value,
                executions[0].callData
            );
        }
        return abi.encode(executions);
    }

    function _getMode(Execution[] memory executions) internal pure returns (bytes32) {
        bytes1 callType = executions.length == 1 ? bytes1(0x00) : bytes1(0x01);
        return bytes32(abi.encodePacked(callType, bytes31(0)));
    }

    function isNullifierUsed(bytes32 _nullifier) external view returns (bool) {
        return usedNullifiers[_nullifier];
    }

    receive() external payable {}
}
