/**
 * Agent Store
 *
 * Persistence layer for agents using Drizzle ORM with Neon.
 * Supports Telegram (hosted), Discord (coming soon), and Self-Hosted agents.
 */

import { eq } from "drizzle-orm"
import { randomBytes } from "crypto"
import type { Abi } from "viem"
import { db, agents, agentContracts } from "@/lib/db"
import type { ContractContext, ChainConfig } from "@/lib/autonomify-core"
import type { AgentConfig, AgentWallet, AgentType } from "./types"
import { createAgentWallet } from "./privy"

export async function generateWallet(): Promise<AgentWallet> {
  const wallet = await createAgentWallet()

  return {
    address: wallet.address,
    privyWalletId: wallet.id,
  }
}

function generateAgentIdBytes(): string {
  // Generate a random bytes32 for self-hosted agents
  return "0x" + randomBytes(32).toString("hex")
}

function dbRowToAgentConfig(
  agent: typeof agents.$inferSelect,
  contracts: (typeof agentContracts.$inferSelect)[]
): AgentConfig {
  const config: AgentConfig = {
    id: agent.id,
    name: agent.name,
    type: (agent.type || "telegram") as AgentType,
    contracts: contracts.map((c) => ({
      address: c.address,
      chain: c.chainConfig as ChainConfig,
      abi: c.abi as Abi,
      metadata: c.metadata as Record<string, unknown>,
      functions: c.functions as ContractContext["functions"],
    })),
    createdAt: agent.createdAt.getTime(),
  }

  // Add hosted agent fields
  if (agent.type === "telegram" || agent.type === "discord" || !agent.type) {
    config.telegramBotToken = agent.telegramBotToken || undefined
    if (agent.walletAddress && agent.walletId) {
      config.wallet = {
        address: agent.walletAddress,
        privyWalletId: agent.walletId,
      }
    }
  }

  // Add self-hosted agent fields
  if (agent.type === "self_hosted") {
    config.agentIdBytes = agent.agentIdBytes || undefined
  }

  return config
}

export interface CreateAgentOptions {
  name: string
  type: AgentType
  telegramBotToken?: string
}

export async function createAgent(
  nameOrOptions: string | CreateAgentOptions,
  telegramBotToken?: string
): Promise<AgentConfig> {
  // Handle legacy signature: createAgent(name, token)
  const options: CreateAgentOptions =
    typeof nameOrOptions === "string"
      ? { name: nameOrOptions, type: "telegram", telegramBotToken }
      : nameOrOptions

  if (options.type === "self_hosted") {
    // Self-hosted: just generate agentIdBytes, no wallet
    const agentIdBytes = generateAgentIdBytes()

    const [agent] = await db
      .insert(agents)
      .values({
        name: options.name,
        type: "self_hosted",
        agentIdBytes,
      })
      .returning()

    return {
      id: agent.id,
      name: agent.name,
      type: "self_hosted",
      agentIdBytes,
      contracts: [],
      createdAt: agent.createdAt.getTime(),
    }
  }

  // Hosted agent (telegram/discord): create Privy wallet
  const wallet = await generateWallet()

  const [agent] = await db
    .insert(agents)
    .values({
      name: options.name,
      type: options.type,
      telegramBotToken: options.telegramBotToken,
      walletId: wallet.privyWalletId,
      walletAddress: wallet.address,
    })
    .returning()

  return {
    id: agent.id,
    name: agent.name,
    type: options.type,
    telegramBotToken: agent.telegramBotToken || undefined,
    wallet,
    contracts: [],
    createdAt: agent.createdAt.getTime(),
  }
}

export async function getAgent(id: string): Promise<AgentConfig | undefined> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  })

  if (!agent) return undefined

  const contracts = await db.query.agentContracts.findMany({
    where: eq(agentContracts.agentId, id),
  })

  return dbRowToAgentConfig(agent, contracts)
}

export async function listAgents(): Promise<AgentConfig[]> {
  const allAgents = await db.query.agents.findMany({
    orderBy: (agents, { desc }) => [desc(agents.createdAt)],
  })

  const result: AgentConfig[] = []

  for (const agent of allAgents) {
    const contracts = await db.query.agentContracts.findMany({
      where: eq(agentContracts.agentId, agent.id),
    })
    result.push(dbRowToAgentConfig(agent, contracts))
  }

  return result
}

export async function updateAgent(
  id: string,
  updates: Partial<Pick<AgentConfig, "name" | "telegramBotToken">>
): Promise<AgentConfig | undefined> {
  const existing = await getAgent(id)
  if (!existing) return undefined

  const updateData: Partial<typeof agents.$inferInsert> = {}
  if (updates.name) updateData.name = updates.name
  if (updates.telegramBotToken)
    updateData.telegramBotToken = updates.telegramBotToken
  updateData.updatedAt = new Date()

  await db.update(agents).set(updateData).where(eq(agents.id, id))

  return getAgent(id)
}

export async function deleteAgent(id: string): Promise<boolean> {
  const result = await db.delete(agents).where(eq(agents.id, id)).returning()

  return result.length > 0
}

export async function addContractToAgent(
  agentId: string,
  contract: ContractContext
): Promise<AgentConfig | undefined> {
  const agent = await getAgent(agentId)
  if (!agent) return undefined

  // Check if contract already exists
  const existing = await db.query.agentContracts.findFirst({
    where: (c, { and, eq: equals }) =>
      and(
        equals(c.agentId, agentId),
        equals(c.address, contract.address.toLowerCase())
      ),
  })

  if (existing) return agent

  await db.insert(agentContracts).values({
    agentId,
    address: contract.address.toLowerCase(),
    chainId: contract.chain.id,
    chainConfig: contract.chain,
    abi: contract.abi,
    metadata: contract.metadata,
    functions: contract.functions,
  })

  return getAgent(agentId)
}

export async function removeContractFromAgent(
  agentId: string,
  contractAddress: string
): Promise<AgentConfig | undefined> {
  const agent = await getAgent(agentId)
  if (!agent) return undefined

  await db
    .delete(agentContracts)
    .where(
      eq(agentContracts.agentId, agentId) &&
        eq(agentContracts.address, contractAddress.toLowerCase())
    )

  return getAgent(agentId)
}
