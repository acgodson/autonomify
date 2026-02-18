import { readFileSync, writeFileSync, existsSync } from "fs"
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import type { AgentConfig, AgentWallet, ContractContext } from "./types"

const DATA_FILE = "./data/agents.json"

let agents: Map<string, AgentConfig> = new Map()
let initialized = false

function loadFromFile(): void {
  if (initialized) return

  try {
    if (existsSync(DATA_FILE)) {
      const data = readFileSync(DATA_FILE, "utf-8")
      const parsed = JSON.parse(data) as AgentConfig[]
      agents = new Map(parsed.map((a) => [a.id, a]))
    }
  } catch {
    agents = new Map()
  }

  initialized = true
}

function saveToFile(): void {
  const data = Array.from(agents.values())
  writeFileSync(DATA_FILE, JSON.stringify(data, null, 2))
}

export function generateWallet(): AgentWallet {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  return {
    address: account.address,
    privateKey,
  }
}

function generateId(): string {
  return `agt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createAgent(name: string, telegramBotToken: string): AgentConfig {
  loadFromFile()

  const wallet = generateWallet()
  const agent: AgentConfig = {
    id: generateId(),
    name,
    telegramBotToken,
    wallet,
    contracts: [],
    createdAt: Date.now(),
  }

  agents.set(agent.id, agent)
  saveToFile()

  return agent
}

export function getAgent(id: string): AgentConfig | undefined {
  loadFromFile()
  return agents.get(id)
}

export function listAgents(): AgentConfig[] {
  loadFromFile()
  return Array.from(agents.values()).sort((a, b) => b.createdAt - a.createdAt)
}

export function updateAgent(id: string, updates: Partial<AgentConfig>): AgentConfig | undefined {
  loadFromFile()

  const agent = agents.get(id)
  if (!agent) return undefined

  const updated = { ...agent, ...updates, id: agent.id }
  agents.set(id, updated)
  saveToFile()

  return updated
}

export function deleteAgent(id: string): boolean {
  loadFromFile()

  if (!agents.has(id)) return false

  agents.delete(id)
  saveToFile()

  return true
}

export function addContractToAgent(
  agentId: string,
  contract: ContractContext
): AgentConfig | undefined {
  loadFromFile()

  const agent = agents.get(agentId)
  if (!agent) return undefined

  const exists = agent.contracts.some(
    (c) => c.address.toLowerCase() === contract.address.toLowerCase()
  )
  if (exists) return agent

  agent.contracts.push(contract)
  agents.set(agentId, agent)
  saveToFile()

  return agent
}

export function removeContractFromAgent(
  agentId: string,
  contractAddress: string
): AgentConfig | undefined {
  loadFromFile()

  const agent = agents.get(agentId)
  if (!agent) return undefined

  agent.contracts = agent.contracts.filter(
    (c) => c.address.toLowerCase() !== contractAddress.toLowerCase()
  )
  agents.set(agentId, agent)
  saveToFile()

  return agent
}
