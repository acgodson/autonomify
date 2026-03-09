import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { and, eq } from "drizzle-orm"
import type { FunctionExport, Chain } from "autonomify-sdk"
import type { Abi } from "viem"
import { type ApiResponse } from "@/lib/agent"
import { db } from "@/lib/db"
import { autonomifiedContracts } from "@/lib/db/schema"

interface AnalyzeBody {
  address: string
  chainId: number
  chainConfig: Chain
  abi: Abi
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

interface ContractAnalysis {
  name: string
  summary: string
  contractType: string
  capabilities: string[]
  functionDescriptions: Record<string, string>
}

export async function POST(request: NextRequest) {
  let body: AnalyzeBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body.functions || body.functions.length === 0) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "No functions to analyze" },
      { status: 400 }
    )
  }

  const metadataStr = Object.entries(body.metadata)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n")

  const functionsStr = body.functions
    .map((f) => {
      const inputs = f.inputs.map((i: { type: string; name?: string }) => `${i.type} ${i.name || ""}`).join(", ")
      const outputs = f.outputs.map((o: { type: string }) => o.type).join(", ")
      return `- ${f.name}(${inputs})${outputs ? ` -> ${outputs}` : ""} [${f.stateMutability}]`
    })
    .join("\n")

  const prompt = `Analyze this smart contract and provide insights.

Contract Address: ${body.address}

Metadata:
${metadataStr || "None available"}

Functions:
${functionsStr}

Respond with a JSON object containing:
1. "name": A short, descriptive name for this contract (e.g., "USDC Token", "Uniswap V3 Router", "OpenSea NFT"). Use the token name/symbol if available in metadata, otherwise derive from contract type.
2. "summary": A 1-2 sentence description of what this contract does
3. "contractType": The type of contract (e.g., "ERC-20 Token", "DEX Router", "NFT Collection", "Staking Contract", etc.)
4. "capabilities": An array of 3-5 key things users can do with this contract
5. "functionDescriptions": An object mapping function names to brief descriptions of what they do

Only respond with valid JSON, no markdown or explanation.`

  try {
    const result = await generateText({
      model: openai("gpt-4o-mini"),
      prompt,
      maxTokens: 1000,
    })

    let analysis: ContractAnalysis

    try {
      // Clean the response - remove any markdown code blocks
      let cleanedText = result.text.trim()
      if (cleanedText.startsWith("```")) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
      }
      analysis = JSON.parse(cleanedText)
    } catch {
      // If parsing fails, create a basic response
      analysis = {
        name: "Smart Contract",
        summary: "A smart contract with various functions.",
        contractType: "Smart Contract",
        capabilities: ["Execute contract functions", "Read contract state"],
        functionDescriptions: {},
      }
    }

    // Save to autonomified_contracts cache (upsert)
    const normalizedAddress = body.address.toLowerCase()
    console.log("[analyze] Checking cache conditions:", {
      address: normalizedAddress,
      hasChainId: !!body.chainId,
      hasChainConfig: !!body.chainConfig,
      hasAbi: !!body.abi,
      chainId: body.chainId,
    })
    if (body.chainId && body.chainConfig && body.abi) {
      console.log("[analyze] Saving to autonomified_contracts...")
      try {
        await db
          .insert(autonomifiedContracts)
          .values({
            address: normalizedAddress,
            chainId: body.chainId,
            chainConfig: body.chainConfig as any,
            abi: body.abi as any,
            metadata: body.metadata,
            functions: body.functions as any,
            analysis: analysis as any,
          })
          .onConflictDoUpdate({
            target: [autonomifiedContracts.address, autonomifiedContracts.chainId],
            set: {
              chainConfig: body.chainConfig as any,
              abi: body.abi as any,
              metadata: body.metadata,
              functions: body.functions as any,
              analysis: analysis as any,
              updatedAt: new Date(),
            },
          })
        console.log("[analyze] Successfully saved to autonomified_contracts")
      } catch (cacheErr) {
        console.error("[analyze] Failed to cache autonomified contract:", cacheErr)
        // Don't fail the request, caching is optional
      }
    } else {
      console.log("[analyze] Skipping cache - missing required fields")
    }

    return NextResponse.json<ApiResponse<ContractAnalysis>>({
      ok: true,
      data: analysis,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Analysis failed"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
