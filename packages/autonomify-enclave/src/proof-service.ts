import type { Noir } from "@noir-lang/noir_js";
import type { UltraHonkBackend } from "@aztec/bb.js";
import { generatePolicyProof, type PolicyConfig, type TransactionData, type ProofResult } from "./proof-generator.js";
import { policyStore } from "./policy-store.js";

interface ProofServiceConfig {
    noir: Noir;
    backend: UltraHonkBackend;
}

class ProofService {
    private noir: Noir | null = null;
    private backend: UltraHonkBackend | null = null;
    private initialized = false;

    async initialize(config: ProofServiceConfig): Promise<void> {
        this.noir = config.noir;
        this.backend = config.backend;
        this.initialized = true;
        console.log("✓ Proof service initialized");
    }

    isInitialized(): boolean {
        return this.initialized;
    }

    async generateProof(
        userAddress: string,
        agentId: string,
        txData: TransactionData
    ): Promise<ProofResult> {
        if (!this.initialized || !this.noir || !this.backend) {
            throw new Error("Proof service not initialized");
        }

        const policyConfig = policyStore.get(userAddress, agentId);
        if (!policyConfig) {
            throw new Error(`No policy config found for ${userAddress}:${agentId}`);
        }

        console.log(`Generating proof for ${userAddress}:${agentId}`);
        console.log(`  Amount: ${txData.amount}`);
        console.log(`  Recipient: ${txData.recipient}`);
        console.log(`  Timestamp: ${txData.timestamp}`);

        const result = await generatePolicyProof(
            this.noir,
            this.backend,
            txData,
            policyConfig
        );

        console.log(`✓ Proof generated`);
        console.log(`  Nullifier: ${result.publicInputs.nullifier}`);
        console.log(`  Policy Satisfied: ${result.publicInputs.policySatisfied}`);

        return result;
    }

    storePolicyConfig(
        userAddress: string,
        agentId: string,
        policyConfig: PolicyConfig
    ): void {
        policyStore.store(userAddress, agentId, policyConfig);
    }
}

export const proofService = new ProofService();
