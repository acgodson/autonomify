import type { FunctionExport } from "../types"

export type ContractType =
  | "erc20"
  | "erc721"
  | "erc1155"
  | "dex-router"
  | "dex-pair"
  | "staking"
  | "governance"
  | "multisig"
  | "unknown"

export interface ContractPattern {
  type: ContractType
  name: string
  description: string
  functions: string[]
  warnings: string[]
}

const PATTERNS: ContractPattern[] = [
  {
    type: "erc20",
    name: "ERC-20 Token",
    description: "Standard fungible token",
    functions: ["balanceOf", "transfer", "approve", "allowance", "transferFrom"],
    warnings: ["Check decimals before converting amounts", "Beware of tokens with transfer fees"],
  },
  {
    type: "erc721",
    name: "ERC-721 NFT",
    description: "Non-fungible token (NFT)",
    functions: ["balanceOf", "ownerOf", "safeTransferFrom", "approve", "setApprovalForAll"],
    warnings: ["Use safeTransferFrom to ensure recipient can receive", "tokenId is unique, not an index"],
  },
  {
    type: "erc1155",
    name: "ERC-1155 Multi-Token",
    description: "Multi-token standard",
    functions: ["balanceOf", "balanceOfBatch", "safeTransferFrom", "setApprovalForAll"],
    warnings: ["Each tokenId can have multiple copies", "Use batch functions for gas efficiency"],
  },
  {
    type: "dex-router",
    name: "DEX Router",
    description: "Decentralized exchange router",
    functions: ["swapExactTokensForTokens", "swapTokensForExactTokens", "getAmountsOut", "getAmountsIn"],
    warnings: ["Approve tokens before swapping", "ETH = native token (BNB on BSC)", "Set realistic deadline"],
  },
  {
    type: "dex-pair",
    name: "DEX Pair",
    description: "Liquidity pool",
    functions: ["getReserves", "token0", "token1", "swap"],
    warnings: ["Don't interact directly - use router", "token0 < token1 (sorted by address)"],
  },
  {
    type: "staking",
    name: "Staking Contract",
    description: "Lock tokens for rewards",
    functions: ["stake", "withdraw", "getReward"],
    warnings: ["Approve before staking", "Some have lock periods", "exit() = withdraw + claim"],
  },
  {
    type: "governance",
    name: "Governance",
    description: "DAO voting system",
    functions: ["propose", "castVote", "execute", "state"],
    warnings: ["Need tokens to propose", "Voting power snapshot at proposal creation"],
  },
  {
    type: "multisig",
    name: "Multisig Wallet",
    description: "Multi-signature wallet",
    functions: ["submitTransaction", "confirmTransaction", "executeTransaction", "getOwners"],
    warnings: ["Need threshold confirmations", "Only owners can confirm"],
  },
]

export function detectType(functions: FunctionExport[] | string[]): ContractType {
  const names = functions.map((f) => (typeof f === "string" ? f : f.name))

  let best: ContractType = "unknown"
  let bestScore = 0

  for (const pattern of PATTERNS) {
    const matches = pattern.functions.filter((fn) => names.includes(fn)).length
    const ratio = matches / pattern.functions.length
    if (ratio >= 0.7 && matches > bestScore) {
      bestScore = matches
      best = pattern.type
    }
  }

  return best
}

export function getPattern(type: ContractType): ContractPattern | null {
  return PATTERNS.find((p) => p.type === type) || null
}

export function detectPattern(functions: FunctionExport[] | string[]): ContractPattern | null {
  const type = detectType(functions)
  return getPattern(type)
}

export function hasAdmin(functions: FunctionExport[] | string[]): boolean {
  const names = functions.map((f) => (typeof f === "string" ? f : f.name).toLowerCase())
  const adminPatterns = ["owner", "admin", "transferownership", "grantrole", "pause", "setfee"]
  return names.some((n) => adminPatterns.some((p) => n.includes(p)))
}
