"use client"

import { useState, useCallback } from "react"
import type { AgentData, AgentType } from "./useAgents"

interface LaunchedAgent {
  id: string
  name: string
  type: AgentType
  walletAddress?: string
  agentIdBytes?: string
  isNew: boolean
}

interface SelfHostedSetupData {
  agentId: string
  agentName: string
  agentIdBytes: string
  smartAccountAddress: string
}

interface UseModalsReturn {
  showConnectPrompt: boolean
  setShowConnectPrompt: (show: boolean) => void
  showLaunchModal: boolean
  setShowLaunchModal: (show: boolean) => void
  showAgentPanel: boolean
  setShowAgentPanel: (show: boolean) => void
  toggleAgentPanel: () => void
  selectedAgentDetail: AgentData | null
  setSelectedAgentDetail: (agent: AgentData | null) => void
  launchedAgent: LaunchedAgent | null
  setLaunchedAgent: (agent: LaunchedAgent | null) => void
  selfHostedSetup: SelfHostedSetupData | null
  setSelfHostedSetup: (data: SelfHostedSetupData | null) => void
  openSelfHostedSetup: (agent: AgentData, smartAccountAddress: string) => void
}

export function useModals(): UseModalsReturn {
  const [showConnectPrompt, setShowConnectPrompt] = useState(false)
  const [showLaunchModal, setShowLaunchModal] = useState(false)
  const [showAgentPanel, setShowAgentPanel] = useState(false)
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<AgentData | null>(null)
  const [launchedAgent, setLaunchedAgent] = useState<LaunchedAgent | null>(null)
  const [selfHostedSetup, setSelfHostedSetup] = useState<SelfHostedSetupData | null>(null)

  const toggleAgentPanel = useCallback(() => {
    setShowAgentPanel((prev) => !prev)
  }, [])

  const openSelfHostedSetup = useCallback((agent: AgentData, smartAccountAddress: string) => {
    if (agent.type === "self_hosted" && agent.agentIdBytes) {
      setSelfHostedSetup({
        agentId: agent.id,
        agentName: agent.name,
        agentIdBytes: agent.agentIdBytes,
        smartAccountAddress,
      })
    }
    setSelectedAgentDetail(null)
  }, [])

  return {
    showConnectPrompt,
    setShowConnectPrompt,
    showLaunchModal,
    setShowLaunchModal,
    showAgentPanel,
    setShowAgentPanel,
    toggleAgentPanel,
    selectedAgentDetail,
    setSelectedAgentDetail,
    launchedAgent,
    setLaunchedAgent,
    selfHostedSetup,
    setSelfHostedSetup,
    openSelfHostedSetup,
  }
}

export type { LaunchedAgent, SelfHostedSetupData }
