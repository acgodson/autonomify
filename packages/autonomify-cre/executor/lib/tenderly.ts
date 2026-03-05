import {
  HTTPClient,
  HTTPSendRequester,
  consensusIdenticalAggregation,
  type Runtime,
} from "@chainlink/cre-sdk";
import type { Config, CallTrace } from "../types";
import { toBase64 } from "./encoding";
import { CRE_FORWARDER, ERROR_SELECTORS } from "../constants";

type RpcResponse<T> = {
  result?: T;
  error?: { code: number; message: string; data?: string };
};

function createRpcFetcher(runtime: Runtime<Config>, httpClient: HTTPClient) {
  const sendRequest = httpClient.sendRequest(
    runtime,
    (requester: HTTPSendRequester, url: string, body: string) => {
      const res = requester
        .sendRequest({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: toBase64(body),
        })
        .result();
      return new TextDecoder().decode(res.body);
    },
    consensusIdenticalAggregation<string>()
  );

  return <T>(url: string, method: string, params: unknown[]): RpcResponse<T> => {
    const request = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
    const response = sendRequest(url, request).result();
    return JSON.parse(response);
  };
}

export type SimulationResponse = {
  success: boolean;
  gasEstimate: number;
  returnData?: string;
  codeInjected?: boolean;
  error?: {
    type: "infrastructure" | "target";
    errorSelector: string;
    errorData: string;
    decoded?: string;
    recommendation?: string;
  };
};

function syncSmartAccountCode(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  userAddress: string
): boolean {
  const rpc = createRpcFetcher(runtime, httpClient);
  const virtualTestnetUrl = runtime.config.virtualTestnetRpc;
  const realChainUrl = runtime.config.tenderlyRpc;

  const virtualCode = rpc<string>(virtualTestnetUrl, "eth_getCode", [userAddress, "latest"]);
  if (virtualCode.result && virtualCode.result !== "0x") {
    return false;
  }

  runtime.log(`[TENDERLY] Smart account not found in Virtual TestNet, syncing from real chain...`);

  const realCode = rpc<string>(realChainUrl, "eth_getCode", [userAddress, "latest"]);
  if (!realCode.result || realCode.result === "0x") {
    runtime.log(`[TENDERLY] Smart account not deployed on real chain either`);
    return false;
  }

  runtime.log(`[TENDERLY] Injecting ${realCode.result.length} bytes of bytecode via tenderly_setCode`);
  const setCodeResult = rpc<string>(virtualTestnetUrl, "tenderly_setCode", [userAddress, realCode.result]);

  if (setCodeResult.error) {
    runtime.log(`[TENDERLY] Failed to inject code: ${setCodeResult.error.message}`);
    return false;
  }

  runtime.log(`[TENDERLY] Smart account code synced successfully`);
  return true;
}

export function simulateOnVirtualTestnet(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  onReportCalldata: string,
  userAddress?: string
): SimulationResponse {
  const rpc = createRpcFetcher(runtime, httpClient);
  const url = runtime.config.virtualTestnetRpc;

  let codeInjected = false;
  if (userAddress) {
    codeInjected = syncSmartAccountCode(runtime, httpClient, userAddress);
  }

  const callParams = {
    from: CRE_FORWARDER,
    to: runtime.config.executorAddress,
    data: onReportCalldata,
    gas: "0x2DC6C0",
  };

  const simResult = rpc<string>(url, "eth_call", [callParams, "latest"]);
  const gasResult = rpc<string>(url, "eth_estimateGas", [callParams]);
  const gasEstimate = gasResult.result ? parseInt(gasResult.result, 16) : 0;

  if (simResult.error) {
    const errorData = simResult.error.data || "";
    const errorSelector = errorData.slice(0, 10);
    const isInfra = !!ERROR_SELECTORS[errorSelector];

    return {
      success: false,
      gasEstimate,
      codeInjected,
      error: {
        type: isInfra ? "infrastructure" : "target",
        errorSelector,
        errorData,
        decoded: isInfra ? ERROR_SELECTORS[errorSelector]?.name : undefined,
        recommendation: isInfra
          ? ERROR_SELECTORS[errorSelector]?.action
          : "AI agent should decode target error",
      },
    };
  }

  return {
    success: true,
    gasEstimate,
    codeInjected,
    returnData: simResult.result,
  };
}

export type TraceResponse = {
  success: boolean;
  trace?: CallTrace;
  error?: string;
};

export function fetchTransactionTrace(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  txHash: string
): TraceResponse {
  const rpc = createRpcFetcher(runtime, httpClient);
  const maxRetries = 5;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const result = rpc<CallTrace>(runtime.config.tenderlyRpc, "debug_traceTransaction", [
      txHash,
      { tracer: "callTracer" },
    ]);

    if (result.result) {
      return {
        success: true,
        trace: result.result,
      };
    }

    if (attempt < maxRetries) {
      runtime.log(`[TENDERLY] Trace not ready (attempt ${attempt}/${maxRetries}), waiting...`);
    }
  }

  return {
    success: false,
    error: "Trace not available after retries",
  };
}

