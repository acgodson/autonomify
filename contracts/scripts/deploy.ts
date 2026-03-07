import { ethers, network } from "hardhat";

// MetaMask DelegationManager - same address on all supported chains
const DELEGATION_MANAGER = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3";
// CRE Forwarder on Base Sepolia
const CRE_FORWARDER = "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5";

async function main() {
  console.log(`Deploying to ${network.name}...`);

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Deploy HonkVerifier first
  console.log("\n1. Deploying HonkVerifier...");
  const HonkVerifier = await ethers.getContractFactory("HonkVerifier");
  const verifier = await HonkVerifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();
  console.log("HonkVerifier:", verifierAddress);

  // Deploy AutonomifyExecutor
  console.log("\n2. Deploying AutonomifyExecutor...");
  const AutonomifyExecutor = await ethers.getContractFactory("AutonomifyExecutor");
  const executor = await AutonomifyExecutor.deploy(verifierAddress, DELEGATION_MANAGER);
  await executor.waitForDeployment();
  const executorAddress = await executor.getAddress();
  console.log("AutonomifyExecutor:", executorAddress);

  // Set CRE Forwarder
  console.log("\n3. Setting CRE Forwarder...");
  const setForwarderTx = await executor.setForwarder(CRE_FORWARDER);
  await setForwarderTx.wait();
  console.log("CRE Forwarder set:", CRE_FORWARDER);

  console.log("\n--- Summary ---");
  console.log("HonkVerifier:", verifierAddress);
  console.log("AutonomifyExecutor:", executorAddress);
  console.log("DelegationManager:", DELEGATION_MANAGER);
  console.log("CRE Forwarder:", CRE_FORWARDER);
  console.log("\nUpdate these addresses in:");
  console.log("- app/src/app/test-delegation/page.tsx");
  console.log("- packages/autonomify-cre/executor/config.staging.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
