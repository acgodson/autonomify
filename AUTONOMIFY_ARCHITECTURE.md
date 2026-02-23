# Autonomify Architecture: ZK-Verified Delegated Execution via Chainlink CRE

## Overview

Autonomify enables AI agents to execute blockchain transactions on behalf of users without holding funds or keys. The system combines:

- **Chainlink CRE**: Orchestrates the flow, fetches policies, calls ZK prover, submits on-chain
- **ZK Proofs**: Privacy-preserving policy verification (Noir + UltraHonk)
- **MetaMask Delegation Framework**: ERC-7710 delegations for authorized execution
- **AWS Nitro Enclave**: Secure ZK proof generation environment
- **User's Smart Account**: Holds funds, is always `msg.sender` at target contracts

---

## Current Implementation Status

### Completed Components

| Component | Status | Details |
|-----------|--------|---------|
| Noir ZK Circuit | ✅ Done | `circuits/noir/` - Policy verification with max_amount, time_window, whitelist |
| HonkVerifier Contract | ✅ Done | Generated Solidity verifier from Noir circuit |
| AutonomifyExecutor | ✅ Done | `contracts/src/AutonomifyExecutor.sol` - ZK verification + delegation redemption |
| AWS Nitro Enclave | ✅ Done | `packages/autonomify-enclave/` - Secure proof generation |
| Enclave HTTP Proxy | ✅ Done | Routes HTTP to vsock for enclave communication |
| Verification Service | ✅ Done | Off-chain proof verification for testing |
| Delegation Test Page | ✅ Done | `app/src/app/test-delegation/` - Pimlico gas-sponsored flow |
| Open Delegation | ✅ Done | No caveats - ZK proof is the only gatekeeper |

### Deployed Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| HonkVerifier | `0x2118134A7e8F4A34E5a8411eA5182F95e7fc56De` |
| AutonomifyExecutor | `0x3BDF07B1F57503b9A881ecd14F965117EE31A8cf` |
| DelegationManager | `0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3` |

### Enclave Deployment

| Resource | Details |
|----------|---------|
| EC2 Instance | `35.159.224.254` |
| Enclave CID | 16 |
| HTTP Endpoint | `http://35.159.224.254:8001` |
| Memory | 1560 MiB |
| CPUs | 2 |

---

## Key Insight: No Agent Wallet Needed

Traditional approach:
```
User → Agent Wallet (holds keys) → Executes on-chain
```

Autonomify approach:
```
User → CRE (no keys) → Executor Contract (delegate) → User's Smart Account executes
```

The AI agent is purely an interface. CRE handles orchestration and on-chain submission.

---

## The Delegation Model

### Who Is What

| Entity | Role |
|--------|------|
| User's Smart Account | Holds funds, grants delegation, is `msg.sender` at target |
| AutonomifyExecutor | The authorized delegate, verifies ZK proofs, redeems delegation |
| Chainlink CRE | Orchestrates flow, fetches policies, requests proof, submits tx |
| Autonomify App | User interface (Telegram bot), triggers CRE workflows |
| Nitro Enclave | Stores policies per (userAddress, agentId), generates ZK proofs |

### Delegation Setup (One-Time)

User signs **open delegation** ONCE:
```
Delegation {
  delegator: User's Smart Account
  delegate: AutonomifyExecutor contract
  caveats: []  // No on-chain caveats - ZK proof enforces all policies
  authority: ROOT_AUTHORITY
}
```

This signature is stored and reused for all future executions.

---

## ZK Policy System

### Policy Configuration

Policies are stored in the Nitro Enclave per `(userAddress, agentId)`:

```typescript
interface PolicyConfig {
  maxAmount?: {
    enabled: boolean;
    limit: number;      // In wei
  };
  timeWindow?: {
    enabled: boolean;
    startHour: number;  // 0-23
    endHour: number;    // 0-23
  };
  whitelist?: {
    enabled: boolean;
    root?: string;      // Merkle root
    path?: string[];    // Merkle proof path
    index?: number;     // Leaf index
  };
}
```

### Proof Public Inputs

The ZK proof exposes three public inputs:

| Input | Description |
|-------|-------------|
| `policySatisfied` | `1` if all enabled policies pass, `0` otherwise |
| `nullifier` | Unique per transaction (prevents replay) |
| `userAddressHash` | Keccak256 hash of user's address |

### Nullifier Computation

```
nullifier = PedersenHash(timestamp, recipient, amount, userAddressHash)
```

This ensures each transaction has a unique nullifier that can't be reused.

---

## Complete Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 1: USER REQUEST                                                       │
│                                                                             │
│  User on Telegram: "Send 50 USDC to alice"                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 2: AUTONOMIFY APP                                                     │
│                                                                             │
│  • Receives Telegram webhook                                                │
│  • Parses user intent via LLM                                               │
│  • Constructs calldata: USDC.transfer(alice, 50e6)                          │
│  • Looks up user's permissionsContext (stored from one-time setup)          │
│  • Triggers CRE workflow via HTTP                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 3: CRE WORKFLOW                                                       │
│                                                                             │
│  Runs on Chainlink DON (decentralized)                                      │
│                                                                             │
│  A. EXTRACT TRANSACTION PARAMS                                              │
│     • Parse calldata to extract: amount, recipient, timestamp               │
│                                                                             │
│  B. CALL NITRO ENCLAVE                                                      │
│     • POST to http://enclave:8001                                           │
│     • Request: { type: "GENERATE_PROOF", userAddress, agentId, txData }     │
│     • Enclave fetches stored policy for (userAddress, agentId)              │
│     • Returns: { proof, publicInputs }                                      │
│                                                                             │
│  C. SUBMIT ON-CHAIN                                                         │
│     • Call AutonomifyExecutor.executeWithProof(...)                         │
│     • CRE handles gas via DON funding                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 4: AUTONOMIFY EXECUTOR (On-Chain)                                     │
│                                                                             │
│  function executeWithProof(                                                 │
│    bytes proof,                                                             │
│    bytes32[] publicInputs,   // [policySatisfied, nullifier, userHash]      │
│    bytes permissionsContext,                                                │
│    Execution[] executions                                                   │
│  ) external {                                                               │
│                                                                             │
│    // 1. Verify ZK proof                                                    │
│    require(zkVerifier.verify(proof, publicInputs));                         │
│                                                                             │
│    // 2. Check policy satisfied                                             │
│    require(publicInputs[0] == 1);                                           │
│                                                                             │
│    // 3. Check nullifier not used (replay protection)                       │
│    require(!usedNullifiers[nullifier]);                                     │
│    usedNullifiers[nullifier] = true;                                        │
│                                                                             │
│    // 4. Redeem delegation via DelegationManager                            │
│    _redeemDelegation(permissionsContext, executions);                       │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 5: DELEGATION MANAGER                                                 │
│                                                                             │
│  • Validates permissionsContext                                             │
│  • Checks: Is AutonomifyExecutor the authorized delegate? YES               │
│  • Calls User's Smart Account to execute                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  STEP 6: USER'S SMART ACCOUNT                                               │
│                                                                             │
│  • Executes: USDC.transfer(alice, 50e6)                                     │
│  • msg.sender = User's Smart Account                                        │
│  • Tokens move FROM user's balance                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Enclave API

### Health Check
```bash
curl -X POST http://35.159.224.254:8001 \
  -H 'Content-Type: application/json' \
  -d '{"type":"HEALTH_CHECK"}'
```

Response:
```json
{"status":"healthy","timestamp":"...","policyCount":0}
```

### Store Policy
```bash
curl -X POST http://35.159.224.254:8001 \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "STORE_POLICY_CONFIG",
    "userAddress": "0x...",
    "agentId": "agent-uuid",
    "policyConfig": {
      "maxAmount": {"enabled": true, "limit": 100000000000000000000},
      "timeWindow": {"enabled": false, "startHour": 0, "endHour": 24},
      "whitelist": {"enabled": false}
    }
  }'
```

### Generate Proof
```bash
curl -X POST http://35.159.224.254:8001 \
  -H 'Content-Type: application/json' \
  -d '{
    "type": "GENERATE_PROOF",
    "userAddress": "0x...",
    "agentId": "agent-uuid",
    "txData": {
      "amount": "10000000000000000000",
      "recipient": "0x...",
      "timestamp": 1234567890,
      "userAddress": "0x..."
    }
  }'
```

Response:
```json
{
  "success": true,
  "proof": "0x...",
  "publicInputs": {
    "policySatisfied": "0x...01",
    "nullifier": "0x...",
    "userAddressHash": "0x..."
  }
}
```

---

## Security Properties

| Property | How Achieved |
|----------|--------------|
| Agent can't steal funds | Agent has no keys, Executor has no funds |
| Policies enforced | ZK proof verified on-chain |
| No replay attacks | Nullifier tracked in Executor contract |
| User retains control | Can revoke delegation anytime |
| Decentralized execution | CRE runs on Chainlink DON |
| Policy privacy | Policies stored in Nitro Enclave, only proof is public |
| Secure proof generation | AWS Nitro Enclave attestation |

---

## Project Structure

```
autonomify/
├── app/                          # Next.js application
│   ├── src/
│   │   ├── app/                  # Pages and API routes
│   │   │   ├── api/              # Backend APIs
│   │   │   │   ├── agents/       # Agent CRUD
│   │   │   │   └── telegram/     # Webhook handlers
│   │   │   └── test-delegation/  # Delegation test UI
│   │   ├── lib/
│   │   │   ├── agent/            # Agent business logic
│   │   │   ├── channels/         # Telegram, Discord adapters
│   │   │   ├── contracts/        # ABI fetching
│   │   │   └── db/               # Database (Drizzle + Neon)
│   │   └── contexts/             # React contexts
│   └── package.json
│
├── circuits/
│   └── noir/
│       ├── src/main.nr           # Noir policy circuit
│       ├── Nargo.toml
│       └── target/
│           ├── autonomify.json   # Compiled circuit
│           └── autonomify.sol    # Generated Solidity verifier
│
├── contracts/
│   └── src/
│       ├── AutonomifyExecutor.sol
│       ├── interfaces/
│       │   └── IDelegationManager.sol
│       └── lib/
│           └── ExecutionLib.sol
│
├── packages/
│   ├── autonomify-enclave/       # Nitro Enclave package
│   │   ├── src/
│   │   │   ├── server.ts         # Vsock server
│   │   │   ├── handler.ts        # Request router
│   │   │   ├── proof-generator.ts
│   │   │   ├── proof-service.ts
│   │   │   ├── policy-store.ts
│   │   │   └── protocol.ts       # Request/Response types
│   │   ├── circuit/
│   │   │   └── autonomify.json
│   │   ├── bb-crs-cache/         # Barretenberg CRS
│   │   ├── Dockerfile.enclave
│   │   ├── deploy.sh             # One-click deployment
│   │   └── http-proxy.py         # HTTP to vsock proxy
│   │
│   └── autonomify-sdk/           # SDK for integrations
│
└── .github/
    └── workflows/
        └── build-enclave.yml     # Docker build for enclave
```

---

## Next Steps

### Immediate
1. **Chainlink CRE Integration** - Set up CRE as orchestrator
2. **Policy Storage** - Database for user policies (sync to enclave)
3. **End-to-End Test** - Full flow: Telegram → CRE → Enclave → On-chain

### Future
1. Multi-chain support (deploy Executor per chain)
2. CCIP integration for cross-chain execution
3. Policy UI in dashboard
4. Rate limiting and spending caps

---

## Tech Stack

- **Chainlink CRE**: Workflow orchestration, on-chain writes
- **AWS Nitro Enclave**: Secure ZK proof generation
- **Noir + UltraHonk**: ZK circuit and prover
- **MetaMask Smart Accounts Kit**: ERC-7710 delegation framework
- **Solidity**: Executor contract, HonkVerifier
- **Next.js**: Web dashboard
- **Telegram Bot API**: User interface
- **Pimlico**: Gas sponsorship (paymaster)
- **Neon PostgreSQL**: Database
- **Drizzle ORM**: Type-safe database access
