import { NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { FunctionExport } from "autonomify-sdk"
import { type ApiResponse } from "@/lib/agent"

interface AnalyzeBody {
  address: string
  metadata: Record<string, unknown>
  functions: FunctionExport[]
}

interface ContractAnalysis {
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
1. "summary": A 1-2 sentence description of what this contract does
2. "contractType": The type of contract (e.g., "ERC-20 Token", "DEX Router", "NFT Collection", "Staking Contract", etc.)
3. "capabilities": An array of 3-5 key things users can do with this contract
4. "functionDescriptions": An object mapping function names to brief descriptions of what they do

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
        summary: "A smart contract on BSC with various functions.",
        contractType: "Smart Contract",
        capabilities: ["Execute contract functions", "Read contract state"],
        functionDescriptions: {},
      }
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
