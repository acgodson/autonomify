import { ethers } from "hardhat"

async function main() {
  // Default: the wallet created by our test script
  const DEFAULT_ADDRESS = "0xB142e2ccC7Db7D9c6e41844394C04c3c4c89E7A1"
  const targetAddress = process.env.FUND_ADDRESS || DEFAULT_ADDRESS

  // Amount to send (0.005 BNB should be enough for many test txs)
  const amount = ethers.parseEther("0.005")

  const [deployer] = await ethers.getSigners()

  console.log("💰 Funding script")
  console.log(`   From: ${deployer.address}`)
  console.log(`   To: ${targetAddress}`)
  console.log(`   Amount: ${ethers.formatEther(amount)} BNB`)

  // Check deployer balance
  const deployerBalance = await ethers.provider.getBalance(deployer.address)
  console.log(`   Deployer balance: ${ethers.formatEther(deployerBalance)} BNB`)

  if (deployerBalance < amount) {
    console.error("\n❌ Deployer doesn't have enough BNB")
    process.exit(1)
  }

  // Check target balance before
  const balanceBefore = await ethers.provider.getBalance(targetAddress)
  console.log(`   Target balance before: ${ethers.formatEther(balanceBefore)} BNB`)

  // Send transaction
  console.log("\n📤 Sending...")
  const tx = await deployer.sendTransaction({
    to: targetAddress,
    value: amount,
  })

  console.log(`   Tx hash: ${tx.hash}`)
  console.log("   Waiting for confirmation...")

  await tx.wait()

  // Check target balance after
  const balanceAfter = await ethers.provider.getBalance(targetAddress)
  console.log(`\n✅ Done!`)
  console.log(`   Target balance after: ${ethers.formatEther(balanceAfter)} BNB`)
  console.log(`   Explorer: https://testnet.bscscan.com/tx/${tx.hash}`)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
