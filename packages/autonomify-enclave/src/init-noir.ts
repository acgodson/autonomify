import { Noir, type CompiledCircuit } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@aztec/bb.js";
import circuit from "../circuit/autonomify.json" assert { type: "json" };

export interface NoirInstances {
    noir: Noir;
    backend: UltraHonkBackend;
}

export async function initializeNoir(): Promise<NoirInstances> {
    console.log("Initializing Noir circuit...");

    const backend = new UltraHonkBackend(circuit.bytecode);
    const noir = new Noir(circuit as CompiledCircuit);

    console.log("✓ Noir circuit initialized");
    console.log(`  Circuit size: ${circuit.bytecode.length} bytes`);

    return { noir, backend };
}
