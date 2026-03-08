"use client"

import { useState, useEffect, useCallback } from "react"

export type AgentType = "telegram" | "discord" | "self_hosted"

export interface AgentData {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  contractCount: number
}

interface LaunchedAgent {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  isNew: boolean
}

interface UseAgentsReturn {
  agents: AgentData[]
  totalContracts: number
  addOrUpdateAgent: (agent: LaunchedAgent) => void
  refresh: () => Promise<void>
}

export function useAgents(walletAddress: string | null | undefined, isConnected: boolean): UseAgentsReturn {
  const [agents, setAgents] = useState<AgentData[]>([])

  const refresh = useCallback(async () => {
    if (!walletAddress) return

    try {
      const res = await fetch("/api/agents", {
        headers: { "x-owner-address": walletAddress },
      })
      const json = await res.json()
      if (json.ok) {
        setAgents(json.data)
      }
    } catch {
      // Silent fail?
    }
  }, [walletAddress])

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setAgents([])
      return
    }

    refresh()
  }, [isConnected, walletAddress, refresh])

  const addOrUpdateAgent = useCallback((agent: LaunchedAgent) => {
    setAgents((prev) => {
      const exists = prev.find((a) => a.id === agent.id)
      if (exists) {
        return prev.map((a) =>
          a.id === agent.id ? { ...a, contractCount: a.contractCount + 1 } : a
        )
      }
      return [
        ...prev,
        {
          id: agent.id,
          name: agent.name,
          type: agent.type,
          walletAddress: agent.walletAddress,
          agentIdBytes: agent.agentIdBytes,
          contractCount: 1,
        },
      ]
    })
  }, [])

  const totalContracts = agents.reduce((sum, a) => sum + a.contractCount, 0)

  return {
    agents,
    totalContracts,
    addOrUpdateAgent,
    refresh,
  }
}
