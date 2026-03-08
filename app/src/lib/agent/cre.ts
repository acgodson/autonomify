import { createPublicClient, http } from "viem"
import { baseSepolia } from "viem/chains"

const METAMASK_DELEGATOR = "0x63c0c19a282a1b52b07dd5a65b58948a07dae32b"
const CRE_TRIGGER_URL = process.env.CRE_TRIGGER_URL || "http://localhost:8080/trigger"
const ENCLAVE_URL = process.env.ENCLAVE_URL || "http://3.71.199.191:8001"

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
})

export async function hasSmartAccountEnabled(address: string): Promise<boolean> {
  const code = await publicClient.getCode({ address: address as `0x${string}` })

  if (!code || code === "0x") return false

  if (code.length === 48 && code.startsWith("0xef0100")) {
    const delegator = "0x" + code.slice(8)
    return delegator.toLowerCase() === METAMASK_DELEGATOR.toLowerCase()
  }

  return false
}

export async function contractExists(address: string): Promise<boolean> {
  const code = await publicClient.getCode({ address: address as `0x${string}` })
  return !!code && code !== "0x"
}

/**
 * Simplified CRE trigger params - accepts pre-encoded calldata
 */
export interface CRETriggerParams {
  userAddress: string
  agentId: string  // bytes32 format (0x + 64 hex chars)
  target: string
  calldata: string  
  value?: string
  permissionsContext: string
  simulateOnly?: boolean
}

export interface CRESimulationResult {
  success: boolean
  mode: "simulation"
  gasEstimate: number
  returnData?: string
  nullifier?: string
  policySatisfied?: string
  error?: {
    type: "infrastructure" | "target"
    errorSelector?: string
    errorData?: string
    decoded?: string
    recommendation?: string
  }
}

export interface CREExecutionResult {
  success: boolean
  mode: "execution"
  txStatus?: number
  txStatusName?: string
  txHash?: string
  nullifier?: string
  gasAnalysis?: {
    total: number
    zkVerifier?: number
  }
  error?: {
    type: string
    contract?: string
    function?: string
    errorName?: string
    recommendation?: string
  }
}

export type CREResult = CRESimulationResult | CREExecutionResult

/**
 * Trigger CRE workflow with pre-encoded calldata
 */
export async function triggerCRE(params: CRETriggerParams): Promise<CREResult> {
  const payload = {
    userAddress: params.userAddress,
    agentId: params.agentId,
    execution: {
      target: params.target,
      value: params.value || "0",
      calldata: params.calldata,
    },
    permissionsContext: params.permissionsContext,
    simulateOnly: params.simulateOnly ?? false,
  }

  const response = await fetch(CRE_TRIGGER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    throw new Error(`CRE trigger failed: ${response.statusText}`)
  }

  return response.json()
}

export interface EnclavePolicyConfig {
  maxAmount: {
    enabled: boolean
    limit: number
  }
  timeWindow: {
    enabled: boolean
    startHour: number
    endHour: number
  }
  whitelist: {
    enabled: boolean
    root?: string
    path?: string[]
    index?: number
  }
}

export async function syncPolicyToEnclave(
  userAddress: string,
  agentId: string,
  config: EnclavePolicyConfig
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(ENCLAVE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "STORE_POLICY_CONFIG",
      userAddress,
      agentId,
      policyConfig: config,
    }),
  })

  if (!response.ok) {
    return { success: false, error: response.statusText }
  }

  const data = await response.json()
  return { success: data.success, error: data.error }
}

export async function getDelegation(userAddress: string, chainId: number) {
  const { db } = await import("@/lib/db")
  const { delegations } = await import("@/lib/db/schema")
  const { eq, and } = await import("drizzle-orm")

  const [delegation] = await db
    .select()
    .from(delegations)
    .where(
      and(
        eq(delegations.userAddress, userAddress.toLowerCase()),
        eq(delegations.chainId, chainId)
      )
    )
    .limit(1)

  return delegation || null
}

export async function saveDelegation(params: {
  userAddress: string
  delegationHash: string
  signedDelegation: string
  executorAddress: string
  chainId: number
}) {
  const { db } = await import("@/lib/db")
  const { delegations } = await import("@/lib/db/schema")

  await db
    .insert(delegations)
    .values({
      userAddress: params.userAddress.toLowerCase(),
      delegationHash: params.delegationHash,
      signedDelegation: params.signedDelegation,
      executorAddress: params.executorAddress,
      chainId: params.chainId,
    })
    .onConflictDoUpdate({
      target: [delegations.userAddress, delegations.chainId],
      set: {
        delegationHash: params.delegationHash,
        signedDelegation: params.signedDelegation,
      },
    })
}
