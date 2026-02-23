import type { PolicyConfig, TransactionData, ProofResult } from "./proof-generator.js";

export interface StoredPolicyConfig {
    userAddress: string;
    agentId: string;
    policyConfig: PolicyConfig;
    createdAt: Date;
}

class PolicyStore {
    private policies = new Map<string, StoredPolicyConfig>();

    private getKey(userAddress: string, agentId: string): string {
        return `${userAddress.toLowerCase()}:${agentId}`;
    }

    store(userAddress: string, agentId: string, policyConfig: PolicyConfig): void {
        const key = this.getKey(userAddress, agentId);
        this.policies.set(key, {
            userAddress,
            agentId,
            policyConfig,
            createdAt: new Date(),
        });
        console.log(`✓ Stored policy config for ${userAddress}:${agentId}`);
    }

    get(userAddress: string, agentId: string): PolicyConfig | undefined {
        const key = this.getKey(userAddress, agentId);
        return this.policies.get(key)?.policyConfig;
    }

    remove(userAddress: string, agentId: string): boolean {
        const key = this.getKey(userAddress, agentId);
        const deleted = this.policies.delete(key);
        if (deleted) {
            console.log(`✓ Removed policy config for ${userAddress}:${agentId}`);
        }
        return deleted;
    }

    getPolicyCount(): number {
        return this.policies.size;
    }
}

export const policyStore = new PolicyStore();
