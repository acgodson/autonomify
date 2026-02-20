# Autonomify SDK Architecture

## Design Principles

1. **LLM Agnostic** - One tool works with any AI provider
2. **Wallet Agnostic** - User provides signing logic
3. **Chain Agnostic** - Scalable to any EVM chain
4. **Framework Agnostic** - Works standalone, with agent frameworks, or hosted

## Directory Structure

```
autonomify-sdk/
├── src/
│   ├── index.ts              # Public API exports 
│   ├── types.ts              # Core type definitions
│   │
│   ├── core/
│   │   ├── encoder.ts        # Transaction encoding (viem)
│   │   ├── executor.ts       # Executor contract addresses & ABI
│   │   ├── validate.ts       # Call validation logic
│   │   └── utils.ts          # Shared utilities
│   │
│   ├── tool/
│   │   ├── index.ts          # Main tool export (createTool, buildPrompt)
│   │   ├── schema.ts         # Zod schema generator
│   │   └── handler.ts        # Execution handler
│   │
│   ├── adapters/
│   │   ├── vercel-ai.ts      # Vercel AI SDK adapter
│   │   └── openai.ts         # OpenAI SDK adapter
│   │
│   ├── chains/
│   │   └── index.ts          # Multi-chain registry (13 chains)
│   │
│   └── knowledge/
│       └── patterns.ts       # Contract pattern detection (ERC20, ERC721, etc.)
```

## Core Concepts

### The One Tool

```typescript
import { createTool, forVercelAI } from 'autonomify-sdk'

// Raw tool
const tool = createTool({
  export: exportData,
  agentId: '0x...',
  signAndSend: async (tx) => wallet.sendTransaction(tx)
})

// With Vercel AI adapter
const { tool, prompt } = forVercelAI({
  export: exportData,
  agentId: '0x...',
  signAndSend: async (tx) => wallet.sendTransaction(tx)
})
```

### Chain Registry

Comprehensive chain configuration with explorer and RPC support:

```typescript
import {
  getChain,
  getChainOrThrow,
  getChains,
  getTestnets,
  getMainnets,
  isTestnet,
  getExplorerUrl,
  getRpcUrl,
  type NetworkMode
} from 'autonomify-sdk'

// Get chain by ID
const bscTestnet = getChain(97)
const ethereum = getChainOrThrow(1) // throws if not found

// Filter by network mode
const testnets = getTestnets()           // NetworkMode: "testnet"
const mainnets = getMainnets()           // NetworkMode: "mainnet"
const all = getChains("all")             // NetworkMode: "all"

// Explorer utilities
const txUrl = getExplorerUrl(97, txHash) // BSCScan URL
const rpc = getRpcUrl(97)                // Primary RPC URL
```

### Executor Contract

```typescript
import {
  getExecutorAddress,
  isExecutorDeployed,
  getDeployedChainIds,
  EXECUTOR_ABI,
  toBytes32
} from 'autonomify-sdk'

// Get executor address (throws if not deployed)
const executor = getExecutorAddress(97)

// Check deployment status
if (isExecutorDeployed(chainId)) {
  // Safe to use
}

// Get all deployed chains
const deployedChains = getDeployedChainIds() // [97]

// Convert agent ID to bytes32
const agentIdBytes = toBytes32('uuid-string')
```

### Adapters

Thin wrappers that format the tool for specific SDKs:

```typescript
// Vercel AI SDK
import { forVercelAI } from 'autonomify-sdk'
const { tool, prompt } = forVercelAI(config)

// OpenAI SDK
import { forOpenAI } from 'autonomify-sdk'
const { tools, handler } = forOpenAI(config)

// Raw (for custom frameworks)
import { createTool, buildPrompt } from 'autonomify-sdk'
const tool = createTool(config)
const prompt = buildPrompt(exportData)
```

### Validation

```typescript
import { validateCall, type ValidationResult } from 'autonomify-sdk'

const result: ValidationResult = validateCall(
  { contractAddress, functionName, args, value },
  exportData
)

if (!result.valid) {
  console.error(result.errors) // ValidationError[]
}
```

## Supported Chains

### Testnets
| Chain | ID | Executor |
|-------|-----|----------|
| BSC Testnet | 97 | ✅ Deployed |
| Sepolia | 11155111 | Pending |
| Polygon Amoy | 80002 | Pending |
| Arbitrum Sepolia | 421614 | Pending |
| Base Sepolia | 84532 | Pending |

### Mainnets
| Chain | ID | Executor |
|-------|-----|----------|
| Ethereum | 1 | Pending |
| BSC | 56 | Pending |
| Polygon | 137 | Pending |
| Arbitrum | 42161 | Pending |
| Base | 8453 | Pending |
| Optimism | 10 | Pending |
| Avalanche | 43114 | Pending |

## File Naming Convention

- `kebab-case.ts` for all files
- No redundant prefixes (e.g., `tool.ts` not `autonomify-tool.ts`)
- Singular nouns for modules (e.g., `chain` not `chains`)
- `index.ts` for barrel exports only

## Scaling Strategy

### Adding a New Chain

1. Add chain config to `chains/index.ts`:
   ```typescript
   export const CHAINS: Record<number, Chain> = {
     // ... existing chains
     NEW_CHAIN_ID: {
       id: NEW_CHAIN_ID,
       name: "New Chain",
       shortName: "new",
       testnet: false,
       rpc: ["https://rpc.newchain.io"],
       blockTime: 2,
       nativeCurrency: { name: "NEW", symbol: "NEW", decimals: 18 },
       wrappedNative: "0x...",
       explorer: {
         name: "NewScan",
         url: "https://newscan.io",
         apiUrl: "https://api.newscan.io/api",
         type: "etherscan",
         apiKeyEnvVar: "NEWSCAN_API_KEY",
       },
     },
   }
   ```

2. Deploy executor contract to the chain

3. Add executor address to `core/executor.ts`:
   ```typescript
   export const EXECUTOR_ADDRESSES: Record<number, `0x${string}`> = {
     // ... existing addresses
     NEW_CHAIN_ID: "0x...",
   }
   ```

### Adding a New Adapter

1. Create adapter in `adapters/new-framework.ts`
2. Export from `index.ts`
3. No core changes needed

### Adding Contract Patterns

1. Add pattern to `knowledge/patterns.ts`
2. No other changes needed

## Public API Surface

### Types
- `ChainConfig`, `FunctionParam`, `FunctionExport`, `ContractExport`
- `AutonomifyExport`, `ExecuteParams`, `UnsignedTransaction`
- `ExecuteResult`, `SignAndSendFn`, `ToolConfig`, `StructuredCall`
- `Chain`, `ChainSummary`, `NetworkMode`, `ExplorerType`
- `ValidationResult`, `ValidationError`
- `Tool`, `ExecuteSchema`, `OpenAIToolDef`, `OpenAIToolCall`
- `ContractType`, `ContractPattern`

### Core Functions
- `encodeContractCall`, `encodeExecutorCall`, `buildTransaction`
- `getExecutorAddress`, `isExecutorDeployed`, `getDeployedChainIds`, `toBytes32`
- `findFunction`, `isReadOnly`, `serializeBigInts`, `argsToArray`
- `validateCall`

### Tool Functions
- `createTool`, `buildPrompt`, `getPrompt`, `executeSchema`, `executeCall`

### Adapter Functions
- `createVercelTool`, `forVercelAI`, `buildSystemPrompt`
- `createOpenAITool`, `forOpenAI`

### Chain Functions
- `getChain`, `getChainOrThrow`, `getChains`, `getMainnets`, `getTestnets`
- `getChainIds`, `isChainSupported`, `isTestnet`
- `getExplorerUrl`, `getAddressUrl`, `getTokenUrl`
- `getRpcUrl`, `getRpcUrls`
- `getChainSummary`, `getChainSummaries`

### Pattern Functions
- `detectType`, `detectPattern`, `getPattern`, `hasAdmin`

### Constants
- `CHAINS`, `chains`, `EXECUTOR_ADDRESSES`, `EXECUTOR_ABI`
