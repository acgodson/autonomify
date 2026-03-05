import type { CallTrace, TraceAnalysis } from "../types";
import { ERROR_SELECTORS, KNOWN_CONTRACTS } from "../constants";

function isInfrastructureContract(address: string): boolean {
  return !!KNOWN_CONTRACTS[address?.toLowerCase()];
}

function getContractName(address: string): string {
  return KNOWN_CONTRACTS[address?.toLowerCase()] || `Target(${address?.slice(0, 10)}...)`;
}

export function analyzeTrace(trace: CallTrace): TraceAnalysis {
  let failureCategory: "infrastructure" | "target" | undefined;
  let failedContract: string | undefined;
  let failedFunction: string | undefined;
  let errorName: string | undefined;
  let recommendation: string | undefined;
  let rawErrorSelector: string | undefined;
  let rawErrorData: string | undefined;
  let zkVerifierGas: number | undefined;

  function traverse(call: CallTrace): boolean {
    const contractAddr = call.to?.toLowerCase() || "";
    const contractName = getContractName(contractAddr);
    const gasUsed = parseInt(call.gasUsed, 16) || 0;

    if (contractName === "HonkVerifier") {
      zkVerifierGas = gasUsed;
    }

    if (call.error) {
      failedContract = contractName;
      failedFunction = call.input?.slice(0, 10) || "unknown";
      const errorSelector = call.output?.slice(0, 10) || "";

      if (isInfrastructureContract(contractAddr)) {
        failureCategory = "infrastructure";
        const errorInfo = ERROR_SELECTORS[errorSelector];
        if (errorInfo) {
          errorName = errorInfo.name;
          recommendation = errorInfo.action;
        } else {
          recommendation = `Infrastructure error in ${contractName}. Check system configuration.`;
        }
      } else {
        failureCategory = "target";
        rawErrorSelector = errorSelector || undefined;
        rawErrorData = call.output || undefined;
        recommendation = `Target contract (${contractAddr}) reverted. AI agent should decode error.`;
      }

      return false;
    }

    if (call.calls) {
      for (const child of call.calls) {
        if (!traverse(child)) return false;
      }
    }

    return true;
  }

  const internalSuccess = traverse(trace);
  const gasUsed = parseInt(trace.gasUsed, 16) || 0;

  return {
    internalSuccess,
    failureCategory,
    failedContract,
    failedFunction,
    errorName,
    recommendation,
    rawErrorSelector,
    rawErrorData,
    gasUsed,
    zkVerifierGas,
  };
}
