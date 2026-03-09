import {
  HTTPClient,
  HTTPSendRequester,
  consensusIdenticalAggregation,
  type Runtime,
} from "@chainlink/cre-sdk";
import type { Config, EnclaveResponse, ExecutePayload } from "../types";
import { toBase64 } from "./encoding";


const ERC20_TRANSFER_SELECTOR = "0xa9059cbb";


function extractERC20TransferAmount(calldata: string): string {
  if (!calldata.toLowerCase().startsWith(ERC20_TRANSFER_SELECTOR)) {
    return "0";
  }

  if (calldata.length < 138) {
    console.log("[Enclave] Calldata too short for ERC20 transfer");
    return "0";
  }

  const amountHex = "0x" + calldata.slice(74, 138);
  const amount = BigInt(amountHex).toString();
  console.log("[Enclave] Extracted ERC20 transfer amount:", amount);
  return amount;
}

export function requestZkProof(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  payload: ExecutePayload
): EnclaveResponse {
  // For ERC20 transfers, extract amount from calldata; otherwise use value
  const amount = payload.execution.calldata
    ? extractERC20TransferAmount(payload.execution.calldata)
    : (payload.execution.value || "0");

  console.log("[Enclave] Transaction amount for policy check:", amount);
  console.log("[Enclave] Calldata:", payload.execution.calldata?.slice(0, 20) + "...");

  const txData = {
    amount,
    recipient: payload.execution.target,
    timestamp: Math.floor(Date.now() / 1000),
    userAddress: payload.userAddress,
  };

  const requestBody = JSON.stringify({
    type: "GENERATE_PROOF",
    userAddress: payload.userAddress,
    agentId: payload.agentId,
    txData,
  });

  const fetchFromEnclave = httpClient.sendRequest(
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

  const responseBody = fetchFromEnclave(runtime.config.enclaveUrl, requestBody).result();
  return JSON.parse(responseBody) as EnclaveResponse;
}
