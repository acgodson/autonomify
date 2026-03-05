export const ERROR_SELECTORS: Record<string, { name: string; action: string }> = {
  "0xa5d82e8a": { name: "ShpleminiFailed", action: "Increase gas limit (ZK verification needs ~2M gas)" },
  "0x09bde339": { name: "InvalidProof", action: "Regenerate proof with fresh timestamp" },
  "0x756688fe": { name: "PolicyNotSatisfied", action: "Check policy config for user/agent" },
  "0x25a5b1b9": { name: "NullifierAlreadyUsed", action: "Generate new proof (this tx was already executed)" },
  "0xfb8f41b2": { name: "InvalidPublicInputs", action: "Ensure 3 public inputs are provided" },
  "0x815e1d64": { name: "InvalidSignature", action: "Re-sign delegation with correct account" },
  "0x30cd7471": { name: "InvalidDelegation", action: "Verify executor matches delegation.delegate" },
};

export const KNOWN_CONTRACTS: Record<string, string> = {
  "0x50a99ae22140519ced197e7daa3304743ed56ce1": "HonkVerifier",
  "0xd44def7f75fea04b402688ff14572129d2beeb05": "AutonomifyExecutor",
  "0xdb9b1e94b5b69df7e401ddbede43491141047db3": "DelegationManager",
  "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5": "CREForwarder",
};

export const CRE_FORWARDER = "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5";

export const ON_REPORT_SELECTOR = "0x805f2132";

export const TX_STATUS = {
  FATAL: 0,
  REVERTED: 1,
  SUCCESS: 2,
} as const;

export const TX_STATUS_NAMES = ["FATAL", "REVERTED", "SUCCESS"];

export const GAS_LIMIT = "3000000";
