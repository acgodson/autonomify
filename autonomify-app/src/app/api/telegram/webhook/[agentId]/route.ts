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
  buildSystemPrompt as buildAgentSystemPrompt,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  clearConversation,
  pruneOldMessages,
  type AgentConfig,
} from "@/lib/agents/telegram"
import {
  bscTestnet,
  generateExport,
  createAutonomifyTool,
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
        `/contracts - List available contracts\n` +
        `/clear - Clear conversation history\n\n` +
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

  bot.command("clear", async (ctx) => {
    const chatId = ctx.chat.id.toString()
    await clearConversation(agent.id, chatId)
    await ctx.reply("Conversation history cleared. Starting fresh!")
  })

  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    const chatId = ctx.chat.id.toString()

    if (text.startsWith("/")) return

    await ctx.replyWithChatAction("typing")

    try {
      const response = await processWithLLM(agent, chatId, text)
      await ctx.reply(response, { parse_mode: "Markdown" })
    } catch (err) {
      console.error("LLM error:", err)
      console.error("Error stack:", err instanceof Error ? err.stack : "No stack")
      await ctx.reply("Sorry, I encountered an error processing your request.")
    }
  })

  botInstances.set(agent.id, bot)
  return bot
}


/**
 * Process message with LLM using the SDK's universal tool pattern
 * Now includes conversation history for context
 */
async function processWithLLM(
  agent: AgentConfig,
  chatId: string,
  userMessage: string
): Promise<string> {
  if (!agent.wallet) throw new Error("Agent wallet required")
  const agentWallet = agent.wallet // Type narrowing

  // Use the intelligent Telegram-specific prompt
  const systemPrompt = buildAgentSystemPrompt(agent)

  // Get conversation history for this chat
  const history = await getConversationHistory(agent.id, chatId)

  // Add the new user message to history
  await addUserMessage(agent.id, chatId, userMessage)

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

  // Build messages array with history + new message
  const messages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ]

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
    tools: {
      // Use SDK-generated tool
      autonomify_execute: autonomifyTool,

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

  const responseText = result.text || "I processed your request but have no response."

  // Save assistant response to history
  await addAssistantMessage(agent.id, chatId, responseText)

  // Periodically prune old messages
  await pruneOldMessages(agent.id, chatId)

  return responseText
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
