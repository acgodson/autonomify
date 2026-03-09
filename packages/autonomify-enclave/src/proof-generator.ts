import type { Noir } from "@noir-lang/noir_js";
import type { UltraHonkBackend } from "@aztec/bb.js";
import { Barretenberg, Fr } from "@aztec/bb.js";
import { ethers } from "ethers";

export interface PolicyConfig {
    maxAmount?: {
        enabled: boolean;
        limit: number;
    };
    timeWindow?: {
        enabled: boolean;
        startHour: number;
        endHour: number;
    };
    whitelist?: {
        enabled: boolean;
        root?: string;
        path?: string[];
        index?: number;
    };
}

export interface TransactionData {
    amount: bigint;
    recipient: string;
    timestamp: number;
    userAddress: string;
}

export interface ProofResult {
    proof: Uint8Array;
    publicInputs: {
        policySatisfied: string;
        nullifier: string;
        userAddressHash: string;
    };
}

export async function generatePolicyProof(
    noir: Noir,
    backend: UltraHonkBackend,
    tx: TransactionData,
    config: PolicyConfig
): Promise<ProofResult> {
    try {
        console.log("[PROOF-GEN] Step 1: Computing user address hash");
        const fullHash = ethers.keccak256(
            ethers.solidityPacked(["address"], [tx.userAddress])
        );
        const userAddressHash = fullHash.substring(0, 64);
        console.log("[PROOF-GEN] User address hash computed:", userAddressHash.substring(0, 20) + "...");

        console.log("[PROOF-GEN] Step 2: Initializing Barretenberg (single-threaded)");
        const bb = await Barretenberg.new({ threads: 1 });
        console.log("[PROOF-GEN] Barretenberg initialized successfully");

        console.log("[PROOF-GEN] Step 3: Converting wei to scaled units for u64 compatibility");
        // Use 10^8 divisor to maintain precision for sub-token amounts while fitting in u64
        // This gives us 10 decimal places of precision
        // u64 max is ~18.4 x 10^18, so with 10^8 divisor we can handle amounts up to ~1.8 x 10^11 tokens
        const SCALE_DIVISOR = BigInt(10 ** 8);
        const scaledAmount = tx.amount / SCALE_DIVISOR;
        const scaledMaxAmount = BigInt(config.maxAmount?.limit || 0) / SCALE_DIVISOR;
        console.log("[PROOF-GEN] Scaled amount:", scaledAmount.toString(), "(wei:", tx.amount.toString(), ")");
        console.log("[PROOF-GEN] Scaled max amount:", scaledMaxAmount.toString(), "(wei:", config.maxAmount?.limit || 0, ")");

        // CRITICAL: Early policy enforcement check BEFORE proof generation
        if (config.maxAmount?.enabled) {
            console.log("[PROOF-GEN] Checking maxAmount policy...");
            console.log("[PROOF-GEN]   Transaction amount (wei):", tx.amount.toString());
            console.log("[PROOF-GEN]   Policy limit (wei):", config.maxAmount.limit.toString());
            if (tx.amount > BigInt(config.maxAmount.limit)) {
                const errorMsg = `Policy violation: amount ${tx.amount.toString()} exceeds limit ${config.maxAmount.limit.toString()}`;
                console.log("[PROOF-GEN] ❌", errorMsg);
                throw new Error(errorMsg);
            }
            console.log("[PROOF-GEN] ✓ Amount within limit");
        }

        console.log("[PROOF-GEN] Step 4: Creating Field elements");
        const timestampFr = new Fr(BigInt(tx.timestamp));
        console.log("[PROOF-GEN] Timestamp Fr created");
        
        const recipientFr = new Fr(BigInt(tx.recipient));
        console.log("[PROOF-GEN] Recipient Fr created");
        
        const amountFr = new Fr(scaledAmount);
        console.log("[PROOF-GEN] Amount Fr created (scaled)");
        
        const userHashFr = new Fr(BigInt(userAddressHash));
        console.log("[PROOF-GEN] User hash Fr created");

        console.log("[PROOF-GEN] Step 5: Computing Pedersen hash for nullifier");
        const nullifierFr = await bb.pedersenHash(
            [timestampFr, recipientFr, amountFr, userHashFr],
            0
        );
        const nullifier = nullifierFr.toString();
        console.log("[PROOF-GEN] Nullifier computed:", nullifier.substring(0, 20) + "...");

        console.log("[PROOF-GEN] Step 6: Preparing circuit inputs");
        
        const inputs = {
            tx_amount: scaledAmount.toString(),
            tx_recipient: BigInt(tx.recipient).toString(),
            tx_timestamp: tx.timestamp.toString(),

            max_amount: scaledMaxAmount.toString(),
            allowed_start_hour: (config.timeWindow?.startHour || 0).toString(),
            allowed_end_hour: (config.timeWindow?.endHour || 24).toString(),

            enable_max_amount: config.maxAmount?.enabled || false,
            enable_time_window: config.timeWindow?.enabled || false,
            enable_whitelist: config.whitelist?.enabled || false,

            whitelist_root: config.whitelist?.root || "0",
            whitelist_path: config.whitelist?.path || ["0", "0"],
            whitelist_index: (config.whitelist?.index || 0).toString(),

            policy_satisfied: "1",
            nullifier: nullifier,
            user_address_hash: userAddressHash,
        };
        console.log("[PROOF-GEN] Circuit inputs prepared");

        console.log("[PROOF-GEN] Step 7: Executing Noir circuit");
        const { witness } = await noir.execute(inputs);
        console.log("[PROOF-GEN] Noir circuit executed, witness generated");

        console.log("[PROOF-GEN] Step 8: Generating proof with backend");
        const { proof, publicInputs } = await backend.generateProof(witness, {
            keccak: true,
        });
        console.log("[PROOF-GEN] Proof generated successfully, length:", proof.length);

        console.log("[PROOF-GEN] Step 9: Cleaning up Barretenberg");
        await bb.destroy();
        console.log("[PROOF-GEN] Barretenberg destroyed");

        console.log("[PROOF-GEN] ✓ Proof generation complete");
        return {
            proof,
            publicInputs: {
                policySatisfied: publicInputs[0],
                nullifier: publicInputs[1],
                userAddressHash: publicInputs[2],
            },
        };
    } catch (error) {
        console.error("[PROOF-GEN] ❌ ERROR:", error);
        console.error("[PROOF-GEN] Error stack:", error instanceof Error ? error.stack : "No stack trace");
        throw error;
    }
}

export function getCurrentTimestamp(): number {
    return Math.floor(Date.now() / 1000);
}
