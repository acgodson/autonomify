import type { AgentType } from "@/types"

interface AgentTypeBadgeProps {
  type: AgentType
  size?: "sm" | "md"
}

const styles: Record<AgentType, string> = {
  telegram: "bg-[#0088cc]/20 text-[#0088cc]",
  discord: "bg-[#5865F2]/20 text-[#5865F2]",
  self_hosted: "bg-amber-500/20 text-amber-400",
}

const labels: Record<AgentType, string> = {
  telegram: "Telegram",
  discord: "Discord",
  self_hosted: "Self-Hosted",
}

export function AgentTypeBadge({ type, size = "sm" }: AgentTypeBadgeProps) {
  const sizeStyles = size === "sm" ? "text-[10px] px-2 py-0.5" : "text-xs px-2.5 py-1"

  return (
    <span className={`${styles[type]} ${sizeStyles} rounded-full font-medium`}>
      {labels[type]}
    </span>
  )
}
