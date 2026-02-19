import { ethers } from "hardhat";

async function main() {
  console.log("Deploying AutonomifyExecutor...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB");

  const AutonomifyExecutor = await ethers.getContractFactory("AutonomifyExecutor");
  const executor = await AutonomifyExecutor.deploy();

  await executor.waitForDeployment();

  const address = await executor.getAddress();
  console.log("AutonomifyExecutor deployed to:", address);
  console.log("");
  console.log("Verify with:");
  console.log(`npx hardhat verify --network bscTestnet ${address}`);
  console.log("");
  console.log("Add to .env:");
  console.log(`AUTONOMIFY_EXECUTOR_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
