import { Bot } from "grammy"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { getChainOrThrow } from "autonomify-sdk"
import {
  type Agent,
  buildAgentPrompt,
  buildAgentExport,
  getDelegation,
  getConversationHistory,
  addUserMessage,
  addAssistantMessage,
  clearConversation,
  pruneOldMessages,
  markMessageError,
} from "@/lib/agent"
import { createAgentTools } from "@/lib/channels/tools"
import { DEFAULT_CHAIN_ID } from "@/lib/chains"

const botInstances = new Map<string, Bot>()

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
        const name =
          (c.metadata.name as string) ||
          c.analysis?.name ||
          c.analysis?.contractType ||
          c.address.slice(0, 10)
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

    // Send typing indicator but don't await - it can fail due to network issues
    ctx.replyWithChatAction("typing").catch(() => {
      // Ignore typing indicator failures - they don't affect message processing
    })

    try {
      const response = await processWithLLM(agent, chatId, text)

      // Try to send with markdown, fallback to plain text
      const sentMessage = await ctx.reply(response, { parse_mode: "Markdown" }).catch(async (err) => {
        // If markdown fails, try plain text
        console.log("Markdown reply failed, trying plain text:", err.message)
        return ctx.reply(response).catch((plainErr) => {
          console.error("Plain text reply also failed:", plainErr.message)
          throw plainErr
        })
      })

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
      // Try to notify user of error, but don't fail if network is down
      await ctx.reply("Sorry, I encountered an error processing your request.").catch(() => {
        console.error("Failed to send error message to user")
      })
    }
  })

  botInstances.set(agent.id, bot)
  return bot
}

async function processWithLLM(
  agent: Agent,
  chatId: string,
  userMessage: string
): Promise<string> {
  const systemPrompt = buildAgentPrompt(agent)
  const history = await getConversationHistory(agent.id, chatId)
  const exportData = buildAgentExport(agent)

  console.log(`[LLM] Processing message: "${userMessage}"`)
  console.log(`[LLM] History length: ${history.length} messages`)
  console.log(`[LLM] Available contracts: ${Object.keys(exportData.contracts).join(", ")}`)

  const contract = agent.contracts[0]
  const chainId = contract?.chainId || DEFAULT_CHAIN_ID
  const chain = contract?.chain || getChainOrThrow(chainId)
  const rpcUrl = chain.rpc[0]

  const delegation = await getDelegation(agent.ownerAddress, chainId)
  if (!delegation) {
    return "Owner has not set up delegation yet. Please ask them to complete account setup on the Autonomify dashboard."
  }

  const tools = createAgentTools({
    exportData,
    agentIdBytes: agent.agentIdBytes!,
    ownerAddress: agent.ownerAddress,
    signedDelegation: delegation.signedDelegation,
    chainId,
    rpcUrl,
  })

  const messages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ]

  const toolCallHistory: string[] = []
  let loopDetected = false
  const abortController = new AbortController()

  console.log(`[LLM] Starting generateText with ${Object.keys(tools).length} tools:`, Object.keys(tools))

  const result = await generateText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
    abortSignal: abortController.signal,
    onStepFinish: ({ toolCalls, toolResults, text }) => {
      console.log(`[LLM] Step finished:`)
      console.log(`[LLM]   - Tool calls: ${toolCalls?.length || 0}`)
      console.log(`[LLM]   - Text: ${text ? text.slice(0, 100) + "..." : "none"}`)

      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          console.log(`[LLM]   - Tool: ${tc.toolName}`)
          console.log(`[LLM]   - Args: ${JSON.stringify(tc.args).slice(0, 200)}`)

          const callSig = `${tc.toolName}:${JSON.stringify(tc.args)}`
          const sameCallCount = toolCallHistory.filter((h) => h === callSig).length
          toolCallHistory.push(callSig)

          if (sameCallCount >= 1) {
            console.log("[LLM] Loop detected - aborting:", callSig)
            loopDetected = true
            abortController.abort()
          }
        }
      }

      if (toolResults && toolResults.length > 0) {
        for (const tr of toolResults) {
          console.log(`[LLM]   - Result for ${tr.toolName}: ${JSON.stringify(tr.result).slice(0, 200)}`)
        }
      }
    },
  }).catch((err) => {
    if (err.name === "AbortError" || loopDetected) {
      console.log("[LLM] Aborted due to loop detection")
      return { text: "", steps: [] }
    }
    console.error("[LLM] Error:", err)
    throw err
  })

  let responseText: string
  if (loopDetected) {
    responseText = result.text || "I ran into an issue with that request. Please try rephrasing."
  } else {
    responseText = result.text || "I processed your request but have no response."
  }

  console.log(`[LLM] Final response length: ${responseText.length} chars`)
  console.log(`[LLM] Total tool calls made: ${toolCallHistory.length}`)

  await pruneOldMessages(agent.id, chatId)
  return responseText
}

export function clearBotInstance(agentId: string): void {
  botInstances.delete(agentId)
}
