/**
 * Telegram Bot Factory
 *
 * Creates and manages Telegram bot instances.
 * This is a thin wrapper - all business logic lives in @/lib/agent.
 */

import { Bot } from "grammy"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { getChain } from "autonomify-sdk"
import {
  type Agent,
  buildAgentPrompt,
  buildAgentExport,
  getNativeBalance,
  executeDirectly,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  clearConversation,
  pruneOldMessages,
} from "@/lib/agent"
import { forVercelAI } from "autonomify-sdk"

const botInstances = new Map<string, Bot>()

export function getOrCreateBot(agent: Agent): Bot {
  if (!agent.channelToken || !agent.wallet) {
    throw new Error("Telegram bot requires token and wallet")
  }

  const existing = botInstances.get(agent.id)
  if (existing) return existing

  const bot = new Bot(agent.channelToken)
  const wallet = agent.wallet

  // /start command
  bot.command("start", async (ctx) => {
    const contractList = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || c.address.slice(0, 10)
        return `- ${name} (${c.functions.length} functions)`
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

  // /wallet command
  bot.command("wallet", async (ctx) => {
    const chain = agent.contracts[0]?.chain
    const explorer = chain?.explorer || "https://testnet.bscscan.com"

    await ctx.reply(
      `My wallet address:\n\`${wallet.address}\`\n\n` +
        `[View on Explorer](${explorer}/address/${wallet.address})`,
      { parse_mode: "Markdown" }
    )
  })

  // /balance command
  bot.command("balance", async (ctx) => {
    try {
      const contract = agent.contracts[0]
      const chainId = contract?.chainId || 97
      const rpcUrl = contract?.chain.rpc[0] || "https://data-seed-prebsc-1-s1.binance.org:8545"

      const { formatted } = await getNativeBalance(chainId, rpcUrl, wallet.address)
      const chain = getChain(chainId)
      const symbol = chain?.nativeCurrency.symbol || "BNB"

      await ctx.reply(`My balance: ${formatted} ${symbol}`)
    } catch {
      await ctx.reply("Failed to fetch balance")
    }
  })

  // /contracts command
  bot.command("contracts", async (ctx) => {
    if (agent.contracts.length === 0) {
      await ctx.reply("No contracts configured yet.")
      return
    }

    const list = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || "Unknown"
        const symbol = (c.metadata.symbol as string) || ""
        return `- ${name}${symbol ? ` (${symbol})` : ""}\n  \`${c.address}\`\n  ${c.functions.length} functions`
      })
      .join("\n\n")

    await ctx.reply(`Contracts:\n\n${list}`, { parse_mode: "Markdown" })
  })

  // /clear command
  bot.command("clear", async (ctx) => {
    const chatId = ctx.chat.id.toString()
    await clearConversation(agent.id, chatId)
    await ctx.reply("Conversation history cleared. Starting fresh!")
  })

  // Message handler - routes to LLM
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text
    const chatId = ctx.chat.id.toString()

    if (text.startsWith("/")) return

    await ctx.replyWithChatAction("typing")

    try {
      const response = await processWithLLM(agent, chatId, text)
      try {
        await ctx.reply(response, { parse_mode: "Markdown" })
      } catch {
        await ctx.reply(response)
      }
    } catch (err) {
      console.error("LLM error:", err)
      await ctx.reply("Sorry, I encountered an error processing your request.")
    }
  })

  botInstances.set(agent.id, bot)
  return bot
}

/**
 * Process message with LLM using the SDK
 */
async function processWithLLM(
  agent: Agent,
  chatId: string,
  userMessage: string
): Promise<string> {
  if (!agent.wallet) throw new Error("Agent wallet required")
  const agentWallet = agent.wallet

  // Build system prompt using SDK
  const systemPrompt = buildAgentPrompt(agent)

  // Get conversation history
  const history = await getConversationHistory(agent.id, chatId)
  await addUserMessage(agent.id, chatId, userMessage)

  // Build export for SDK
  const exportData = buildAgentExport(agent)

  // Get chain info for native balance tool
  const contract = agent.contracts[0]
  const chainId = contract?.chainId || 97
  const rpcUrl = contract?.chain.rpc[0] || "https://data-seed-prebsc-1-s1.binance.org:8545"

  // Create Vercel AI tool using SDK adapter
  const { tool: autonomifyTool } = forVercelAI({
    export: exportData,
    agentId: agent.id,
    signAndSend: async (tx) => {
      const result = await executeDirectly({
        walletId: agentWallet.privyWalletId,
        chainId,
        to: tx.to,
        data: tx.data,
        value: tx.value,
      })
      return result.hash
    },
  })

  // Build messages
  const messages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ]

  // Track tool calls for loop detection
  const toolCallHistory: string[] = []
  let loopDetected = false
  const abortController = new AbortController()

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
    tools: {
      autonomify_execute: autonomifyTool,
      get_native_balance: tool({
        description: "Get the native token balance of a wallet address.",
        parameters: z.object({
          address: z.string().describe("The wallet address to check"),
        }),
        execute: async ({ address }) => {
          return getNativeBalance(chainId, rpcUrl, address)
        },
      }),
    },
    maxSteps: 2,
    abortSignal: abortController.signal,
    onStepFinish: ({ toolCalls }) => {
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const callSig = `${tc.toolName}:${JSON.stringify(tc.args)}`
          const sameCallCount = toolCallHistory.filter((h) => h === callSig).length
          toolCallHistory.push(callSig)

          if (sameCallCount >= 1) {
            console.log("Loop detected - aborting:", callSig)
            loopDetected = true
            abortController.abort()
          }
        }
      }
    },
  }).catch((err) => {
    if (err.name === "AbortError" || loopDetected) {
      return { text: "", steps: [] }
    }
    throw err
  })

  let responseText: string
  if (loopDetected) {
    responseText =
      result.text ||
      "I ran into an issue with that request. Please try rephrasing."
  } else {
    responseText = result.text || "I processed your request but have no response."
  }

  await addAssistantMessage(agent.id, chatId, responseText)
  await pruneOldMessages(agent.id, chatId)

  return responseText
}

export function clearBotInstance(agentId: string): void {
  botInstances.delete(agentId)
}
