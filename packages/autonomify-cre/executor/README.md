# Autonomify CRE Executor Workflow

Chainlink CRE workflow for executing delegated smart account transactions with ZK proof verification.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   AI Agent      │────▶│   CRE Workflow  │────▶│  Executor       │
│   (Frontend)    │     │   (This Code)   │     │  Contract       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    ▼                     ▼
            ┌───────────────┐     ┌───────────────┐
            │   Enclave     │     │   Tenderly    │
            │   (ZK Proof)  │     │   (Sim/Trace) │
            └───────────────┘     └───────────────┘
```

## Two Modes

### Simulation Mode (`simulateOnly: true`)
Pre-flight validation on Tenderly Virtual TestNet:
1. Request ZK proof from enclave
2. Simulate transaction on Virtual TestNet
3. Return gas estimate and success/failure analysis

### Execution Mode (`simulateOnly: false`)
Real on-chain execution with verification:
1. Request ZK proof from enclave
2. Create CRE signed report
3. Submit to blockchain via EVMClient
4. Fetch transaction trace for verification
5. Analyze trace and return detailed result

## Request Payload

```json
{
  "userAddress": "0x...",
  "agentId": "agent-001",
  "execution": {
    "target": "0x...",
    "calldata": "0x...",
    "value": "0"
  },
  "permissionsContext": "0x...",
  "simulateOnly": true
}
```

## Response Types

### Simulation Success
```json
{
  "success": true,
  "mode": "simulation",
  "gasEstimate": 2138890,
  "policySatisfied": "0x...01",
  "nullifier": "0x...",
  "message": "Simulation passed. Call again without simulateOnly flag to execute."
}
```

### Execution Success
```json
{
  "success": true,
  "mode": "execution",
  "txHash": "0x...",
  "txStatus": 2,
  "txStatusName": "SUCCESS",
  "gasAnalysis": {
    "total": 2100000,
    "zkVerifier": 1800000
  }
}
```

## Configuration

### config.staging.json
```json
{
  "enclaveUrl": "http://...",
  "executorAddress": "0x...",
  "authorizedKey": "0x...",
  "chainSelector": "10344971235874465080",
  "tenderlyRpc": "https://base-sepolia.gateway.tenderly.co/...",
  "virtualTestnetRpc": "https://virtual.base-sepolia.eu.rpc.tenderly.co/..."
}
```

## Commands

```bash
# Install dependencies
cd executor && bun install

# Simulate workflow
cre workflow simulate --target staging-settings \
  --http-payload "@payload.json" \
  --trigger-index 0 \
  --non-interactive \
  executor

# Deploy to CRE
cre workflow deploy --target staging-settings executor
```

## Key Features

- **ZK Proof Verification**: Noir circuit validates policy compliance
- **Tenderly Integration**: Pre-flight simulation + post-execution trace analysis
- **Error Categorization**: Infrastructure vs target contract errors
- **Gas Analysis**: Breakdown of ZK verifier and total gas usage
