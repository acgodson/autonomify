"use client"

import { useState } from "react"
import Image from "next/image"
import type { FunctionInfo } from "@/lib/autonomify-core"

interface FunctionListProps {
  functions: FunctionInfo[]
  descriptions?: Record<string, string>
}

export function FunctionList({ functions, descriptions }: FunctionListProps) {
  const [hoveredIndex, setHoveredIndex] = useState<string | null>(null)
  
  const viewFunctions = functions.filter(
    (f) => f.stateMutability === "view" || f.stateMutability === "pure"
  )
  const writeFunctions = functions.filter(
    (f) => f.stateMutability === "nonpayable" || f.stateMutability === "payable"
  )

  // Calculate arc positions for functions
  // Left arc for read functions, right arc for write functions
  const getArcPosition = (index: number, total: number, side: "left" | "right") => {
    // Arc spans from -60deg to 60deg (top to bottom through the side)
    const startAngle = -70
    const endAngle = 70
    const angleRange = endAngle - startAngle
    const angle = startAngle + (angleRange * (index + 0.5)) / Math.max(total, 1)
    const angleRad = (angle * Math.PI) / 180

    // Radius of the arc (in percentage of container)
    const radius = 42

    // Calculate x,y - center is at 50%, 50%
    const centerX = 50
    const centerY = 50

    let x: number
    if (side === "left") {
      x = centerX - radius * Math.cos(angleRad)
    } else {
      x = centerX + radius * Math.cos(angleRad)
    }
    const y = centerY + radius * Math.sin(angleRad)

    return { x, y, angle }
  }

  return (
    <div className="relative w-full" style={{ minHeight: "400px" }}>
      {/* Center labels */}
      <div className="absolute left-1/2 top-4 -translate-x-1/2 flex items-center gap-2 z-10">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-xs font-medium text-zinc-500">
          Read ({viewFunctions.length})
        </span>
        <span className="text-zinc-700 mx-2">|</span>
        <div className="w-2 h-2 rounded-full bg-blue-500" />
        <span className="text-xs font-medium text-zinc-500">
          Write ({writeFunctions.length})
        </span>
      </div>

      {/* Left arc - Read functions */}
      {viewFunctions.map((fn, i) => {
        const pos = getArcPosition(i, viewFunctions.length, "left")
        const cardId = `read-${i}`
        return (
          <div
            key={cardId}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: hoveredIndex === cardId ? 9999 : 1,
            }}
          >
            <FunctionCard
              fn={fn}
              description={descriptions?.[fn.name]}
              variant="read"
              onHoverChange={(isHovered) => setHoveredIndex(isHovered ? cardId : null)}
            />
          </div>
        )
      })}

      {/* Right arc - Write functions */}
      {writeFunctions.map((fn, i) => {
        const pos = getArcPosition(i, writeFunctions.length, "right")
        const cardId = `write-${i}`
        return (
          <div
            key={cardId}
            className="absolute"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              zIndex: hoveredIndex === cardId ? 9999 : 1,
            }}
          >
            <FunctionCard
              fn={fn}
              description={descriptions?.[fn.name]}
              variant="write"
              onHoverChange={(isHovered) => setHoveredIndex(isHovered ? cardId : null)}
            />
          </div>
        )
      })}

      {/* Center mascot */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10">
        <Image
          src="/autonomify_mascot.png"
          alt="Autonomify Mascot"
          width={450}
          height={450}
          className="object-contain drop-shadow-2xl opacity-95"
        />
      </div>
    </div>
  )
}

function FunctionCard({
  fn,
  description,
  variant,
  onHoverChange,
}: {
  fn: FunctionInfo
  description?: string
  variant: "read" | "write"
  onHoverChange: (isHovered: boolean) => void
}) {
  const [hovered, setHovered] = useState(false)

  const handleMouseEnter = () => {
    setHovered(true)
    onHoverChange(true)
  }

  const handleMouseLeave = () => {
    setHovered(false)
    onHoverChange(false)
  }

  const inputStr = fn.inputs
    .map((inp) => `${inp.type}${inp.name ? " " + inp.name : ""}`)
    .join(", ")

  const outputStr =
    fn.outputs.length > 0 ? fn.outputs.map((o) => o.type).join(", ") : ""

  const borderColor = variant === "read"
    ? "border-green-500/30 hover:border-green-500/60"
    : "border-blue-500/30 hover:border-blue-500/60"

  const dotColor = variant === "read"
    ? "bg-green-500"
    : fn.stateMutability === "payable"
    ? "bg-yellow-500"
    : "bg-blue-500"

  return (
    <div
      className={`relative bg-zinc-800 border ${borderColor} rounded-lg px-3 py-2 transition-all duration-200 hover:bg-zinc-700 cursor-pointer whitespace-nowrap`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Status dot */}
      <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${dotColor}`} />

      {/* Function name */}
      <code className="text-xs font-mono text-amber-400">
        {fn.name}
      </code>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className={`absolute ${variant === "read" ? "left-full ml-2" : "right-full mr-2"} top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-700 rounded-lg p-4 shadow-2xl w-[240px] overflow-hidden`}
        >
          <code className="text-sm font-mono text-amber-400 block mb-2 break-words whitespace-normal">
            {fn.name}
          </code>

          {fn.inputs.length > 0 && (
            <div className="mb-2">
              <div className="text-xs text-zinc-500 mb-1">Params:</div>
              <code className="text-xs text-zinc-300 break-words whitespace-normal block">{inputStr}</code>
            </div>
          )}

          {outputStr && (
            <div className="mb-2">
              <div className="text-xs text-zinc-500 mb-1">Returns:</div>
              <code className="text-xs text-zinc-300 break-words whitespace-normal block">{outputStr}</code>
            </div>
          )}

          {description && (
            <p className="text-xs text-zinc-400 mb-2 break-words whitespace-normal">{description}</p>
          )}

          <span className={`text-xs px-2 py-0.5 rounded inline-block ${
            fn.stateMutability === "view" || fn.stateMutability === "pure"
              ? "bg-green-900/50 text-green-400"
              : fn.stateMutability === "payable"
              ? "bg-yellow-900/50 text-yellow-400"
              : "bg-blue-900/50 text-blue-400"
          }`}>
            {fn.stateMutability}
          </span>
        </div>
      )}
    </div>
  )
}
