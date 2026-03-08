import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"
import { createPimlicoClient } from "permissionless/clients/pimlico"
import { createSmartAccountClient } from "permissionless"
import { entryPoint07Address } from "viem/account-abstraction"
import type { MetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export async function deploySmartAccount(
  smartAccount: MetaMaskSmartAccount<any>
): Promise<string> {
  if (!PIMLICO_API_KEY) {
    throw new Error("Pimlico API key not configured")
  }

  const pimlicoUrl = `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${PIMLICO_API_KEY}`

  const pimlicoClient = createPimlicoClient({
    transport: http(pimlicoUrl),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  })

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount as any,
    chain: baseSepolia,
    bundlerTransport: http(pimlicoUrl),
    paymaster: pimlicoClient,
    userOperation: {
      estimateFeesPerGas: async () => {
        const { fast } = await pimlicoClient.getUserOperationGasPrice()
        return fast
      },
    },
  })

  const txHash = await smartAccountClient.sendTransaction({
    account: smartAccount as any,
    to: smartAccount.address,
    value: BigInt(0),
    data: "0x",
  })

  return txHash
}
