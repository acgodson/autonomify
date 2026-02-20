# Autonomify Agent Architecture v2

## Problem Analysis

### Current Issues

1. **LLM argument parsing failures** - The LLM doesn't consistently format function arguments correctly (flat arrays vs nested arrays, string vs array types)

2. **No structured understanding of contracts** - The LLM sees functions as text but doesn't truly understand:
   - What type each parameter expects
   - Which functions can interact with each other
   - Access control (onlyOwner, onlyAdmin)
   - State dependencies (need approve before transfer)

3. **Hardcoded patterns** - We're detecting "DEX" by function names, but we need dynamic understanding

4. **No cross-contract reasoning** - Agent can't figure out that USDT contract + Router contract = swap capability

5. **No guardrails** - Agent attempts impossible operations (calling admin functions without being admin)

---

## Proposed Architecture

### Layer 1: Contract Intelligence Layer

**Goal**: Extract rich metadata from any contract ABI to give the LLM true understanding.

```typescript
interface ContractIntelligence {
  address: `0x${string}`
  name: string

  // Detected contract type
  type: 'erc20' | 'erc721' | 'dex-router' | 'dex-pair' | 'governance' | 'custom'

  // Capabilities the agent has with this contract
  capabilities: {
    canRead: FunctionCapability[]
    canWrite: FunctionCapability[]
    cannotCall: FunctionCapability[]  // Functions that would revert
  }

  // Relationships to other contracts
  relationships: {
    tokenPairs?: { tokenA: string, tokenB: string }[]
    requiredApprovals?: { token: string, spender: string }[]
    adminAddress?: string
  }
}

interface FunctionCapability {
  name: string
  signature: string

  // Parsed from ABI - exact types
  parameters: {
    name: string
    type: SolidityType  // uint256, address, address[], bytes32, etc.
    description?: string
  }[]

  // Inferred from function patterns
  requiresApproval?: boolean
  requiresAdmin?: boolean
  requiresValue?: boolean  // payable
  isReadOnly: boolean

  // Example of correct invocation
  exampleCall?: {
    args: unknown[]
    value?: string
  }
}
```

### Layer 2: Web3 Primitives Knowledge

Built-in understanding of common patterns:

```typescript
const WEB3_PRIMITIVES = {
  // ERC20 patterns
  erc20: {
    transfer: {
      pattern: "transfer(address to, uint256 amount)",
      requiresBalance: true,
      amountInSmallestUnit: true,
    },
    approve: {
      pattern: "approve(address spender, uint256 amount)",
      mustCallBefore: ["transferFrom", "swap*"],
    },
    balanceOf: {
      pattern: "balanceOf(address account)",
      returns: "token balance in smallest unit",
    }
  },

  // DEX patterns
  dexRouter: {
    swapExactETHForTokens: {
      pattern: "swapExactETHForTokens(uint256 amountOutMin, address[] path, address to, uint256 deadline)",
      requiresValue: true,
      pathFormat: "[WETH_ADDRESS, TOKEN_OUT_ADDRESS]",
      deadlineTypically: "block.timestamp + 20 minutes",
    },
    getAmountsOut: {
      pattern: "getAmountsOut(uint256 amountIn, address[] path)",
      isQuote: true,
      pathFormat: "[TOKEN_IN_ADDRESS, TOKEN_OUT_ADDRESS]",
    }
  },

  // Access control patterns
  accessControl: {
    onlyOwner: "Function will revert if caller is not owner()",
    onlyRole: "Function requires specific role",
  }
}
```

### Layer 3: Structured Output Parsing

**Use `generateObject` instead of `generateText` for function calls.**

```typescript
import { generateObject } from 'ai'
import { z } from 'zod'

// Dynamic schema based on function ABI
function buildFunctionCallSchema(fn: FunctionCapability) {
  const paramSchemas: Record<string, z.ZodType> = {}

  for (const param of fn.parameters) {
    paramSchemas[param.name] = solidityTypeToZod(param.type)
  }

  return z.object({
    contractAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    functionName: z.literal(fn.name),
    args: z.object(paramSchemas),
    value: fn.requiresValue ? z.string() : z.string().optional(),
  })
}

// Map Solidity types to Zod schemas
function solidityTypeToZod(type: string): z.ZodType {
  if (type === 'address') {
    return z.string().regex(/^0x[a-fA-F0-9]{40}$/)
  }
  if (type === 'address[]') {
    return z.array(z.string().regex(/^0x[a-fA-F0-9]{40}$/))
  }
  if (type.startsWith('uint') || type.startsWith('int')) {
    return z.string().regex(/^\d+$/)  // Always string for big numbers
  }
  if (type === 'bool') {
    return z.boolean()
  }
  if (type === 'bytes' || type.startsWith('bytes')) {
    return z.string().regex(/^0x[a-fA-F0-9]*$/)
  }
  if (type === 'string') {
    return z.string()
  }
  // Arrays
  if (type.endsWith('[]')) {
    return z.array(solidityTypeToZod(type.slice(0, -2)))
  }
  return z.unknown()
}
```

### Layer 4: Two-Phase Execution

**Phase 1: Intent Understanding (generateText)**
```
User: "Swap 0.01 BNB for USDT"
LLM: "I'll swap 0.01 BNB for USDT using the PancakeSwap router.
      First, let me get a quote..."
```

**Phase 2: Structured Function Call (generateObject)**
```typescript
const call = await generateObject({
  model: openai("gpt-4o"),
  schema: buildFunctionCallSchema(getAmountsOutFn),
  prompt: `
    Generate the function call for: getAmountsOut
    Amount: 10000000000000000 (0.01 BNB in wei)
    Path: WBNB -> USDT
    WBNB address: 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd
    USDT address: 0x337610d27c682e347c9cd60bd4b3b107c9d34ddd
  `
})

// Result is guaranteed to match schema:
// {
//   contractAddress: "0xD99D1c33F9fC3444f8101754aBC46c52416550D1",
//   functionName: "getAmountsOut",
//   args: {
//     amountIn: "10000000000000000",
//     path: ["0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", "0x337610d27c682e347c9cd60bd4b3b107c9d34ddd"]
//   }
// }
```

### Layer 5: Multi-Chain Support

```typescript
interface ChainConfig {
  id: number
  name: string
  rpc: string
  explorer: {
    url: string
    apiUrl: string
    apiKey: string
  }
  nativeToken: {
    symbol: string
    decimals: number
    wrappedAddress: `0x${string}`
  }
}

const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  1: { /* Ethereum */ },
  56: { /* BSC */ },
  97: { /* BSC Testnet */ },
  137: { /* Polygon */ },
  42161: { /* Arbitrum */ },
  // Any EVM chain with etherscan-compatible API
}
```

---

## Implementation Plan

### Phase 1: Standalone Test Suite (TODAY)
- Create `/tests/agent-parsing/` with conversation simulations
- Test every function type: simple, arrays, nested, payable
- Verify encoding produces correct calldata
- Test against actual AutonomifyExecutor on testnet

### Phase 2: Structured Output Migration
- Replace `generateText` tool calls with `generateObject`
- Build dynamic Zod schemas from ABI
- Guarantee type-safe function calls

### Phase 3: Contract Intelligence
- Extract capabilities from ABI
- Detect access control patterns
- Build relationship graphs between contracts

### Phase 4: System Prompt Refactor
- Remove hardcoded patterns
- Generate dynamic context from ContractIntelligence
- Include web3 primitives knowledge

### Phase 5: Multi-Chain
- Abstract chain config
- Support any etherscan-compatible API
- Dynamic WETH/native token handling

---

## Test Scenarios

```typescript
const TEST_SCENARIOS = [
  // Basic read
  {
    input: "What's my USDT balance?",
    expected: {
      fn: "balanceOf",
      args: { account: "AGENT_WALLET" }
    }
  },

  // DEX quote
  {
    input: "How much USDT for 0.01 BNB?",
    expected: {
      fn: "getAmountsOut",
      args: {
        amountIn: "10000000000000000",
        path: ["WBNB", "USDT"]  // addresses
      }
    }
  },

  // Swap execution
  {
    input: "Swap 0.01 BNB for USDT",
    expected: {
      fn: "swapExactETHForTokens",
      args: {
        amountOutMin: "0",  // or calculated with slippage
        path: ["WBNB", "USDT"],
        to: "AGENT_WALLET",
        deadline: "FUTURE_TIMESTAMP"
      },
      value: "0.01"
    }
  },

  // Access control awareness
  {
    input: "Call the admin function",
    expected: {
      response: "I cannot call adminFunction because only the contract owner can execute it, and my wallet is not the owner."
    }
  },

  // Cross-contract understanding
  {
    input: "Swap 100 USDT for BNB",
    expected: {
      // Should recognize need for approval first
      steps: [
        { fn: "approve", contract: "USDT", args: { spender: "ROUTER", amount: "100..." } },
        { fn: "swapExactTokensForETH", contract: "ROUTER", args: {...} }
      ]
    }
  }
]
```

---

## Success Criteria

1. **99% argument parsing accuracy** - Structured output guarantees correct types
2. **Zero hardcoded contract patterns** - Everything derived from ABI + primitives
3. **Access control awareness** - Agent knows what it can/cannot call
4. **Cross-contract reasoning** - Understands token approvals, swap paths
5. **Multi-chain ready** - Same agent logic works on any EVM chain
6. **Comprehensive test coverage** - Every function pattern tested offline
