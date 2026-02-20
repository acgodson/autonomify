/**
 * Conversation History Store
 *
 * Manages conversation history for maintaining context across messages.
 * Uses a sliding window of recent messages to keep context manageable.
 */

import { eq, and, desc } from "drizzle-orm"
import { db, conversationMessages } from "@/lib/db"
import type { CoreMessage } from "ai"

const MAX_HISTORY_MESSAGES = 20

export type MessageRole = "user" | "assistant" | "system" | "tool"

export interface StoredMessage {
  role: MessageRole
  content: string
  toolCallId?: string
  toolName?: string
  toolResult?: unknown
}


export async function getConversationHistory(
  agentId: string,
  chatId: string
): Promise<CoreMessage[]> {
  const messages = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.agentId, agentId),
      eq(conversationMessages.chatId, chatId)
    ),
    orderBy: [desc(conversationMessages.createdAt)],
    limit: MAX_HISTORY_MESSAGES,
  })

  messages.reverse()

  return messages.map((msg) => {
    if (msg.role === "tool" && msg.toolCallId) {
      return {
        role: "tool" as const,
        content: [
          {
            type: "tool-result" as const,
            toolCallId: msg.toolCallId,
            toolName: msg.toolName || "",
            result: msg.toolResult,
          },
        ],
      }
    }

    return {
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
    }
  })
}


export async function addUserMessage(
  agentId: string,
  chatId: string,
  content: string
): Promise<void> {
  await db.insert(conversationMessages).values({
    agentId,
    chatId,
    role: "user",
    content,
  })
}


export async function addAssistantMessage(
  agentId: string,
  chatId: string,
  content: string
): Promise<void> {
  await db.insert(conversationMessages).values({
    agentId,
    chatId,
    role: "assistant",
    content,
  })
}


export async function addToolMessage(
  agentId: string,
  chatId: string,
  toolCallId: string,
  toolName: string,
  result: unknown
): Promise<void> {
  await db.insert(conversationMessages).values({
    agentId,
    chatId,
    role: "tool",
    content: JSON.stringify(result),
    toolCallId,
    toolName,
    toolResult: result,
  })
}

export async function pruneOldMessages(
  agentId: string,
  chatId: string,
  keepCount: number = MAX_HISTORY_MESSAGES
): Promise<void> {
  const toKeep = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.agentId, agentId),
      eq(conversationMessages.chatId, chatId)
    ),
    orderBy: [desc(conversationMessages.createdAt)],
    limit: keepCount,
    columns: { id: true },
  })

  const keepIds = toKeep.map((m) => m.id)

  if (keepIds.length === 0) return

  const allMessages = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.agentId, agentId),
      eq(conversationMessages.chatId, chatId)
    ),
    columns: { id: true },
  })

  const toDelete = allMessages
    .filter((m) => !keepIds.includes(m.id))
    .map((m) => m.id)

  for (const id of toDelete) {
    await db.delete(conversationMessages).where(eq(conversationMessages.id, id))
  }
}

export async function clearConversation(
  agentId: string,
  chatId: string
): Promise<void> {
  await db
    .delete(conversationMessages)
    .where(
      and(
        eq(conversationMessages.agentId, agentId),
        eq(conversationMessages.chatId, chatId)
      )
    )
}
