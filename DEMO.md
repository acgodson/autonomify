# Autonomify Demo - Chainlink Hackathon

## Overview

Autonomify enables autonomous AI agents to execute blockchain transactions securely using Chainlink's CRE (Chainlink Runtime Environment) with zero-knowledge proof verification.

**Chain:** Base Sepolia (84532)
**Agent:** Telegram Bot
**Explorer:** https://sepolia.basescan.org

---

## Case Study 0: Introduction

First 3-4 messages to introduce the agent and its capabilities.

### Conversation Flow

```
User: Hey, what can you do?

Agent: I can help you with the following tasks on the Base Sepolia blockchain:
- Check your LINK or WETH token balance
- Transfer LINK or WETH tokens
- Approve spending of tokens
- Quote token swaps using Uniswap V3 Quoter
- Execute token swaps using Uniswap V3 Router

If you have any specific requests, feel free to ask!

User: What tokens do I have available?

Agent: I have the following tokens available:
- ChainLink Token (LINK)
- Wrapped Ether (WETH)

Would you like to do something with these tokens?

User: How do you execute transactions securely?

Agent: To execute transactions securely, I follow these steps:
1. Verification: Ensure the contract address is from the approved list
2. Confirmation: Before executing any write operation, I confirm details with you
3. Details: Provide clear details including amounts in human-readable format
4. Execution: Use Chainlink CRE with zero-knowledge proof verification
5. Feedback: Provide transaction hash and explorer link for verification

This process ensures transparency and security in all transactions.
```

---

## Case Study 1: Simple Operation - LINK Transfer

Demonstrates basic token operations: balance check, simulate, and transfer.

### Verified Transaction
- **TX Hash:** `0x4192eb5a3d08ff486107a92f814271d9f48237e093bc378524b11ea2dfd70a31`
- **Explorer:** https://sepolia.basescan.org/tx/0x4192eb5a3d08ff486107a92f814271d9f48237e093bc378524b11ea2dfd70a31

### Conversation Flow

```
User: What's my LINK balance?

Agent: [Calls balanceOf on LINK contract]
Your LINK balance is 0.85 LINK

User: I want to transfer 0.01 LINK to 0xf2750684eb187fF9f82e2F980f6233707ef5768c. First simulate it.

Agent: [Calls autonomify_simulate via CRE]
🔬 Simulation Results:
✅ Transaction would succeed
- Gas Estimate: 2,155,373 units

Would you like to proceed with the actual transfer?

User: Yes, execute the transfer

Agent: [Executes via CRE with ZK verification]
Before proceeding, please confirm:
- Amount: 0.01 LINK
- Recipient: 0xf275...68c

User: Confirm

Agent: ✅ Transaction successful!
TX Hash: 0x4192eb5a3d08ff486107a92f814271d9f48237e093bc378524b11ea2dfd70a31
Explorer: https://sepolia.basescan.org/tx/0x4192eb5a...
```

---

## Case Study 2: DeFi Operation - Quote and Swap

Demonstrates DEX operations with simulation.

### Conversation Flow

```
User: Get me a quote to swap 0.1 LINK for WETH

Agent: [Calls QuoterV2.quoteExactInputSingle with tuple params]
📊 Quote for swapping 0.1 LINK → WETH:
- Amount Out: ~0.00000528 WETH
- Gas Estimate: 79,195 units

Would you like to proceed with this swap?

User: Simulate the swap first

Agent: [Calls autonomify_simulate]
🔬 Simulation Results:
✅ Transaction would succeed
- Gas Estimate: 2,172,317 units
- Policy satisfied: ✓

Would you like to execute the actual swap?

User: Yes, proceed

Agent: [Executes via CRE → SwapRouter02]
✅ Swap successful!

TX Hash: 0x...
Explorer: https://sepolia.basescan.org/tx/0x...
```

---

## Technical Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User (Telegram)                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Autonomify Agent (AI + Tools)              │
│  • Natural language understanding                       │
│  • Contract-aware (only uses approved contracts)        │
│  • Amount conversion (human ↔ wei)                      │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│                   Operation Types                       │
├─────────────────────────────────────────────────────────┤
│  READ         │ Direct RPC call (balanceOf, quotes)     │
│  SIMULATE     │ CRE + Tenderly (dry run, gas estimate)  │
│  EXECUTE      │ CRE + ZK Proof (actual transaction)     │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│              Chainlink CRE Workflow                     │
│  1. Encode transaction calldata                         │
│  2. Request ZK proof from enclave                       │
│  3. Verify delegation and policy constraints            │
│  4. Submit to CRE Forwarder                            │
│  5. Execute on-chain with proof verification           │
└─────────────────────────────────────────────────────────┘
```

---

## Contracts Used

| Contract | Address | Purpose |
|----------|---------|---------|
| LINK | `0xE4aB69C077896252FAFBD49EFD26B5D171A32410` | Token transfer |
| WETH | `0x4200000000000000000000000000000000000006` | Wrapped native |
| QuoterV2 | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` | Swap quotes |
| SwapRouter02 | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` | Execute swaps |
| AutonomifyExecutor | `0xD44def7f75Fea04B402688FF14572129D2BEeb05` | CRE executor |

---

## Key Demo Points

1. **Delegated Execution** - Agent acts on behalf of user without private keys
2. **Contract Whitelist** - Agent can ONLY use pre-approved contracts
3. **ZK Verification** - Every transaction verified via zero-knowledge proofs
4. **Simulation First** - Test transactions via Tenderly before committing
5. **Tuple Encoding** - Complex DeFi operations (structs) work correctly
6. **Explorer Links** - All transactions verifiable on-chain

---

## Test Commands

The test harness supports multiple output modes and scenario filtering.

```bash
# List all available scenarios
pnpm tsx scripts/test-agent-conversation.ts --list

# Show help and usage
pnpm tsx scripts/test-agent-conversation.ts --help
```

### Demo Recording Commands

Run these commands sequentially for the demo video:

```bash
# Case Study 0: Introduction (3 scenarios)
pnpm tsx scripts/test-agent-conversation.ts "intro"

# Case Study 1: Token Operations
pnpm tsx scripts/test-agent-conversation.ts "balance"
pnpm tsx scripts/test-agent-conversation.ts "Simulate transfer"
pnpm tsx scripts/test-agent-conversation.ts "E2E transfer"

# Case Study 2: DeFi Operations
pnpm tsx scripts/test-agent-conversation.ts "quote"
pnpm tsx scripts/test-agent-conversation.ts "Full simulate"
```

### Verbose Mode (for debugging)

```bash
# Show detailed tool calls and results
pnpm tsx scripts/test-agent-conversation.ts --verbose "balance"
```

### Run with Specific Agent

```bash
# Specify agent ID directly
pnpm tsx scripts/test-agent-conversation.ts --agent=3dd8bd62-9b85-415f-a5b0-8ddacd434828 "quote"
```

### Quick Verification

```bash
# Run end-to-end flow verification
pnpm tsx scripts/verify-demo-flows.ts
```
