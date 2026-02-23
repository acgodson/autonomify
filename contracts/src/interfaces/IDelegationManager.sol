// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IDelegationManager {
    function redeemDelegations(
        bytes[] calldata _permissionContexts,
        bytes32[] calldata _modes,
        bytes[] calldata _executionCallDatas
    ) external;
}
