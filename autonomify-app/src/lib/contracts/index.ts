/**
 * Contract Resolution Module
 *
 * Handles fetching and resolving contract ABIs from block explorers.
 * Uses SDK's chain configuration as the single source of truth.
 */

export { fetchAbi, isValidAddress } from "./fetcher"
export {
  resolveContract,
  resolveMetadata,
  extractFunctions,
  type ResolvedContract,
  type ResolveContractOptions,
} from "./resolver"
