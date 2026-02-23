// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutonomifyExecutor - ZK-verified delegated execution for AI agents
import {HonkVerifier} from "../../circuits/noir/target/autonomify.sol";
import {IDelegationManager} from "./interfaces/IDelegationManager.sol";
import {Execution, ExecutionLib} from "./lib/ExecutionLib.sol";

contract AutonomifyExecutor {
    using ExecutionLib for Execution[];

    HonkVerifier public immutable zkVerifier;
    address public immutable delegationManager;
    mapping(bytes32 => bool) public usedNullifiers;

    event ExecutedWithProof(bytes32 indexed userAddressHash, bytes32 indexed nullifier, bool success);
    event ExecutedSimple(bytes32 indexed nullifier, address indexed target, bool success);

    error InvalidProof();
    error NullifierAlreadyUsed();
    error PolicyNotSatisfied();
    error InvalidPublicInputs();

    constructor(address _zkVerifier, address _delegationManager) {
        zkVerifier = HonkVerifier(_zkVerifier);
        delegationManager = _delegationManager;
    }

    /// @notice Main execution with ZK proof verification
    function executeWithProof(
        bytes calldata _proof,
        bytes32[] calldata _publicInputs,
        bytes calldata _permissionContext,
        Execution[] calldata _executions
    ) external {
        // publicInputs: [policy_satisfied, nullifier, user_address_hash]
        if (_publicInputs.length != 3) revert InvalidPublicInputs();

        bytes32 policySatisfied = _publicInputs[0];
        bytes32 nullifier = _publicInputs[1];
        bytes32 userAddressHash = _publicInputs[2];

        if (!zkVerifier.verify(_proof, _publicInputs)) revert InvalidProof();
        if (policySatisfied != bytes32(uint256(1))) revert PolicyNotSatisfied();
        if (usedNullifiers[nullifier]) revert NullifierAlreadyUsed();

        usedNullifiers[nullifier] = true;

        _redeemDelegation(_permissionContext, _executions);

        emit ExecutedWithProof(userAddressHash, nullifier, true);
    }

    /// @notice Test execution without ZK (for delegation flow testing only)
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

    function isNullifierUsed(bytes32 _nullifier) external view returns (bool) {
        return usedNullifiers[_nullifier];
    }

    receive() external payable {}
}
