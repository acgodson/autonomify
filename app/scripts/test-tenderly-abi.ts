import "dotenv/config"

async function main() {
  const rpcUrl = process.env.TENDERLY_BASE_SEPOLIA_RPC
  if (!rpcUrl) {
    console.log("TENDERLY_BASE_SEPOLIA_RPC not configured")
    process.exit(1)
  }

  const address = "0xC5290058841028F1614F3A6F0F5816cAd0df5E27" // QuoterV2

  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tenderly_getContractAbi",
      params: [address],
      id: 1,
    }),
  })

  const data = await response.json()

  if (data.error) {
    console.log("Tenderly error:", data.error)
    process.exit(1)
  }

  // Find quoteExactInputSingle
  const quoteFn = data.result?.find((f: any) => f.name === "quoteExactInputSingle")

  console.log("Raw Tenderly response for quoteExactInputSingle:")
  console.log(JSON.stringify(quoteFn, null, 2))

  process.exit(0)
}
main()
