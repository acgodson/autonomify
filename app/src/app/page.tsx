"use client"

import Image from "next/image"
import { FunctionList, AccountSetup, SmartAccountCard } from "@/components/organisms"
import {
  LaunchModal,
  LaunchedModal,
  AgentDetailModal,
  ConnectWalletModal,
  SelfHostedSetupModal,
} from "@/components/organisms/modals"
import { LoadingAnimation } from "@/components/molecules"
import { GridPattern, MagicUnderline } from "@/components/layouts"
import { AgentTypeBadge } from "@/components/molecules/AgentTypeBadge"
import { MagicWandIcon } from "@/components/atoms"
import { useWallet } from "@/lib/wallet"
import { useNetwork, NetworkToggle, ChainSelector } from "@/contexts/network-context"
import {
  useScrollScale,
  useLoadingWords,
  useAgents,
  useModals,
  useContractResolver,
} from "@/hooks"

export default function Home() {
  const {
    address: walletAddress,
    isConnected,
    isConnecting,
    isSmartAccountLoading,
    connect,
    disconnect,
    isAccountReady,
    showAccountSetup,
    setShowAccountSetup,
    markAccountReady,
  } = useWallet()
  const { selectedChainId, setSelectedChainId } = useNetwork()

  const heroScale = useScrollScale()
  const { agents, totalContracts, addOrUpdateAgent } = useAgents(walletAddress, isConnected)
  const resolver = useContractResolver()
  const loadingWord = useLoadingWords(resolver.loading)
  const modals = useModals()

  function handleAutonomify() {
    if (!isConnected) {
      modals.setShowConnectPrompt(true)
      return
    }
    if (selectedChainId) {
      resolver.resolve(selectedChainId)
    }
  }

  return (
    <main className="h-screen bg-zinc-950 text-white relative overflow-hidden flex flex-col">
      <GridPattern />

      <nav className="fixed top-0 left-0 right-0 bg-zinc-950/90 backdrop-blur border-b border-zinc-800 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-icon.png"
              alt="Autonomify"
              width={70}
              height={70}
              className="object-contain"
            />
            <span
              className="text-lg font-bold text-white pixel-text relative"
              data-text="Autonomify"
            >
              Autonomify
            </span>
          </div>
          <div className="flex items-center gap-3">
            <NetworkToggle />
            {isConnected && agents.length > 0 && (
              <button
                onClick={modals.toggleAgentPanel}
                className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-full px-4 py-2 transition-colors"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span className="text-sm">{agents.length} agent{agents.length > 1 ? "s" : ""}</span>
              </button>
            )}
            {isConnected ? (
              <div className="flex items-center gap-2">
                {isSmartAccountLoading ? (
                  <div className="flex items-center gap-2 bg-zinc-800 rounded-full px-4 py-2">
                    <div className="w-3 h-3 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-sm text-zinc-400">Creating wallet...</span>
                  </div>
                ) : (
                  <>
                    {!isAccountReady && (
                      <button
                        onClick={() => setShowAccountSetup(true)}
                        className="flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded-full px-3 py-2 transition-colors text-sm"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Setup Required
                      </button>
                    )}
                    <button
                      onClick={() => disconnect()}
                      className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 rounded-full px-4 py-2 transition-colors"
                    >
                      <div className={`w-2 h-2 ${isAccountReady ? 'bg-green-500' : 'bg-amber-500'} rounded-full`} />
                      <span className="text-sm font-mono">{walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}</span>
                    </button>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => connect()}
                disabled={isConnecting}
                className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-medium rounded-full px-4 py-2 transition-colors w-[140px]"
              >
                {isConnecting ? "Signing in..." : "Sign In"}
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 pt-24 pb-20 relative z-10">
        <div
          className="flex flex-col items-center justify-center transition-transform duration-300 ease-out"
          style={{
            transform: `scale(${heroScale})`,
            minHeight: resolver.contract ? 'auto' : 'calc(100vh - 200px)'
          }}
        >
          <div className="text-center mb-16 max-w-4xl">
            <p className="text-zinc-300 text-4xl md:text-5xl leading-tight">
              Turn any <span className="gradient-text">verified contract</span> into an{" "}
              <span className="relative inline-block">
                AI agent
                <MagicUnderline />
              </span>
              {" "}and <span className="text-zinc-500">more..</span>
            </p>
          </div>

          <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-8 border border-zinc-800 mb-8 w-full max-w-4xl">
            <div className="flex gap-4">
              <ChainSelector
                value={selectedChainId}
                onChange={setSelectedChainId}
                showOnlyReady={true}
                disabled={!!resolver.contract}
                compact={true}
                className={`w-32 shrink-0 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-base appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:16px] bg-[right_0.5rem_center] bg-no-repeat pr-8 ${resolver.contract ? 'opacity-50 cursor-not-allowed' : ''}`}
              />

              <div className="flex-1 relative">
                <input
                  type="text"
                  value={resolver.address}
                  onChange={(e) => resolver.setAddress(e.target.value)}
                  placeholder="Paste contract address (0x...)"
                  disabled={!!resolver.contract}
                  className={`w-full bg-zinc-800 border border-zinc-700 rounded-xl px-6 py-5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xl ${resolver.contract ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onKeyDown={(e) => e.key === "Enter" && !resolver.contract && handleAutonomify()}
                />
                {resolver.contract && (
                  <button
                    onClick={() => resolver.reset()}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    Reset
                  </button>
                )}
              </div>

              <button
                onClick={() => resolver.contract ? modals.setShowLaunchModal(true) : handleAutonomify()}
                disabled={resolver.loading}
                className={`flex items-center gap-3 font-semibold px-10 py-5 rounded-xl transition-all text-xl ${
                  resolver.contract
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-zinc-900'
                    : 'bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900'
                }`}
              >
                <MagicWandIcon className="w-6 h-6" />
                {resolver.loading ? "..." : resolver.contract ? "Launch Agent" : "Autonomify"}
              </button>
            </div>

            {resolver.loading && (
              <div className="mt-6 flex justify-center">
                <LoadingAnimation word={loadingWord} />
              </div>
            )}

            {resolver.error && (
              <div className="mt-6 bg-red-900/30 border border-red-800 text-red-400 px-5 py-4 rounded-xl text-lg">
                {resolver.error}
              </div>
            )}
          </div>
        </div>

        {resolver.contract && (
          <>
            <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <code className="text-blue-400">{resolver.contract.address}</code>
                  {resolver.contract.analysis?.contractType && (
                    <span className="bg-amber-500/20 text-amber-400 text-xs px-2 py-1 rounded-full">
                      {resolver.contract.analysis.contractType}
                    </span>
                  )}
                </div>
                <span className="text-zinc-500 text-sm">
                  {resolver.contract.functions.length} functions
                </span>
              </div>

              {resolver.contract.analysis?.summary && (
                <p className="text-zinc-300 mb-4">{resolver.contract.analysis.summary}</p>
              )}

              {resolver.contract.analysis?.capabilities && resolver.contract.analysis.capabilities.length > 0 && (
                <div className="mb-6">
                  <div className="text-zinc-500 text-xs uppercase tracking-wide mb-2">
                    Capabilities
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resolver.contract.analysis.capabilities.map((cap, i) => (
                      <span
                        key={i}
                        className="bg-zinc-800 text-zinc-300 text-sm px-3 py-1 rounded-full"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(resolver.contract.metadata).length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                  {Object.entries(resolver.contract.metadata).map(([key, value]) => (
                    <div key={key} className="bg-zinc-800/50 rounded-xl p-3">
                      <div className="text-zinc-500 text-xs uppercase tracking-wide mb-1">
                        {key}
                      </div>
                      <div className="text-white font-medium truncate">
                        {String(value)}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <FunctionList
                functions={resolver.contract.functions}
                descriptions={resolver.contract.analysis?.functionDescriptions}
              />
            </div>

          </>
        )}
      </div>
      </div>


      {modals.showAgentPanel && (
        <div className="fixed inset-0 z-50" onClick={() => modals.setShowAgentPanel(false)}>
          <div
            className="absolute right-0 top-0 bottom-0 w-96 bg-zinc-900 border-l border-zinc-800 p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Your Account</h2>
              <button
                onClick={() => modals.setShowAgentPanel(false)}
                className="text-zinc-500 hover:text-white"
              >
                ✕
              </button>
            </div>

            {walletAddress && (
              <div className="mb-6">
                <SmartAccountCard address={walletAddress} />
              </div>
            )}

            <h3 className="text-sm font-medium text-zinc-400 mb-3">Your Agents</h3>
            <div className="space-y-3">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-zinc-800 rounded-xl p-4 cursor-pointer hover:bg-zinc-700/80 transition-colors"
                  onClick={() => modals.setSelectedAgentDetail(agent)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <span className="font-medium">{agent.name}</span>
                    </div>
                    <AgentTypeBadge type={agent.type} />
                  </div>
                  <div className="text-xs text-zinc-500 mb-1">
                    {agent.contractCount} contract{agent.contractCount !== 1 ? "s" : ""}
                  </div>
                  {agent.walletAddress ? (
                    <code className="text-xs text-zinc-400 break-all">
                      {agent.walletAddress}
                    </code>
                  ) : agent.agentIdBytes ? (
                    <code className="text-xs text-amber-400/70 break-all">
                      Agent ID: {agent.agentIdBytes.slice(0, 18)}...
                    </code>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {modals.selectedAgentDetail && (
        <AgentDetailModal
          agent={modals.selectedAgentDetail}
          onClose={() => modals.setSelectedAgentDetail(null)}
          onOpenSetup={() => modals.openSelfHostedSetup(modals.selectedAgentDetail!, walletAddress || "")}
        />
      )}

      {modals.showLaunchModal && resolver.contract && walletAddress && (
        <LaunchModal
          contract={resolver.contract}
          agents={agents}
          ownerAddress={walletAddress}
          onClose={() => modals.setShowLaunchModal(false)}
          onLaunched={(agent) => {
            modals.setLaunchedAgent(agent)
            addOrUpdateAgent(agent)
            modals.setShowLaunchModal(false)
            if (agent.isNew && agent.type === "self_hosted" && agent.agentIdBytes) {
              modals.setSelfHostedSetup({
                agentId: agent.id,
                agentName: agent.name,
                agentIdBytes: agent.agentIdBytes,
                smartAccountAddress: walletAddress || "",
              })
            }
          }}
        />
      )}

      {modals.launchedAgent && (
        <LaunchedModal
          agent={modals.launchedAgent}
          onClose={() => modals.setLaunchedAgent(null)}
        />
      )}

      {modals.selfHostedSetup && (
        <SelfHostedSetupModal
          agentId={modals.selfHostedSetup.agentId}
          agentName={modals.selfHostedSetup.agentName}
          agentIdBytes={modals.selfHostedSetup.agentIdBytes}
          smartAccountAddress={modals.selfHostedSetup.smartAccountAddress}
          onClose={() => modals.setSelfHostedSetup(null)}
        />
      )}

      {modals.showConnectPrompt && (
        <ConnectWalletModal
          onConnect={() => {
            connect()
            modals.setShowConnectPrompt(false)
          }}
          onClose={() => modals.setShowConnectPrompt(false)}
          isConnecting={isConnecting}
        />
      )}

      {showAccountSetup && isConnected && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md">
            <AccountSetup onReady={markAccountReady} />
          </div>
        </div>
      )}
    </main>
  )
}
