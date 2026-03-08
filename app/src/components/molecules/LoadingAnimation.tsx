import { MagicWandIcon } from "@/components/atoms"

interface LoadingAnimationProps {
  word: string
}

export function LoadingAnimation({ word }: LoadingAnimationProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <MagicWandIcon className="w-8 h-8 text-amber-400 animate-pulse" />
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <div
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: "0ms" }}
          />
          <div
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: "150ms" }}
          />
          <div
            className="w-2 h-2 bg-amber-400 rounded-full animate-bounce"
            style={{ animationDelay: "300ms" }}
          />
        </div>
        <span className="text-zinc-400 text-sm">{word}</span>
      </div>
    </div>
  )
}

export const LOADING_WORDS = [
  "Fetching ABI...",
  "Reading contract...",
  "Extracting functions...",
  "Resolving metadata...",
  "Analyzing with AI...",
  "Understanding capabilities...",
  "Almost there...",
]
