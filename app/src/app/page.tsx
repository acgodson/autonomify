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
                className="bg-zinc-800 border border-zinc-700 rounded-xl px-5 py-5 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 text-lg appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27white%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3e%3cpolyline points=%276 9 12 15 18 9%27%3e%3c/polyline%3e%3c/svg%3e')] bg-[length:20px] bg-[right_1rem_center] bg-no-repeat pr-12"
              />

              <input
                type="text"
                value={resolver.address}
                onChange={(e) => resolver.setAddress(e.target.value)}
                placeholder="Paste contract address (0x...)"
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-6 py-5 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-xl"
                onKeyDown={(e) => e.key === "Enter" && handleAutonomify()}
              />

              <button
                onClick={handleAutonomify}
                disabled={resolver.loading}
                className="flex items-center gap-3 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-zinc-900 font-semibold px-10 py-5 rounded-xl transition-all text-xl"
              >
                <MagicWandIcon className="w-6 h-6" />
                {resolver.loading ? "..." : "Autonomify"}
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

            <div className="bg-zinc-900/50 backdrop-blur rounded-2xl p-6 border border-zinc-800 mb-6">
              <h2 className="text-lg font-medium mb-4">Launch Agent</h2>
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => modals.setShowLaunchModal(true)}
                  className="flex flex-col items-center justify-center gap-2 bg-[#0088cc] hover:bg-[#0099dd] text-white font-medium py-5 px-4 rounded-xl transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.03-1.99 1.27-5.62 3.72-.53.36-1.01.54-1.44.53-.47-.01-1.38-.27-2.06-.49-.83-.27-1.49-.42-1.43-.88.03-.24.37-.49 1.02-.74 3.99-1.74 6.65-2.89 7.99-3.45 3.8-1.6 4.59-1.88 5.1-1.89.11 0 .37.03.54.17.14.12.18.28.2.45-.01.06.01.24 0 .38z"/>
                  </svg>
                  <span className="text-sm">Telegram</span>
                </button>

                <button
                  disabled
                  className="flex flex-col items-center justify-center gap-2 bg-zinc-800 text-zinc-500 font-medium py-5 px-4 rounded-xl cursor-not-allowed relative overflow-hidden"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                  <span className="text-sm">Discord</span>
                  <span className="absolute top-1 right-1 text-[10px] bg-zinc-700 px-1.5 py-0.5 rounded-full">Soon</span>
                </button>

                <button
                  onClick={() => modals.setShowLaunchModal(true)}
                  className="flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-zinc-900 font-medium py-5 px-4 rounded-xl transition-colors"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m18 16 4-4-4-4" />
                    <path d="m6 8-4 4 4 4" />
                    <path d="m14.5 4-5 16" />
                  </svg>
                  <span className="text-sm">Self-Hosted</span>
                </button>
              </div>

            </div>
          </>
        )}
      </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur border-t border-zinc-800 px-6 py-3 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-center gap-8 text-sm">
          <div className="text-zinc-500">
            <span className="text-white font-medium">{agents.length}</span> agents
          </div>
          <div className="text-zinc-500">
            <span className="text-white font-medium">{totalContracts}</span> contracts
          </div>
          <div className="text-zinc-500">
            Base Sepolia
          </div>
        </div>
      </footer>

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
