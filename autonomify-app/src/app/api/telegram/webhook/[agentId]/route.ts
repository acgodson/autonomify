/**
 * Telegram Webhook Handler
 *
 * Handles incoming Telegram messages and routes them through the LLM
 * using the universal Autonomify SDK tool pattern.
 */

import { NextRequest, NextResponse } from "next/server"
import { Bot, webhookCallback } from "grammy"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import {
  getAgent,
  getNativeBalance,
  executeDirectly,
  type AgentConfig,
} from "@/lib/agents/telegram"
import {
  bscTestnet,
  generateExport,
  createAutonomifyTool,
  createAutonomifySimulator,
  buildSystemPrompt,
  type UnsignedTransaction,
} from "@/lib/autonomify-core"

const botInstances = new Map<string, Bot>()

function getOrCreateBot(agent: AgentConfig): Bot {
  if (!agent.telegramBotToken || !agent.wallet) {
    throw new Error("Telegram bot requires token and wallet")
  }

  const existing = botInstances.get(agent.id)
  if (existing) return existing

  const bot = new Bot(agent.telegramBotToken)
  const wallet = agent.wallet // Type narrowing

  bot.command("start", async (ctx) => {
    const contractList = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || c.address.slice(0, 10)
        return `• ${name} (${c.functions.length} functions)`
      })
      .join("\n")

    await ctx.reply(
      `Welcome! I'm ${agent.name}, your onchain agent.\n\n` +
        `My wallet: \`${wallet.address}\`\n\n` +
        `Contracts I can interact with:\n${contractList || "None yet"}\n\n` +
        `Commands:\n` +
        `/wallet - Show my wallet address\n` +
        `/balance - Check my BNB balance\n` +
        `/contracts - List available contracts\n\n` +
        `Or just tell me what you want to do!`,
      { parse_mode: "Markdown" }
    )
  })

  bot.command("wallet", async (ctx) => {
    await ctx.reply(
      `My wallet address:\n\`${wallet.address}\`\n\n` +
        `[View on BscScan](https://testnet.bscscan.com/address/${wallet.address})`,
      { parse_mode: "Markdown" }
    )
  })

  bot.command("balance", async (ctx) => {
    try {
      const { formatted } = await getNativeBalance(
        bscTestnet,
        wallet.address
      )
      await ctx.reply(`My BNB balance: ${formatted} BNB`)
    } catch {
      await ctx.reply("Failed to fetch balance")
    }
  })

  bot.command("contracts", async (ctx) => {
    if (agent.contracts.length === 0) {
      await ctx.reply("No contracts configured yet.")
      return
    }

    const list = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || "Unknown"
        const symbol = (c.metadata.symbol as string) || ""
        return `• ${name}${symbol ? ` (${symbol})` : ""}\n  \`${c.address}\`\n  ${c.functions.length} functions`
      })
      .join("\n\n")

    await ctx.reply(`Contracts:\n\n${list}`, { parse_mode: "Markdown" })
  })

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text

    if (text.startsWith("/")) return

    await ctx.replyWithChatAction("typing")

    try {
      const response = await processWithLLM(agent, text)
      await ctx.reply(response, { parse_mode: "Markdown" })
    } catch (err) {
      console.error("LLM error:", err)
      await ctx.reply("Sorry, I encountered an error processing your request.")
    }
  })

  botInstances.set(agent.id, bot)
  return bot
}

/**
 * Build system prompt for the agent
 */
function buildAgentPrompt(agent: AgentConfig): string {
  if (!agent.wallet) throw new Error("Agent wallet required")

  // Generate export format for consistent prompt building
  const exportData = generateExport(bscTestnet, agent.contracts)

  // Use SDK's prompt builder and customize for Telegram
  const basePrompt = buildSystemPrompt(exportData)

  return `${basePrompt}

Your wallet address: ${agent.wallet.address}

Additional context:
- You are a Telegram bot named "${agent.name}"
- Always be helpful and explain what you're doing
- For write operations, explain what will happen before executing
- After execution, provide the transaction hash and explorer link`
}

/**
 * Process message with LLM using the SDK's universal tool pattern
 */
async function processWithLLM(
  agent: AgentConfig,
  userMessage: string
): Promise<string> {
  if (!agent.wallet) throw new Error("Agent wallet required")
  const agentWallet = agent.wallet // Type narrowing

  const systemPrompt = buildAgentPrompt(agent)

  // Generate export from agent's contracts
  const exportData = generateExport(bscTestnet, agent.contracts)

  // Create signAndSend function that uses Privy
  const signAndSend = async (tx: UnsignedTransaction): Promise<`0x${string}`> => {
    const result = await executeDirectly({
      walletId: agentWallet.privyWalletId,
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })
    return result.hash as `0x${string}`
  }

  // Create the universal Autonomify tool using our SDK
  const autonomifyTool = createAutonomifyTool({
    export: exportData,
    agentId: agent.id as `0x${string}`,
    signAndSend,
  })

  // Create simulation tool using our SDK
  const simulateTool = createAutonomifySimulator(exportData)

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: userMessage,
    tools: {
      // Use SDK-generated tools
      autonomify_execute: autonomifyTool,
      autonomify_simulate: simulateTool,

      // Balance check tool (specific to our Telegram implementation)
      get_balance: tool({
        description: "Get the native BNB balance of an address",
        parameters: z.object({
          address: z.string().describe("The address to check balance for"),
        }),
        execute: async ({ address }) => {
          const result = await getNativeBalance(bscTestnet, address)
          return result
        },
      }),
    },
    maxSteps: 5,
  })

  return result.text || "I processed your request but have no response."
}

export async function POST(
  request: NextRequest,
  { params }: { params: { agentId: string } }
) {
  const agent = await getAgent(params.agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const bot = getOrCreateBot(agent)
  const handler = webhookCallback(bot, "std/http")

  return handler(request)
}
