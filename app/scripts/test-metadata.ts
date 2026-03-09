import "dotenv/config"
import { createPublicClient, http, getAddress } from "viem"

async function main() {
  const rpc = process.env.TENDERLY_BASE_SEPOLIA_RPC || "https://sepolia.base.org"
  console.log("Using RPC:", rpc.substring(0, 50) + "...")

  const client = createPublicClient({ transport: http(rpc) })
  const address = getAddress("0xe4ab69c077896252fafbd49efd26b5d171a32410")
  console.log("Checksummed address:", address)

  const name = await client.readContract({
    address,
    abi: [{"inputs":[],"name":"name","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"}],
    functionName: "name",
  })

  console.log("name():", name)

  const symbol = await client.readContract({
    address,
    abi: [{"inputs":[],"name":"symbol","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"}],
    functionName: "symbol",
  })

  console.log("symbol():", symbol)
}

main().catch(console.error)
