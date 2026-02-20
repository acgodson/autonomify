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
      // Try Markdown first, fallback to plain text if parsing fails
      try {
        await ctx.reply(response, { parse_mode: "Markdown" })
      } catch (markdownErr) {
        // Markdown parsing failed, send as plain text
        await ctx.reply(response)
      }
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

  // Track tool calls to detect loops
  const toolCallHistory: string[] = []
  let loopDetected = false

  // Create AbortController to stop generation on loop detection
  const abortController = new AbortController()

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    messages,
    tools: {
      // Use SDK-generated tool
      autonomify_execute: autonomifyTool,

      // Balance check tool - ONLY for native BNB balance
      get_bnb_balance: tool({
        description: "Get the native BNB balance of a wallet address. ONLY use this for checking BNB balance. Do NOT use for token balances, DEX quotes, or swap amounts - use autonomify_execute with the appropriate contract function instead (e.g., balanceOf for token balance, getAmountsOut for swap quotes).",
        parameters: z.object({
          address: z.string().describe("The wallet address to check BNB balance for"),
        }),
        execute: async ({ address }) => {
          const result = await getNativeBalance(bscTestnet, address)
          return result
        },
      }),
    },
    maxSteps: 2, // Reduced to 2 to prevent loops
    abortSignal: abortController.signal,
    onStepFinish: ({ toolCalls }) => {
      // Track tool calls and detect repetitive loops
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          const callSig = `${tc.toolName}:${JSON.stringify(tc.args)}`
          const sameCallCount = toolCallHistory.filter(h => h === callSig).length
          toolCallHistory.push(callSig)

          if (sameCallCount >= 1) {
            // Same exact call made twice = likely a loop - abort immediately
            console.log("Loop detected - aborting:", callSig)
            loopDetected = true
            abortController.abort()
          }
        }
      }
    },
  }).catch((err) => {
    // If aborted due to loop, return partial result
    if (err.name === 'AbortError' || loopDetected) {
      console.log("Generation aborted due to loop detection")
      return { text: "", steps: [] }
    }
    throw err
  })

  // Debug logging
  console.log("LLM result steps:", result.steps?.length || 0)
  console.log("LLM result text:", result.text?.slice(0, 200) || "(empty)")
  if (result.steps) {
    for (const step of result.steps) {
      console.log("Step type:", step.stepType)
      if (step.toolCalls?.length) {
        for (const tc of step.toolCalls) {
          console.log("Tool call:", tc.toolName, JSON.stringify(tc.args).slice(0, 200))
        }
      }
      if (step.toolResults?.length) {
        for (const tr of step.toolResults) {
          console.log("Tool result:", tr.toolName, JSON.stringify(tr.result).slice(0, 200))
        }
      }
    }
  }

  // Handle loop detection or empty response
  let responseText: string
  if (loopDetected) {
    responseText = result.text || "I ran into an issue with that request (loop detected). Please try rephrasing or check the contract arguments format."
  } else {
    responseText = result.text || "I processed your request but have no response."
  }

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
