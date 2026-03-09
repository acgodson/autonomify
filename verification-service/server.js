import express from 'express';
import cors from 'cors';
import { UltraHonkBackend, Barretenberg, Fr } from '@aztec/bb.js';
import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

let circuit = null;
let honk = null;
let initPromise = null;
let bb = null;
let bbInitPromise = null;

async function initializeCircuit() {
  if (initPromise) {
    return initPromise;
  }

  if (!circuit) {
    initPromise = (async () => {
      try {
        // Use local circuit in Docker, fallback to monorepo path for local dev
        const localCircuit = path.resolve(__dirname, 'circuit/autonomify.json');
        const monorepoCircuit = path.resolve(__dirname, '../circuits/noir/target/autonomify.json');
        const { existsSync } = await import('fs');
        const circuitPath = existsSync(localCircuit) ? localCircuit : monorepoCircuit;
        console.log('[INIT] Loading circuit from:', circuitPath);
        const circuitData = await readFile(circuitPath, 'utf-8');
        circuit = JSON.parse(circuitData);

        console.log('[INIT] Circuit loaded, initializing backend...');

        honk = new UltraHonkBackend(circuit.bytecode, {
          threads: 1,
        });

        console.log('[INIT] Backend initialized successfully');
      } catch (error) {
        console.error('[INIT] Failed to initialize:', error);
        initPromise = null;
        throw error;
      }
    })();

    await initPromise;
  }
}

// Initialize Barretenberg for Pedersen hashing
async function initializeBarretenberg() {
  if (bbInitPromise) {
    return bbInitPromise;
  }

  if (!bb) {
    bbInitPromise = (async () => {
      try {
        console.log('[INIT] Initializing Barretenberg for Pedersen hash...');
        bb = await Barretenberg.new();
        console.log('[INIT] Barretenberg initialized successfully');
      } catch (error) {
        console.error('[INIT] Failed to initialize Barretenberg:', error);
        bbInitPromise = null;
        throw error;
      }
    })();

    await bbInitPromise;
  }
}


app.get('/health', (req, res) => {
  res.json({ status: 'ok', initialized: !!honk, bbInitialized: !!bb });
});


app.post('/verify', async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('[VERIFY] Starting verification...');
    await initializeCircuit();
    console.log(`[VERIFY] Initialization took ${Date.now() - startTime}ms`);

    if (!honk) {
      throw new Error('Backend not initialized');
    }

    const { proof, publicInputs } = req.body;

    let proofArray;
    if (proof instanceof Uint8Array) {
      proofArray = proof;
    } else if (typeof proof === 'string') {
      const hexString = proof.startsWith('0x') ? proof.slice(2) : proof;
      proofArray = new Uint8Array(Buffer.from(hexString, 'hex'));
    } else if (Array.isArray(proof)) {
      proofArray = new Uint8Array(proof);
    } else if (typeof proof === 'object' && proof !== null) {
      const values = Object.values(proof);
      proofArray = new Uint8Array(values);
    } else {
      throw new Error('Invalid proof format');
    }

    const publicInputsArray = Array.isArray(publicInputs) ? publicInputs : [publicInputs];

    console.log('[VERIFY] Proof length:', proofArray.length);
    console.log('[VERIFY] Public inputs:', publicInputsArray);

    const verifyStart = Date.now();
    const verified = await honk.verifyProof({
      proof: proofArray,
      publicInputs: publicInputsArray
    }, {
      keccak: true
    });

    console.log(`[VERIFY] Verification took ${Date.now() - verifyStart}ms`);
    console.log(`[VERIFY] Total time: ${Date.now() - startTime}ms`);
    console.log('[VERIFY] Result:', verified);

    res.json({
      verified,
      message: verified ? 'Proof verified successfully' : 'Proof verification failed'
    });
  } catch (error) {
    console.error('[VERIFY] Error after', Date.now() - startTime, 'ms:', error);
    res.status(500).json({
      verified: false,
      message: error.message || 'Verification failed',
      error: true
    });
  }
});


app.post('/merkle', async (req, res) => {
  const startTime = Date.now();

  try {
    console.log('[MERKLE] Starting Merkle proof generation...');
    await initializeBarretenberg();

    const { addresses, targetIndex = 0 } = req.body;

    if (!addresses || !Array.isArray(addresses) || addresses.length === 0 || addresses.length > 4) {
      throw new Error('Merkle tree supports 1-4 addresses (depth 2)');
    }

    if (targetIndex < 0 || targetIndex >= addresses.length) {
      throw new Error('Invalid target index');
    }

    // Pad addresses to 4 elements
    const paddedAddresses = [...addresses];
    while (paddedAddresses.length < 4) {
      paddedAddresses.push('0x0000000000000000000000000000000000000000');
    }

    // Convert addresses to Fr elements
    const leaves = paddedAddresses.map(addr => new Fr(BigInt(addr.toLowerCase())));

    // Build Merkle tree with Pedersen hash
    const h01 = await bb.pedersenHash([leaves[0], leaves[1]], 0);
    const h23 = await bb.pedersenHash([leaves[2], leaves[3]], 0);
    const rootFr = await bb.pedersenHash([h01, h23], 0);
    const root = rootFr.toString();

    // Generate proof path based on target index
    let path;
    let index;

    if (targetIndex === 0) {
      path = [leaves[1].toString(), h23.toString()];
      index = 0;
    } else if (targetIndex === 1) {
      path = [leaves[0].toString(), h23.toString()];
      index = 1;
    } else if (targetIndex === 2) {
      path = [leaves[3].toString(), h01.toString()];
      index = 2;
    } else {
      path = [leaves[2].toString(), h01.toString()];
      index = 3;
    }

    console.log(`[MERKLE] Proof generation took ${Date.now() - startTime}ms`);
    console.log('[MERKLE] Root:', root);

    res.json({ root, path, index });
  } catch (error) {
    console.error('[MERKLE] Error after', Date.now() - startTime, 'ms:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Merkle proof generation failed'
    });
  }
});


app.post('/merkle-root', async (req, res) => {
  const startTime = Date.now();

  try {
    await initializeBarretenberg();

    const { addresses } = req.body;

    if (!addresses || addresses.length === 0) {
      return res.json({ root: '0' });
    }

    // Pad addresses to 4 elements
    const paddedAddresses = [...addresses];
    while (paddedAddresses.length < 4) {
      paddedAddresses.push('0x0000000000000000000000000000000000000000');
    }

    const leaves = paddedAddresses.map(addr => new Fr(BigInt(addr.toLowerCase())));
    const h01 = await bb.pedersenHash([leaves[0], leaves[1]], 0);
    const h23 = await bb.pedersenHash([leaves[2], leaves[3]], 0);
    const rootFr = await bb.pedersenHash([h01, h23], 0);

    console.log(`[MERKLE-ROOT] Generation took ${Date.now() - startTime}ms`);

    res.json({ root: rootFr.toString() });
  } catch (error) {
    console.error('[MERKLE-ROOT] Error:', error);
    res.status(500).json({
      error: true,
      message: error.message || 'Merkle root generation failed'
    });
  }
});

const PORT = process.env.PORT || 3001;

Promise.all([
  initializeCircuit().then(() => console.log('[STARTUP] Circuit pre-initialized')),
  initializeBarretenberg().then(() => console.log('[STARTUP] Barretenberg pre-initialized'))
]).catch(err => console.error('[STARTUP] Pre-initialization failed:', err));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Verification service running on port ${PORT}`);
});
