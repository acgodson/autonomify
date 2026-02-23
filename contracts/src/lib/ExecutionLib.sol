// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

struct Execution {
    address target;
    uint256 value;
    bytes callData;
}

// ERC-7579 mode codes
bytes1 constant CALLTYPE_SINGLE = 0x00;
bytes1 constant CALLTYPE_BATCH = 0x01;
bytes32 constant MODE_DEFAULT = bytes32(abi.encodePacked(CALLTYPE_SINGLE, bytes31(0)));
bytes32 constant MODE_BATCH = bytes32(abi.encodePacked(CALLTYPE_BATCH, bytes31(0)));

library ExecutionLib {
    function encode(Execution[] calldata executions) internal pure returns (bytes memory) {
        if (executions.length == 1) {
            // Use abi.encodePacked to match SDK's encodeSingleExecution
            return abi.encodePacked(
                executions[0].target,
                executions[0].value,
                executions[0].callData
            );
        }
        // Batch uses abi.encode per SDK's encodeBatchExecution
        return abi.encode(executions);
    }

    function getMode(Execution[] calldata executions) internal pure returns (bytes32) {
        return executions.length == 1 ? MODE_DEFAULT : MODE_BATCH;
    }
}
