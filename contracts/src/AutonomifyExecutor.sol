// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title AutonomifyExecutor
/// @notice Executes agent transactions with replay protection and audit trail
/// @dev All agent wallet transactions must route through this contract
///      Future-ready for ZK policy verification
contract AutonomifyExecutor {

    /// @notice Tracks used nullifiers to prevent replay attacks
    mapping(bytes32 => bool) public usedNullifiers;

    /// @notice Execution nonce per agent for deterministic nullifier generation
    mapping(bytes32 => uint256) public agentNonce;

    /// @notice Emitted when a transaction is executed
    /// @param agentId Off-chain agent identifier
    /// @param target Contract that was called
    /// @param selector Function selector that was called
    /// @param nullifier Unique identifier for this execution
    /// @param success Whether the call succeeded
    /// @param returnData Return data from the call (truncated if large)
    event Executed(
        bytes32 indexed agentId,
        address indexed target,
        bytes4 indexed selector,
        bytes32 nullifier,
        bool success,
        bytes returnData
    );

    /// @notice Execute a transaction on behalf of an agent
    /// @param agentId Off-chain agent identifier (e.g., keccak256 of telegramBotId)
    /// @param target Contract address to call
    /// @param data Encoded function call (selector + arguments)
    /// @return success Whether the call succeeded
    /// @return result Return data from the call
    function execute(
        bytes32 agentId,
        address target,
        bytes calldata data
    ) external payable returns (bool success, bytes memory result) {
        require(target != address(0), "Invalid target");
        require(data.length >= 4, "Invalid calldata");

        uint256 nonce = agentNonce[agentId]++;
        bytes32 nullifier = keccak256(abi.encodePacked(agentId, nonce));

        require(!usedNullifiers[nullifier], "Replay detected");
        usedNullifiers[nullifier] = true;

        (success, result) = target.call{value: msg.value}(data);

        // Emit event with truncated return data (max 256 bytes for gas efficiency)
        bytes memory truncatedResult = result.length > 256
            ? _truncateBytes(result, 256)
            : result;

        emit Executed(
            agentId,
            target,
            bytes4(data[:4]),
            nullifier,
            success,
            truncatedResult
        );
    }

    /// @notice Execute with a custom nullifier (for ZK proof integration)
    /// @param agentId Off-chain agent identifier
    /// @param target Contract address to call
    /// @param data Encoded function call
    /// @param customNullifier Custom nullifier (e.g., from ZK proof)
    /// @return success Whether the call succeeded
    /// @return result Return data from the call
    function executeWithNullifier(
        bytes32 agentId,
        address target,
        bytes calldata data,
        bytes32 customNullifier
    ) external payable returns (bool success, bytes memory result) {
        require(target != address(0), "Invalid target");
        require(data.length >= 4, "Invalid calldata");
        require(!usedNullifiers[customNullifier], "Nullifier already used");

        usedNullifiers[customNullifier] = true;

        (success, result) = target.call{value: msg.value}(data);

        bytes memory truncatedResult = result.length > 256
            ? _truncateBytes(result, 256)
            : result;

        emit Executed(
            agentId,
            target,
            bytes4(data[:4]),
            customNullifier,
            success,
            truncatedResult
        );
    }

    /// @notice Get current nonce for an agent
    /// @param agentId The agent identifier
    /// @return Current nonce value
    function getNonce(bytes32 agentId) external view returns (uint256) {
        return agentNonce[agentId];
    }

    /// @notice Check if a nullifier has been used
    /// @param nullifier The nullifier to check
    /// @return Whether the nullifier has been used
    function isNullifierUsed(bytes32 nullifier) external view returns (bool) {
        return usedNullifiers[nullifier];
    }

    /// @notice Compute the next nullifier for an agent (for off-chain verification)
    /// @param agentId The agent identifier
    /// @return The nullifier that will be used for the next execution
    function computeNextNullifier(bytes32 agentId) external view returns (bytes32) {
        return keccak256(abi.encodePacked(agentId, agentNonce[agentId]));
    }

    /// @dev Truncate bytes to a maximum length
    function _truncateBytes(bytes memory data, uint256 maxLen) internal pure returns (bytes memory) {
        bytes memory truncated = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            truncated[i] = data[i];
        }
        return truncated;
    }

    /// @notice Allow contract to receive BNB for payable function calls
    receive() external payable {}
}
