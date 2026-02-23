import { startServer } from "./server.js";
import { initializeNoir } from "./init-noir.js";
import { proofService } from "./proof-service.js";

console.log("opaque Enclave Starting...");

async function main() {
  try {
    console.log("Initializing Noir circuit...");
    const { noir, backend } = await initializeNoir();
    
    console.log("Initializing proof service...");
    await proofService.initialize({ noir, backend });
    
    console.log("Starting server...");
    startServer();
  } catch (error) {
    console.error("Failed to initialize enclave:", error);
    process.exit(1);
  }
}

main();
