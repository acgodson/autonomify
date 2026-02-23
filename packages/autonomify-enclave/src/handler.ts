import type { EnclaveRequest, EnclaveResponse } from "./protocol.js";
import { proofService } from "./proof-service.js";
import { policyStore } from "./policy-store.js";


export async function handleRequest(request: EnclaveRequest): Promise<EnclaveResponse> {
  if (request.type === "HEALTH_CHECK") {
    return {
      status: "healthy",
      timestamp: new Date().toISOString(),
      policyCount: policyStore.getPolicyCount(),
    };
  }

  if (request.type === "STORE_POLICY_CONFIG") {
    policyStore.store(request.userAddress, request.agentId, request.policyConfig);
    return {
      success: true,
      message: `Policy config stored for ${request.userAddress}:${request.agentId}`,
    };
  }

  if (request.type === "GENERATE_PROOF") {
    console.log("[HANDLER] Received GENERATE_PROOF request");
    console.log("[HANDLER] User:", request.userAddress);
    console.log("[HANDLER] Agent ID:", request.agentId);
    console.log("[HANDLER] TX amount:", request.txData.amount);
    console.log("[HANDLER] TX recipient:", request.txData.recipient);

    try {
      console.log("[HANDLER] Converting transaction data");
      const txData = {
        amount: BigInt(request.txData.amount),
        recipient: request.txData.recipient,
        timestamp: request.txData.timestamp,
        userAddress: request.txData.userAddress,
      };
      console.log("[HANDLER] Transaction data converted successfully");

      console.log("[HANDLER] Calling proof service");
      const result = await proofService.generateProof(
        request.userAddress,
        request.agentId,
        txData
      );
      console.log("[HANDLER] Proof service returned successfully");

      console.log("[HANDLER] Converting proof to hex");
      const proofHex = Buffer.from(result.proof).toString('hex');
      console.log("[HANDLER] Proof hex length:", proofHex.length);

      console.log("[HANDLER] Returning success response");
      return {
        success: true,
        proof: proofHex,
        publicInputs: result.publicInputs,
      };
    } catch (error) {
      console.error("[HANDLER] ❌ Error in GENERATE_PROOF:", error);
      console.error("[HANDLER] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[HANDLER] Error stack:", error instanceof Error ? error.stack : "No stack");
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return { success: false, error: "Unknown request type" };
}
