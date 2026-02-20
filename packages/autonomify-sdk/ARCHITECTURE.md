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
│   │   ├── executor.ts       # Executor contract config
│   │   └── utils.ts          # Shared utilities
│   │
│   ├── tool/
│   │   ├── index.ts          # Main tool export
│   │   ├── schema.ts         # Zod schema generator
│   │   └── handler.ts        # Execution handler
│   │
│   ├── adapters/
│   │   ├── vercel-ai.ts      # Vercel AI SDK adapter
│   │   └── openai.ts         # OpenAI SDK adapter
│   │
│   ├── chains/
│   │   └── index.ts          # Multi-chain config
│   │
│   └── knowledge/
│       ├── patterns.ts       # Contract pattern detection
│       └── metadata.ts       # Function metadata extraction
│
├── prompts/
│   └── agent.md              # Single consolidated prompt
│
└── test/
    ├── encoder.test.ts
    └── tool.test.ts
```

## Core Concepts

### The One Tool

```typescript
import { createTool } from 'autonomify-sdk'

const tool = createTool({
  contracts: exportData,
  agentId: '0x...',
  sign: async (tx) => wallet.sendTransaction(tx)
})
```

### Adapters

Thin wrappers that format the tool for specific SDKs:

```typescript
// Vercel AI
import { forVercelAI } from 'autonomify-sdk/adapters'
const { tool, prompt } = forVercelAI(config)

// OpenAI
import { forOpenAI } from 'autonomify-sdk/adapters'
const { tools, handler } = forOpenAI(config)

// Raw (for custom frameworks)
import { createTool } from 'autonomify-sdk'
const tool = createTool(config)
```

## File Naming Convention

- `kebab-case.ts` for all files
- No redundant prefixes (e.g., `tool.ts` not `autonomify-tool.ts`)
- Singular nouns for modules (e.g., `chain` not `chains`)
- `index.ts` for barrel exports only

## Scaling Strategy

### Adding a New Chain

1. Add chain config to `chains/index.ts`
2. Deploy executor contract
3. Add executor address to `core/executor.ts`

### Adding a New Adapter

1. Create adapter in `adapters/`
2. Export from `index.ts`
3. No core changes needed

### Adding Contract Patterns

1. Add pattern to `knowledge/patterns.ts`
2. No other changes needed
