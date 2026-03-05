import {
  HTTPClient,
  HTTPSendRequester,
  consensusIdenticalAggregation,
  type Runtime,
} from "@chainlink/cre-sdk";
import type { Config, EnclaveResponse, ExecutePayload } from "../types";
import { toBase64 } from "./encoding";

export function requestZkProof(
  runtime: Runtime<Config>,
  httpClient: HTTPClient,
  payload: ExecutePayload
): EnclaveResponse {
  const txData = {
    amount: payload.execution.value || "0",
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
