import { NextRequest, NextResponse } from "next/server"
import { parseEther } from "viem"
import { eq } from "drizzle-orm"
import {
  createAgent,
  listAgents,
  type Agent,
  type ChannelType,
  type ApiResponse,
} from "@/lib/agent"
import { db, agentPolicies, agentAllowedContracts } from "@/lib/db"
import { syncPolicyToEnclave } from "@/lib/agent/cre"
import { registerTelegramWebhook } from "@/lib/channels"

interface PolicyConfig {
  maxTxAmount: string
  enableTimeWindow: boolean
  startHour: number
  endHour: number
  whitelistedContract: string
}

interface CreateAgentBody {
  name: string
  type?: ChannelType
  ownerAddress: string
  telegramBotToken?: string
  policy?: PolicyConfig
}

interface AgentPublic {
  id: string
  name: string
  type: ChannelType
  ownerAddress: string
  agentIdBytes?: string
  contractCount: number
  createdAt: number
}

function toPublic(agent: Agent): AgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    type: agent.channel,
    ownerAddress: agent.ownerAddress,
    agentIdBytes: agent.agentIdBytes,
    contractCount: agent.contracts.length,
    createdAt: agent.createdAt,
  }
}

export async function GET(request: NextRequest) {
  const ownerAddress = request.headers.get("x-owner-address")

  if (!ownerAddress) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing owner address" },
      { status: 401 }
    )
  }

  const agents = await listAgents(ownerAddress)

  return NextResponse.json<ApiResponse<AgentPublic[]>>({
    ok: true,
    data: agents.map(toPublic),
  })
}

export async function POST(request: NextRequest) {
  let body: CreateAgentBody

  try {
    body = await request.json()
  } catch {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    )
  }

  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing or invalid name" },
      { status: 400 }
    )
  }

  if (!body.ownerAddress || typeof body.ownerAddress !== "string") {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Missing owner address" },
      { status: 401 }
    )
  }

  const agentType = body.type || "telegram"

  if (agentType === "telegram" && (!body.telegramBotToken || typeof body.telegramBotToken !== "string")) {
    return NextResponse.json<ApiResponse>(
      { ok: false, error: "Telegram agents require a bot token" },
      { status: 400 }
    )
  }

  try {
    const agent = await createAgent({
      name: body.name,
      channel: agentType,
      ownerAddress: body.ownerAddress,
      channelToken: body.telegramBotToken,
    })

    // Register Telegram webhook for the agent
    if (agentType === "telegram" && body.telegramBotToken) {
      const webhookResult = await registerTelegramWebhook(agent.id, body.telegramBotToken)
      if (!webhookResult.success) {
        console.error(`Failed to register Telegram webhook: ${webhookResult.error}`)
        // Continue anyway - webhook can be registered later
      }
    }

    // Create policy if provided
    if (body.policy) {
      const txLimitWei = parseEther(body.policy.maxTxAmount).toString()

      // Get merkle root for whitelisted contract
      let whitelistRoot: string | null = null
      let whitelistPath: string[] = ["0", "0"]
      let whitelistIndex = 0

      try {
        const merkleRes = await fetch(
          `${process.env.VERIFICATION_SERVICE_URL || "http://localhost:3001"}/merkle`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              addresses: [body.policy.whitelistedContract],
              targetIndex: 0,
            }),
          }
        )
        const merkleData = await merkleRes.json()
        if (merkleData.root) {
          whitelistRoot = merkleData.root
          whitelistPath = merkleData.path
          whitelistIndex = merkleData.index
        }
      } catch (merkleErr) {
        console.error("Failed to generate merkle root:", merkleErr)
      }

      // Insert policy record
      await db.insert(agentPolicies).values({
        agentId: agent.id,
        userAddress: body.ownerAddress.toLowerCase(),
        txLimit: txLimitWei,
        dailyLimit: txLimitWei,
        enableTimeWindow: body.policy.enableTimeWindow ? 1 : 0,
        startHour: body.policy.startHour,
        endHour: body.policy.endHour,
        whitelistRoot,
        syncStatus: "pending",
      })

      // Insert whitelisted contract
      await db.insert(agentAllowedContracts).values({
        agentId: agent.id,
        contractAddress: body.policy.whitelistedContract.toLowerCase(),
      })

      // Sync policy to enclave (use agentIdBytes, not agent.id)
      try {
        const enclaveResult = await syncPolicyToEnclave(
          body.ownerAddress,
          agent.agentIdBytes!,
          {
            maxAmount: {
              enabled: true,
              limit: parseInt(txLimitWei),
            },
            timeWindow: {
              enabled: body.policy.enableTimeWindow,
              startHour: body.policy.startHour,
              endHour: body.policy.endHour,
            },
            whitelist: {
              enabled: true,
              root: whitelistRoot || "0",
              path: whitelistPath,
              index: whitelistIndex,
            },
          }
        )

        if (enclaveResult.success) {
          await db
            .update(agentPolicies)
            .set({ syncStatus: "synced", lastSyncedAt: new Date() })
            .where(eq(agentPolicies.agentId, agent.id))
        }
      } catch (enclaveErr) {
        console.error("Failed to sync policy to enclave:", enclaveErr)
      }
    }

    return NextResponse.json<ApiResponse<AgentPublic>>({
      ok: true,
      data: toPublic(agent),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create agent"
    return NextResponse.json<ApiResponse>(
      { ok: false, error: message },
      { status: 500 }
    )
  }
}
