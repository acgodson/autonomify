import { baseSepolia } from "viem/chains"

/**
 * Wallet Configuration
 *
 * Now using Privy for embedded wallets and smart accounts.
 * Currently only supports Base Sepolia for the hackathon.
 */

export const TARGET_CHAIN = baseSepolia
export const TARGET_CHAIN_ID = baseSepolia.id

// AutonomifyExecutor contract address on Base Sepolia
export const EXECUTOR_ADDRESS = "0xD44def7f75Fea04B402688FF14572129D2BEeb05"
