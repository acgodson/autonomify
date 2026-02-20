# Autonomify

**Turn any verified BNB contract into an AI agent.**

Autonomify is a universal SDK that lets AI agents execute onchain transactions securely. Paste a contract address, get a tool the LLM can use, bring your own agentic wallet — or let us host one for you.

## Contents

- [Problem & Solution](docs/PROJECT.md)
- [Architecture & Setup](docs/TECHNICAL.md)
- [Deployments](bsc.address)

## Quick Start

### Option 1: Hosted Telegram Bot (Easiest)

1. Go to [autonomify.vercel.app](https://autonomify.vercel.app)
2. Paste a contract address → Click "Launch Agent" → Choose "Telegram"
3. Enter your bot token (from [@BotFather](https://t.me/BotFather))
4. Start chatting with your bot — we handle the wallet ([via Privy](https://docs.privy.io)) and execution

### Option 2: Self-hosted Agent

1. Go to [autonomify.vercel.app](https://autonomify.vercel.app)
2. Paste a contract address → Click "Launch Agent" → Choose "Self-hosted"
3. Download your `autonomify.json` config file
4. Scaffold your project:

```bash
npx create-autonomify my-agent
# Paste your autonomify.json when prompted
```

```typescript
import { createAutonomifyTool, buildSystemPrompt } from "autonomify-sdk"
import config from "./autonomify.json"

const tool = createAutonomifyTool({
  export: config,
  agentId: config.agentId,
  signAndSend: async (tx) => wallet.sendTransaction(tx)
})

const { text } = await generateText({
  model: openai("gpt-4o"),
  tools: { autonomify_execute: tool },
  system: buildSystemPrompt(config),
  prompt: "Transfer 100 USDT to 0x..."
})
```

## What We Built

| Component | Description |
|-----------|-------------|
| **autonomify-sdk** | Universal tool for AI agents to call any contract |
| **create-autonomify** | CLI to scaffold agent projects (Vercel AI / OpenAI) |
| **autonomify-app** | Dashboard + API + hosted Telegram agents as reference implementations |
| **AutonomifyExecutor** | On-chain router with audit trail |

## Repository

```
├── packages/
│   ├── autonomify-sdk/        # npm package
│   └── create-autonomify/     # CLI tool
├── autonomify-app/            # Web app + API
├── contracts/                 # Solidity
└── docs/                      # PROJECT.md, TECHNICAL.md, deployed addresses
```

## Links

- **Live Demo**: [autonomify.vercel.app](https://autonomify.vercel.app)
- **Executor Contract**: [`0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C`](https://testnet.bscscan.com/address/0xC62AeB774DF09a6C2554dC19f221BDc4DFfAD93C)

## License

MIT
