"use client"

import { SignInIcon, WalletIcon } from "@/components/atoms"

interface ConnectWalletModalProps {
  onConnect: () => void
  onClose: () => void
  isConnecting: boolean
}

export function ConnectWalletModal({ onConnect, onClose, isConnecting }: ConnectWalletModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 w-full max-w-md text-center">
        <div className="w-16 h-16 bg-amber-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <WalletIcon className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign In to Autonomify</h2>
        <p className="text-zinc-400 text-sm mb-6">
          Sign in with email, Google, or your existing wallet to create and manage your AI agents with a secure smart account.
        </p>

        <button
          onClick={onConnect}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-700 text-zinc-900 font-semibold py-4 rounded-xl transition-colors mb-3"
        >
          {isConnecting ? (
            "Signing in..."
          ) : (
            <>
              <SignInIcon className="w-5 h-5" />
              Sign In
            </>
          )}
        </button>

        <button
          onClick={onClose}
          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white py-3 rounded-xl transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
