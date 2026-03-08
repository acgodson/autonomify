import type { Abi, AbiFunction } from "viem"
import type { Agent, AgentContract } from "./types"

export function findContract(agent: Agent, address: string): AgentContract | undefined {
  return agent.contracts.find(
    (c) => c.address.toLowerCase() === address.toLowerCase()
  )
}

export function findAbiFunction(abi: Abi, functionName: string): AbiFunction | undefined {
  return abi.find(
    (item): item is AbiFunction =>
      item.type === "function" && item.name === functionName
  )
}

export function getAgentChainId(agent: Agent): number | undefined {
  return agent.contracts[0]?.chainId
}

export function hasContracts(agent: Agent): boolean {
  return agent.contracts.length > 0
}

export function isAgentReady(agent: Agent): boolean {
  return agent.contracts.length > 0
}
