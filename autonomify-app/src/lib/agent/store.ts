/**
 * Agent Store
 *
 * Persistence layer for agents using Drizzle ORM with Neon.
 * Channel-agnostic - supports Telegram, Discord, and self-hosted agents.
 */

import { eq } from "drizzle-orm"
import { randomBytes } from "crypto"
import type { Abi } from "viem"
import { getChain, type Chain, type FunctionExport } from "autonomify-sdk"
import { db, agents, agentContracts } from "@/lib/db"
import type { Agent, AgentWallet, AgentContract, ChannelType } from "./types"
import { createAgentWallet } from "./wallet"

export async function generateWallet(): Promise<AgentWallet> {
  return createAgentWallet()
}

function generateAgentIdBytes(): string {
  return "0x" + randomBytes(32).toString("hex")
}

function dbRowToAgent(
  agent: typeof agents.$inferSelect,
  contracts: (typeof agentContracts.$inferSelect)[]
): Agent {
  const agentData: Agent = {
    id: agent.id,
    name: agent.name,
    channel: (agent.type || "telegram") as ChannelType,
    contracts: contracts.map((c) => {
      const chain = getChain(c.chainId)
      return {
        address: c.address,
        chainId: c.chainId,
        chain: chain || (c.chainConfig as Chain),
        abi: c.abi as Abi,
        metadata: c.metadata as Record<string, unknown>,
        functions: c.functions as FunctionExport[],
      }
    }),
    createdAt: agent.createdAt.getTime(),
  }

                            
  if (agent.type === "telegram" || agent.type === "discord" || !agent.type) {
    agentData.channelToken = agent.telegramBotToken || undefined
    if (agent.walletAddress && agent.walletId) {
      agentData.wallet = {
        address: agent.walletAddress,
        privyWalletId: agent.walletId,
      }
    }
  }

  // Add self-hosted agent fields
  if (agent.type === "self_hosted") {
    agentData.agentIdBytes = agent.agentIdBytes || undefined
  }

  return agentData
}

export interface CreateAgentOptions {
  name: string
  channel: ChannelType
  ownerAddress: string
  channelToken?: string // Telegram bot token, Discord bot token
}

export async function createAgent(options: CreateAgentOptions): Promise<Agent> {
  if (options.channel === "self_hosted") {                                     
    const agentIdBytes = generateAgentIdBytes()

    const [agent] = await db
      .insert(agents)
      .values({
        name: options.name,
        type: "self_hosted",
        ownerAddress: options.ownerAddress.toLowerCase(),
        agentIdBytes,
      })
      .returning()

    return {
      id: agent.id,
      name: agent.name,
      channel: "self_hosted",
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
      type: options.channel,
      ownerAddress: options.ownerAddress.toLowerCase(),
      telegramBotToken: options.channelToken,
      walletId: wallet.privyWalletId,
      walletAddress: wallet.address,
    })
    .returning()

  return {
    id: agent.id,
    name: agent.name,
    channel: options.channel,
    channelToken: agent.telegramBotToken || undefined,
    wallet,
    contracts: [],
    createdAt: agent.createdAt.getTime(),
  }
}

export async function getAgent(id: string): Promise<Agent | undefined> {
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, id),
  })

  if (!agent) return undefined

  const contracts = await db.query.agentContracts.findMany({
    where: eq(agentContracts.agentId, id),
  })

  return dbRowToAgent(agent, contracts)
}

export async function listAgents(ownerAddress?: string): Promise<Agent[]> {
  const allAgents = await db.query.agents.findMany({
    where: ownerAddress
      ? eq(agents.ownerAddress, ownerAddress.toLowerCase())
      : undefined,
    orderBy: (agents, { desc }) => [desc(agents.createdAt)],
  })

  const result: Agent[] = []

  for (const agent of allAgents) {
    const contracts = await db.query.agentContracts.findMany({
      where: eq(agentContracts.agentId, agent.id),
    })
    result.push(dbRowToAgent(agent, contracts))
  }

  return result
}

export async function updateAgent(
  id: string,
  updates: Partial<Pick<Agent, "name" | "channelToken">>
): Promise<Agent | undefined> {
  const existing = await getAgent(id)
  if (!existing) return undefined

  const updateData: Partial<typeof agents.$inferInsert> = {}
  if (updates.name) updateData.name = updates.name
  if (updates.channelToken) updateData.telegramBotToken = updates.channelToken
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
  contract: AgentContract
): Promise<Agent | undefined> {
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
    chainId: contract.chainId,
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
): Promise<Agent | undefined> {
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
