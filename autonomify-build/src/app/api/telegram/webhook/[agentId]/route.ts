import { NextRequest, NextResponse } from "next/server"
import { Bot, webhookCallback } from "grammy"
import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"
import { getAgent } from "@/lib/agent-store"
import { buildSystemPrompt } from "@/lib/agent-prompt"
import { simulate, execute, getNativeBalance } from "@/lib/executor"
import { bscTestnet } from "@/lib/chains"
import type { AgentConfig } from "@/lib/types"

const botInstances = new Map<string, Bot>()

function getOrCreateBot(agent: AgentConfig): Bot {
  const existing = botInstances.get(agent.id)
  if (existing) return existing

  const bot = new Bot(agent.telegramBotToken)

  bot.command("start", async (ctx) => {
    const contractList = agent.contracts
      .map((c) => {
        const name = (c.metadata.name as string) || c.address.slice(0, 10)
        return `• ${name} (${c.functions.length} functions)`
      })
      .join("\n")

    await ctx.reply(
      `Welcome! I'm ${agent.name}, your onchain agent.\n\n` +
        `My wallet: \`${agent.wallet.address}\`\n\n` +
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
      `My wallet address:\n\`${agent.wallet.address}\`\n\n` +
        `[View on BscScan](https://testnet.bscscan.com/address/${agent.wallet.address})`,
      { parse_mode: "Markdown" }
    )
  })

  bot.command("balance", async (ctx) => {
    try {
      const { formatted } = await getNativeBalance(
        bscTestnet,
        agent.wallet.address
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

async function processWithLLM(
  agent: AgentConfig,
  userMessage: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt(agent)

  const result = await generateText({
    model: openai("gpt-4o-mini"),
    system: systemPrompt,
    prompt: userMessage,
    tools: {
      simulate_function: tool({
        description:
          "Simulate a contract function call without executing it (dry run). Use this to check if a transaction would succeed before executing.",
        parameters: z.object({
          contractAddress: z.string().describe("The contract address"),
          functionName: z.string().describe("The function name to call"),
          args: z.array(z.string()).describe("The function arguments as strings"),
          value: z
            .string()
            .optional()
            .describe("BNB value to send (for payable functions), in ether units"),
        }),
        execute: async ({ contractAddress, functionName, args, value }) => {
          const contract = agent.contracts.find(
            (c) => c.address.toLowerCase() === contractAddress.toLowerCase()
          )
          if (!contract) return { error: "Contract not found on this agent" }

          const result = await simulate(agent, contract, {
            contractAddress,
            functionName,
            args,
            value,
          })
          return result
        },
      }),
      execute_function: tool({
        description:
          "Execute a contract function call onchain. This will send a real transaction. Only use after user confirms.",
        parameters: z.object({
          contractAddress: z.string().describe("The contract address"),
          functionName: z.string().describe("The function name to call"),
          args: z.array(z.string()).describe("The function arguments as strings"),
          value: z
            .string()
            .optional()
            .describe("BNB value to send (for payable functions), in ether units"),
        }),
        execute: async ({ contractAddress, functionName, args, value }) => {
          const contract = agent.contracts.find(
            (c) => c.address.toLowerCase() === contractAddress.toLowerCase()
          )
          if (!contract) return { error: "Contract not found on this agent" }

          const result = await execute(agent, contract, {
            contractAddress,
            functionName,
            args,
            value,
          })
          return result
        },
      }),
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
  const agent = getAgent(params.agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const bot = getOrCreateBot(agent)
  const handler = webhookCallback(bot, "std/http")

  return handler(request)
}
