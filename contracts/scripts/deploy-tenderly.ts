import { ethers, network } from "hardhat";

/**
 * Deploy Autonomify contracts to Tenderly Virtual TestNet
 *
 * This deployment targets a Virtual TestNet forked from Base mainnet,
 * allowing us to test against real DeFi protocol state (Uniswap, Aave, etc.)
 *
 * The Virtual TestNet provides:
 * - Real mainnet state sync
 * - Unlimited faucet
 * - Transaction simulation & debugging
 * - Public explorer for hackathon demo
 */

// MetaMask DelegationManager - deployed on Base mainnet (forked state)
const DELEGATION_MANAGER = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";

async function main() {
  console.log("============================================");
  console.log("  AUTONOMIFY - Tenderly Virtual TestNet    ");
  console.log("============================================\n");

  console.log(`Network: ${network.name}`);
  console.log(`Chain ID: ${network.config.chainId}`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Deploy HonkVerifier (ZK proof verification)
  console.log("\n1. Deploying HonkVerifier (ZK Proof Verification)...");
  const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
  const verifier = await HonkVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("   HonkVerifier:", verifierAddress);

  // Deploy AutonomifyExecutor
  console.log("\n2. Deploying AutonomifyExecutor...");
  const AutonomifyExecutor = await ethers.getContractFactory("AutonomifyExecutor");
  const executor = await AutonomifyExecutor.deploy(verifierAddress, DELEGATION_MANAGER);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  console.log("   AutonomifyExecutor:", executorAddress);

  // Note: On Virtual TestNet, we don't need to set CRE Forwarder
  // since we're testing direct executeWithProof calls
  // The CRE integration uses the Base Sepolia forwarder

  console.log("\n============================================");
  console.log("           DEPLOYMENT COMPLETE              ");
  console.log("============================================");
  console.log("\nContract Addresses:");
  console.log("  HonkVerifier:", verifierAddress);
  console.log("  AutonomifyExecutor:", executorAddress);
  console.log("  DelegationManager:", DELEGATION_MANAGER, "(forked from mainnet)");

  console.log("\nTenderly Explorer:");
  console.log("  View transactions and debug at your Virtual TestNet dashboard");

  console.log("\nNext Steps:");
  console.log("  1. Test executeWithProof with ZK proof from enclave");
  console.log("  2. Test AI agent actions against forked DeFi protocols");
  console.log("  3. Use tenderly_simulateTransaction for risk assessment");

  // Return addresses for use in other scripts
  return {
    verifier: verifierAddress,
    executor: executorAddress,
    delegationManager: DELEGATION_MANAGER,
  };
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
