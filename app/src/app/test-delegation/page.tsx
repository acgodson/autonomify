"use client";

import { useState } from "react";
import {
  createPublicClient,
  http,
  createWalletClient,
  custom,
  type Hex,
  type Address,
  encodeFunctionData,
} from "viem";
import { baseSepolia } from "viem/chains";
import {
  Implementation,
  toMetaMaskSmartAccount,
} from "@metamask/smart-accounts-kit";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";

declare global {
  interface Window {
    ethereum?: any;
    __smartAccount?: any;
    __environment?: any;
    __walletClient?: any;
  }
}

const EXECUTOR_ADDRESS = "0x3BDF07B1F57503b9A881ecd14F965117EE31A8cf" as Address;
const DELEGATION_MANAGER = "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3" as Address;

const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY;
const BUNDLER_URL = `https://api.pimlico.io/v2/base-sepolia/rpc?apikey=${PIMLICO_API_KEY}`;

type Step = "connect" | "createAccount" | "delegate" | "execute" | "done";

export default function TestDelegationPage() {
  const [step, setStep] = useState<Step>("connect");
  const [logs, setLogs] = useState<string[]>([]);
  const [eoaAddress, setEoaAddress] = useState<string>("");
  const [smartAccountAddress, setSmartAccountAddress] = useState<string>("");
  const [signedDelegation, setSignedDelegation] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const connectWallet = async () => {
    try {
      setLoading(true);
      if (!window.ethereum) throw new Error("MetaMask not found");

      if (!PIMLICO_API_KEY) {
        throw new Error("NEXT_PUBLIC_PIMLICO_API_KEY not set in .env");
      }

      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });

      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x14a34" }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x14a34",
                chainName: "Base Sepolia",
                rpcUrls: ["https://sepolia.base.org"],
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                blockExplorerUrls: ["https://sepolia.basescan.org"],
              },
            ],
          });
        }
      }

      setEoaAddress(accounts[0]);
      log(`Connected EOA: ${accounts[0]}`);
      log(`Pimlico API configured`);
      setStep("createAccount");
    } catch (e: any) {
      log(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const createSmartAccount = async () => {
    try {
      setLoading(true);

      const walletClient = createWalletClient({
        chain: baseSepolia,
        transport: custom(window.ethereum),
        account: eoaAddress as Address,
      });

      const smartAccount = await toMetaMaskSmartAccount({
        client: publicClient as any,
        implementation: Implementation.Hybrid,
        deployParams: [eoaAddress as Address, [], [], []],
        deploySalt: "0x" as Hex,
        signer: { walletClient },
      });

      const saAddress = smartAccount.address;
      setSmartAccountAddress(saAddress);
      log(`Smart Account: ${saAddress}`);
      log(`(counterfactual - deploys on first UserOp)`);

      window.__smartAccount = smartAccount;
      window.__environment = smartAccount.environment;
      window.__walletClient = walletClient;

      setStep("delegate");
    } catch (e: any) {
      log(`Error: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const signDelegationFn = async () => {
    try {
      setLoading(true);

      const smartAccount = window.__smartAccount;
      const environment = window.__environment;
      if (!smartAccount) throw new Error("Smart account not created");

      const salt = `0x${Math.floor(Math.random() * 1000000000)
        .toString(16)
        .padStart(64, "0")}` as Hex;

      // Open delegation - no caveats, ZK proof is the only gatekeeper
      const { ROOT_AUTHORITY } = await import("@metamask/smart-accounts-kit");
      const delegation = {
        delegate: EXECUTOR_ADDRESS,
        delegator: smartAccount.address,
        authority: ROOT_AUTHORITY,
        caveats: [], // No on-chain restrictions - ZK enforces policy
        salt,
        signature: "0x" as Hex,
      };

      log(`Open delegation (no caveats) - ZK proof enforces policy`);

      log(`Created delegation to executor: ${EXECUTOR_ADDRESS}`);

      const signature = await smartAccount.signDelegation({ delegation });

      const signed = { ...delegation, signature };
      setSignedDelegation(signed);

      log(`Delegation signed!`);

      setStep("execute");
    } catch (e: any) {
      log(`Error: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const testExecute = async () => {
    try {
      setLoading(true);

      if (!signedDelegation) throw new Error("No signed delegation");

      const smartAccount = window.__smartAccount;
      if (!smartAccount) throw new Error("Smart account not found");

      log(`Preparing to call AutonomifyExecutor...`);
      log(`Delegation caveats: ${signedDelegation.caveats.length}`);
      log(`Delegation salt: ${signedDelegation.salt.slice(0, 18)}...`);

      // Generate a unique nullifier for this execution
      const nullifier = `0x${Math.floor(Math.random() * 1e16).toString(16).padStart(64, "0")}` as Hex;

      // Encode permission context (delegation chain)
      const permissionContext = await encodePermissionContext(signedDelegation);

      // Execution: send 0 ETH to EOA (simple test within delegation scope)
      const executions = [
        {
          target: eoaAddress as Address,
          value: BigInt(0),
          callData: "0x" as Hex,
        },
      ];

      // Encode call to AutonomifyExecutor.executeWithDelegation
      const executeCallData = encodeFunctionData({
        abi: [
          {
            name: "executeWithDelegation",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              { name: "_nullifier", type: "bytes32" },
              { name: "_permissionContext", type: "bytes" },
              { name: "_executions", type: "tuple[]", components: [
                { name: "target", type: "address" },
                { name: "value", type: "uint256" },
                { name: "callData", type: "bytes" },
              ]},
            ],
            outputs: [],
          },
        ],
        functionName: "executeWithDelegation",
        args: [nullifier, permissionContext, executions],
      });

      // Create Pimlico client
      const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(BUNDLER_URL),
        entryPoint: { address: entryPoint07Address, version: "0.7" },
      });

      const { createSmartAccountClient } = await import("permissionless");

      const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: baseSepolia,
        bundlerTransport: http(BUNDLER_URL),
        paymaster: pimlicoClient,
        userOperation: {
          estimateFeesPerGas: async () => {
            return (await pimlicoClient.getUserOperationGasPrice()).fast;
          },
        },
      });

      log(`Calling AutonomifyExecutor.executeWithDelegation...`);
      log(`Nullifier: ${nullifier.slice(0, 18)}...`);

      const txHash = await smartAccountClient.sendTransaction({
        account: smartAccount,
        to: EXECUTOR_ADDRESS,
        data: executeCallData,
        value: BigInt(0),
      });

      log(`Delegation redeemed via executor!`);
      log(`Tx: ${txHash}`);
      log(`BaseScan: https://sepolia.basescan.org/tx/${txHash}`);
      setStep("done");
    } catch (e: any) {
      log(`Error: ${e.message}`);
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-2xl mx-auto flex flex-col h-screen py-8">
        <h1 className="text-3xl font-bold text-purple-400 mb-2">
          Delegation Test (Pimlico)
        </h1>
        <p className="text-gray-400 mb-8">
          Gas-sponsored delegation flow via Pimlico
        </p>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          <div className="space-y-4">
            <StepItem num={1} title="Connect MetaMask" done={step !== "connect"} current={step === "connect"} />
            <StepItem num={2} title="Create Smart Account" done={["delegate", "execute", "done"].includes(step)} current={step === "createAccount"} />
            <StepItem num={3} title="Sign Delegation" done={["execute", "done"].includes(step)} current={step === "delegate"} />
            <StepItem num={4} title="Execute (Sponsored)" done={step === "done"} current={step === "execute"} />
          </div>
        </div>

        <div className="bg-gray-900 rounded-lg p-6 mb-6">
          {step === "connect" && (
            <button onClick={connectWallet} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 py-3 rounded-lg font-medium">
              {loading ? "Connecting..." : "Connect MetaMask"}
            </button>
          )}
          {step === "createAccount" && (
            <button onClick={createSmartAccount} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 py-3 rounded-lg font-medium">
              {loading ? "Creating..." : "Create Smart Account"}
            </button>
          )}
          {step === "delegate" && (
            <button onClick={signDelegationFn} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 py-3 rounded-lg font-medium">
              {loading ? "Signing..." : "Sign Delegation"}
            </button>
          )}
          {step === "execute" && (
            <button onClick={testExecute} disabled={loading} className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 py-3 rounded-lg font-medium">
              {loading ? "Executing..." : "Execute (Gas Sponsored)"}
            </button>
          )}
          {step === "done" && (
            <div className="text-center text-green-400 py-3">Delegation executed successfully!</div>
          )}
        </div>

        {eoaAddress && (
          <div className="bg-gray-900 rounded-lg p-4 mb-4 text-sm">
            <div className="text-gray-400">EOA: {eoaAddress}</div>
            {smartAccountAddress && <div className="text-gray-400">Smart Account: {smartAccountAddress}</div>}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg p-4 flex-1 overflow-hidden flex flex-col">
          <div className="text-gray-400 text-sm mb-2">Logs:</div>
          <div className="font-mono text-xs space-y-1 flex-1 overflow-y-auto border border-gray-800 rounded p-2">
            {logs.map((l, i) => (
              <div key={i} className="text-gray-300 break-all">{l}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

async function encodePermissionContext(delegation: any): Promise<Hex> {
  const { encodeDelegations } = await import("@metamask/smart-accounts-kit/utils");
  return encodeDelegations([delegation]);
}

function StepItem({ num, title, done, current }: { num: number; title: string; done: boolean; current: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${done ? "bg-green-500" : current ? "bg-purple-500" : "bg-gray-700"}`}>
        {done ? "✓" : num}
      </div>
      <span className={current ? "text-white" : "text-gray-400"}>{title}</span>
    </div>
  );
}
