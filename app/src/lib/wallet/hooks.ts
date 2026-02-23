"use client"

import { useAccount, useConnect, useDisconnect } from "wagmi"
import { injected } from "wagmi/connectors"

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount()
  const { connect, isPending: isConnectPending } = useConnect()
  const { disconnect } = useDisconnect()

  const connectWallet = () => {
    connect({ connector: injected() })
  }

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isConnectPending,
    connect: connectWallet,
    disconnect,
  }
}
