import type { Hex } from "viem";

export type Config = {
  enclaveUrl: string;
  executorAddress: string;
  authorizedKey: string;
  chainSelector: string;
  tenderlyRpc: string;
  virtualTestnetRpc: string;
};

export type ExecutePayload = {
  userAddress: string;
  agentId: string;
  execution: {
    target: string;
    calldata: string;
    value: string;
  };
  permissionsContext: string;
  simulateOnly?: boolean;
};

export type EnclaveResponse = {
  success: boolean;
  proof: string;
  publicInputs: {
    policySatisfied: string;
    nullifier: string;
    userAddressHash: string;
  };
  error?: string;
};

export type CallTrace = {
  from: string;
  to: string;
  input: string;
  output?: string;
  error?: string;
  gas: string;
  gasUsed: string;
  value?: string;
  calls?: CallTrace[];
};

export type TraceAnalysis = {
  internalSuccess: boolean;
  failureCategory?: "infrastructure" | "target";
  failedContract?: string;
  failedFunction?: string;
  errorName?: string;
  recommendation?: string;
  rawErrorSelector?: string;
  rawErrorData?: string;
  gasUsed: number;
  zkVerifierGas?: number;
};

export type SimulationResult = {
  success: boolean;
  mode: "simulation";
  gasEstimate: number;
  returnData?: string;
  codeInjected?: boolean;
  error?: {
    type: "infrastructure" | "target";
    errorSelector?: string;
    errorData?: string;
    decoded?: string;
    recommendation?: string;
  };
  nullifier: string;
  policySatisfied: string;
  userAddressHash?: string;
  message?: string;
};

export type ExecutionResult = {
  success: boolean;
  mode: "execution";
  txStatus: number;
  txStatusName: string;
  txHash: string;
  nullifier: string;
  userAddressHash: string;
  gasAnalysis: {
    total: number;
    zkVerifier?: number;
  };
  error?: {
    type: "infrastructure" | "target" | "trace_failed";
    contract?: string;
    function?: string;
    errorName?: string;
    errorSelector?: string;
    errorData?: string;
    recommendation?: string;
    message?: string;
  };
};

export type Execution = {
  target: Hex;
  value: bigint;
  callData: Hex;
};
