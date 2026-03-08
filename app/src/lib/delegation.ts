import { type Hex, type Address, getAddress } from "viem"
import { encodeDelegations } from "@metamask/smart-accounts-kit/utils"
import { ROOT_AUTHORITY, type MetaMaskSmartAccount } from "@metamask/smart-accounts-kit"

const EXECUTOR_ADDRESS = "0xD44def7f75Fea04B402688FF14572129D2BEeb05" as Address

export interface SignedDelegation {
  hash: string
  signed: string
  raw: {
    delegate: Address
    delegator: Address
    authority: Hex
    caveats: { enforcer: Address; terms: Hex; args: Hex }[]
    salt: Hex
    signature: Hex
  }
}

export async function signDelegation(
  smartAccount: MetaMaskSmartAccount<any>,
  executorAddress: string = EXECUTOR_ADDRESS
): Promise<SignedDelegation> {
  const salt = `0x${Math.floor(Math.random() * 1000000000000)
    .toString(16)
    .padStart(64, "0")}` as Hex

  const delegation = {
    delegate: getAddress(executorAddress) as Address,
    delegator: smartAccount.address,
    authority: ROOT_AUTHORITY as Hex,
    caveats: [] as { enforcer: Address; terms: Hex; args: Hex }[],
    salt,
    signature: "0x" as Hex,
  }

  const signature = await smartAccount.signDelegation({ delegation })
  const signedDelegation = { ...delegation, signature }
  const permissionsContext = encodeDelegations([signedDelegation])

  const hashBuffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(signedDelegation))
  )
  const hash = `0x${Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`

  return {
    hash,
    signed: permissionsContext,
    raw: signedDelegation,
  }
}

export function getExecutorAddress(): Address {
  return EXECUTOR_ADDRESS
}
