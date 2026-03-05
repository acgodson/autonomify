/**
 * Autonomify CRE Workflow
 *
 * Two modes:
 * - SIMULATION: Pre-flight on Tenderly Virtual TestNet
 * - EXECUTION: Real tx with Tenderly trace verification
 */

import {
  HTTPCapability,
  HTTPClient,
  EVMClient,
  handler,
  Runner,
  prepareReportRequest,
  type Runtime,
  type HTTPPayload,
} from "@chainlink/cre-sdk";
import { encodeAbiParameters, parseAbiParameters, type Hex } from "viem";

import type { Config, ExecutePayload, SimulationResult, ExecutionResult, Execution } from "./types";
import { TX_STATUS_NAMES, GAS_LIMIT, ON_REPORT_SELECTOR } from "./constants";
import { bytesToHex } from "./lib/encoding";
import { requestZkProof } from "./lib/enclave";
import { simulateOnVirtualTestnet, fetchTransactionTrace } from "./lib/tenderly";
import { analyzeTrace } from "./lib/trace-analyzer";

function buildReportPayload(
  proof: string,
  publicInputs: { policySatisfied: string; nullifier: string; userAddressHash: string },
  execution: Execution,
  permissionsContext: string
): Hex {
  const proofHex = (proof.startsWith("0x") ? proof : `0x${proof}`) as Hex;

  return encodeAbiParameters(
    parseAbiParameters(
      "bytes proof, bytes32[] publicInputs, bytes permissionsContext, (address target, uint256 value, bytes callData)[] executions"
    ),
    [
      proofHex,
      [publicInputs.policySatisfied as Hex, publicInputs.nullifier as Hex, publicInputs.userAddressHash as Hex],
      permissionsContext as Hex,
      [execution],
    ]
  );
}

function buildOnReportCalldata(reportPayload: Hex): string {
  const encodedParams = encodeAbiParameters(parseAbiParameters("bytes metadata, bytes report"), [
    "0x" as Hex,
    reportPayload,
  ]);
  return ON_REPORT_SELECTOR + encodedParams.slice(2);
}

function handleSimulation(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  payload: ExecutePayload
): string {
  runtime.log("[ENCLAVE] Requesting ZK proof...");
  const enclaveResponse = requestZkProof(runtime, httpClient, payload);

  if (!enclaveResponse.success) {
    runtime.log(`[ENCLAVE] FAILED: ${enclaveResponse.error}`);
    return JSON.stringify({
      success: false,
      mode: "simulation",
      stage: "proof_generation",
      error: enclaveResponse.error,
    });
  }

  runtime.log(`[ENCLAVE] Proof generated. Nullifier: ${enclaveResponse.publicInputs.nullifier.slice(0, 20)}...`);

  const execution: Execution = {
    target: payload.execution.target as Hex,
    value: BigInt(payload.execution.value || "0"),
    callData: (payload.execution.calldata || "0x") as Hex,
  };

  const reportPayload = buildReportPayload(
    enclaveResponse.proof,
    enclaveResponse.publicInputs,
    execution,
    payload.permissionsContext
  );

  runtime.log("[SIMULATION] Running on Tenderly Virtual TestNet...");
  const onReportCalldata = buildOnReportCalldata(reportPayload);
  const simResult = simulateOnVirtualTestnet(runtime, httpClient, onReportCalldata, payload.userAddress);

  if (simResult.codeInjected) {
    runtime.log("[SIMULATION] Smart account code was synced from real chain");
  }

  if (!simResult.success) {
    runtime.log("[SIMULATION] FAILED: execution reverted");
    const result: SimulationResult = {
      success: false,
      mode: "simulation",
      gasEstimate: simResult.gasEstimate,
      codeInjected: simResult.codeInjected,
      error: simResult.error,
      nullifier: enclaveResponse.publicInputs.nullifier,
      policySatisfied: enclaveResponse.publicInputs.policySatisfied,
    };
    return JSON.stringify(result);
  }

  runtime.log("[SIMULATION] SUCCESS - Transaction would succeed");
  runtime.log(`[SIMULATION] Estimated gas: ${simResult.gasEstimate.toLocaleString()}`);

  const result: SimulationResult = {
    success: true,
    mode: "simulation",
    gasEstimate: simResult.gasEstimate,
    codeInjected: simResult.codeInjected,
    returnData: simResult.returnData,
    nullifier: enclaveResponse.publicInputs.nullifier,
    policySatisfied: enclaveResponse.publicInputs.policySatisfied,
    userAddressHash: enclaveResponse.publicInputs.userAddressHash,
    message: "Simulation passed. Call again without simulateOnly flag to execute.",
  };

  return JSON.stringify(result);
}

function handleExecution(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  payload: ExecutePayload
): string {
  runtime.log("[ENCLAVE] Requesting ZK proof...");
  const enclaveResponse = requestZkProof(runtime, httpClient, payload);

  if (!enclaveResponse.success) {
    runtime.log(`[ENCLAVE] FAILED: ${enclaveResponse.error}`);
    return JSON.stringify({
      success: false,
      mode: "execution",
      stage: "proof_generation",
      error: enclaveResponse.error,
    });
  }

  runtime.log(`[ENCLAVE] Proof generated. Nullifier: ${enclaveResponse.publicInputs.nullifier.slice(0, 20)}...`);

  const execution: Execution = {
    target: payload.execution.target as Hex,
    value: BigInt(payload.execution.value || "0"),
    callData: (payload.execution.calldata || "0x") as Hex,
  };

  const reportPayload = buildReportPayload(
    enclaveResponse.proof,
    enclaveResponse.publicInputs,
    execution,
    payload.permissionsContext
  );

  runtime.log("[CRE] Creating signed report...");
  const reportRequest = prepareReportRequest(reportPayload);
  const signedReport = runtime.report(reportRequest).result();

  runtime.log("[CHAIN] Submitting on-chain...");
  const evmClient = new EVMClient(BigInt(runtime.config.chainSelector));

  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.executorAddress,
      report: signedReport,
      gasConfig: { gasLimit: GAS_LIMIT },
    })
    .result();

  const statusName = TX_STATUS_NAMES[writeResult.txStatus] || "UNKNOWN";
  const txHashHex = bytesToHex(writeResult.txHash as unknown as Uint8Array);

  runtime.log(`[CHAIN] Transaction status: ${statusName} (${writeResult.txStatus})`);
  runtime.log(`[CHAIN] Tx hash: ${txHashHex}`);

  runtime.log("[TENDERLY] Fetching transaction trace for verification...");
  const traceResponse = fetchTransactionTrace(runtime, httpClient, txHashHex);

  if (!traceResponse.success || !traceResponse.trace) {
    runtime.log(`[TENDERLY] Trace failed: ${traceResponse.error}`);
    const result: ExecutionResult = {
      success: false,
      mode: "execution",
      txStatus: writeResult.txStatus,
      txStatusName: statusName,
      txHash: txHashHex,
      nullifier: enclaveResponse.publicInputs.nullifier,
      userAddressHash: enclaveResponse.publicInputs.userAddressHash,
      gasAnalysis: { total: 0 },
      error: { type: "trace_failed", message: traceResponse.error },
    };
    return JSON.stringify(result);
  }

  const diagnosis = analyzeTrace(traceResponse.trace);

  if (diagnosis.internalSuccess) {
    runtime.log("[TENDERLY] VERIFIED: Internal execution succeeded");
    runtime.log(`[TENDERLY] Total gas used: ${diagnosis.gasUsed.toLocaleString()}`);
    if (diagnosis.zkVerifierGas) {
      runtime.log(`[TENDERLY] ZK Verifier gas: ${diagnosis.zkVerifierGas.toLocaleString()}`);
    }
  } else {
    runtime.log("[TENDERLY] WARNING: Internal execution FAILED!");
    runtime.log(`[TENDERLY] Failure type: ${diagnosis.failureCategory?.toUpperCase()}`);
    runtime.log(`[TENDERLY] Failed at: ${diagnosis.failedContract}`);
  }

  const result: ExecutionResult = {
    success: diagnosis.internalSuccess,
    mode: "execution",
    txStatus: writeResult.txStatus,
    txStatusName: statusName,
    txHash: txHashHex,
    nullifier: enclaveResponse.publicInputs.nullifier,
    userAddressHash: enclaveResponse.publicInputs.userAddressHash,
    gasAnalysis: {
      total: diagnosis.gasUsed,
      zkVerifier: diagnosis.zkVerifierGas,
    },
  };

  if (!diagnosis.internalSuccess) {
    result.error =
      diagnosis.failureCategory === "infrastructure"
        ? {
            type: "infrastructure",
            contract: diagnosis.failedContract,
            function: diagnosis.failedFunction,
            errorName: diagnosis.errorName,
            recommendation: diagnosis.recommendation,
          }
        : {
            type: "target",
            contract: diagnosis.failedContract,
            function: diagnosis.failedFunction,
            errorSelector: diagnosis.rawErrorSelector,
            errorData: diagnosis.rawErrorData,
          };
  }

  return JSON.stringify(result);
}

const onHttpTrigger = (runtime: Runtime<Config>, trigger: HTTPPayload): string => {
  const payload = JSON.parse(new TextDecoder().decode(trigger.input)) as ExecutePayload;
  const isSimulation = payload.simulateOnly === true;

  runtime.log(`[AUTONOMIFY] ${isSimulation ? "SIMULATION" : "EXECUTION"} request for user: ${payload.userAddress}`);

  const httpClient = new HTTPClient();

  return isSimulation
    ? handleSimulation(runtime, httpClient, payload)
    : handleExecution(runtime, httpClient, payload);
};

const initWorkflow = (config: Config) => {
  const http = new HTTPCapability();

  return [
    handler(
      http.trigger({
        authorizedKeys: [{ type: "KEY_TYPE_ECDSA_EVM", publicKey: config.authorizedKey }],
      }),
      onHttpTrigger
    ),
  ];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
