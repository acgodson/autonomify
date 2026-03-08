import { Bot } from "grammy"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { getChainOrThrow } from "autonomify-sdk"
import {
  type Agent,
  buildAgentPrompt,
  buildAgentExport,
  getNativeBalance,
  executeViaCRE,
  getDelegation,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  clearConversation,
  pruneOldMessages,
  markMessageError,
} from "@/lib/agent"
import { forVercelAI } from "autonomify-sdk"
import { DEFAULT_CHAIN_ID } from "@/lib/chains"

const botInstances = new Map<string, Bot>()

/**
 * Register webhook with Telegram for an agent
 */
export async function registerTelegramWebhook(
  agentId: string,
  botToken: string
): Promise<{ success: boolean; error?: string }> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    return { success: false, error: "NEXT_PUBLIC_APP_URL not configured" }
  }

  const webhookUrl = `${appUrl}/api/telegram/webhook/${agentId}`

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/setWebhook`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          allowed_updates: ["message"],
        }),
      }
    )

    const data = await response.json()

    if (!data.ok) {
      return { success: false, error: data.description || "Failed to set webhook" }
    }

    console.log(`[Telegram] Webhook registered for agent ${agentId}: ${webhookUrl}`)
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return { success: false, error: message }
  }
}

/**
 * Get current webhook info for a bot
 */
export async function getWebhookInfo(botToken: string): Promise<{
  url: string
  pending_update_count: number
  last_error_message?: string
}> {
  const response = await fetch(
    `https://api.telegram.org/bot${botToken}/getWebhookInfo`
  )
  const data = await response.json()
  return data.result
}

export function getOrCreateBot(agent: Agent): Bot {
  if (!agent.channelToken) {
    throw new Error("Telegram bot requires token")
  }

  const existing = botInstances.get(agent.id)
  if (existing) return existing

  const bot = new Bot(agent.channelToken)

  bot.command("start", async (ctx) => {
    const contractList = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || c.address.slice(0, 10)
        return `- ${name} (${c.functions.length} functions)`
      })
      .join("\n")

    await ctx.reply(
      `Welcome! I'm ${agent.name}, your onchain agent.\n\n` +
        `Owner: \`${agent.ownerAddress}\`\n\n` +
        `Contracts I can interact with:\n${contractList || "None yet"}\n\n` +
        `Commands:\n` +
        `/contracts - List available contracts\n` +
        `/clear - Clear conversation history\n\n` +
        `Or just tell me what you want to do!`,
      { parse_mode: "Markdown" }
    )
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
        return `- ${name}${symbol ? ` (${symbol})` : ""}\n  \`${c.address}\`\n  ${c.functions.length} functions`
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
    const channelMessageId = ctx.message.message_id.toString()

    if (text.startsWith("/")) return

    const { isNew, messageId, status } = await addUserMessage(
      agent.id,
      chatId,
      text,
      { channelMessageId }
    )

    if (!isNew) {
      if (status === "processing") {
        console.log(`Message ${channelMessageId} still processing, skipping`)
        return
      }
      if (status === "completed") {
        console.log(`Message ${channelMessageId} already completed, skipping`)
        return
      }
      if (status === "error") {
        console.log(`Message ${channelMessageId} previously errored, skipping`)
        return
      }
    }

    await ctx.replyWithChatAction("typing")

    try {
      const response = await processWithLLM(agent, chatId, text, messageId!)
      const sentMessage = await ctx.reply(response, { parse_mode: "Markdown" }).catch(() =>
        ctx.reply(response)
      )

      await addAssistantMessage(agent.id, chatId, response, {
        channelMessageId: sentMessage.message_id.toString(),
        replyToMessageId: messageId,
      })
    } catch (err) {
      console.error("LLM error:", err)
      if (messageId) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error"
        await markMessageError(messageId, errorMsg)
      }
      await ctx.reply("Sorry, I encountered an error processing your request.")
    }
  })
  botInstances.set(agent.id, bot)
  return bot
}

async function processWithLLM(
  agent: Agent,
  chatId: string,
  userMessage: string,
  _userMessageId: string
): Promise<string> {
  const systemPrompt = buildAgentPrompt(agent)
  const history = await getConversationHistory(agent.id, chatId)
  const exportData = buildAgentExport(agent)

  const contract = agent.contracts[0]
  const chainId = contract?.chainId || DEFAULT_CHAIN_ID
  const chain = contract?.chain || getChainOrThrow(chainId)
  const rpcUrl = chain.rpc[0]

  const delegation = await getDelegation(agent.ownerAddress, chainId)
  if (!delegation) {
    return "Owner has not set up delegation yet. Please ask them to complete account setup on the Autonomify dashboard."
  }

  const { tool: autonomifyTool } = forVercelAI({
    export: exportData,
    agentId: agent.id,
    signAndSend: async (tx) => {
      const targetContract = agent.contracts.find(
        (c) => c.address.toLowerCase() === tx.to.toLowerCase()
      )

      if (!targetContract) {
        throw new Error(`Contract ${tx.to} not found`)
      }

      const result = await executeViaCRE({
        userAddress: agent.ownerAddress,
        agentId: agent.id,
        chainId,
        targetContract: tx.to,
        functionAbi: targetContract.abi,
        functionName: "execute",
        args: [],
        value: tx.value?.toString() || "0",
        permissionsContext: delegation.signedDelegation,
        simulateOnly: false,
      })

      if (!result.success || result.mode !== "execution") {
        throw new Error(result.error?.toString() || "Execution failed")
      }

      return result.txHash || ""
    },
  })

  const messages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ]

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

  await pruneOldMessages(agent.id, chatId)
  return responseText
}

export function clearBotInstance(agentId: string): void {
  botInstances.delete(agentId)
}
