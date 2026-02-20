/**
 * Conversation History Store
 *
 * Manages conversation history for maintaining context across messages.
 * Uses a sliding window of recent messages to keep context manageable.
 *
 * Key features:
 * - Idempotency via channelMessageId (prevents duplicate processing)
 * - Status tracking (pending -> processing -> completed/error)
 * - Reply linking (assistant messages link to user messages)
 */

import { eq, and, desc, isNull, notInArray, lt } from "drizzle-orm"
import { db, conversationMessages } from "@/lib/db"
import type { CoreMessage } from "ai"

const MAX_HISTORY_MESSAGES = 20

export type MessageRole = "user" | "assistant" | "system" | "tool"
export type MessageStatus = "pending" | "processing" | "completed" | "error"

export interface StoredMessage {
  role: MessageRole
  content: string
  toolCallId?: string
  toolName?: string
  toolResult?: unknown
}

export interface AddMessageOptions {
  channelMessageId?: string
  replyToMessageId?: string
  status?: MessageStatus
}


export async function getConversationHistory(
  agentId: string,
  chatId: string
): Promise<CoreMessage[]> {
  const messages = await db.query.conversationMessages.findMany({
    where: and(
      eq(conversationMessages.agentId, agentId),
      eq(conversationMessages.chatId, chatId),
      // Exclude deleted messages from history
      eq(conversationMessages.isDeleted, 0)
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


/**
 * Check if a message has already been processed (idempotency check)
 * Returns the existing message if found, null otherwise
 */
export async function findMessageByChannelId(
  agentId: string,
  chatId: string,
  channelMessageId: string
) {
  return db.query.conversationMessages.findFirst({
    where: and(
      eq(conversationMessages.agentId, agentId),
      eq(conversationMessages.chatId, chatId),
      eq(conversationMessages.channelMessageId, channelMessageId)
    ),
  })
}

/**
 * Add a user message with idempotency support.
 * Returns { isNew: true, messageId } for new messages
 * Returns { isNew: false, status } for already-processed messages
 */
export async function addUserMessage(
  agentId: string,
  chatId: string,
  content: string,
  options?: AddMessageOptions
): Promise<{ isNew: boolean; messageId?: string; status?: MessageStatus }> {
  // Check for duplicate if channelMessageId provided
  if (options?.channelMessageId) {
    const existing = await findMessageByChannelId(
      agentId,
      chatId,
      options.channelMessageId
    )
    if (existing) {
      return {
        isNew: false,
        messageId: existing.id,
        status: existing.status as MessageStatus,
      }
    }
  }

  const [inserted] = await db
    .insert(conversationMessages)
    .values({
      agentId,
      chatId,
      role: "user",
      content,
      channelMessageId: options?.channelMessageId,
      status: "processing",
    })
    .returning({ id: conversationMessages.id })

  return { isNew: true, messageId: inserted.id }
}


/**
 * Add an assistant message and mark the user message as completed
 */
export async function addAssistantMessage(
  agentId: string,
  chatId: string,
  content: string,
  options?: AddMessageOptions
): Promise<void> {
  await db.insert(conversationMessages).values({
    agentId,
    chatId,
    role: "assistant",
    content,
    channelMessageId: options?.channelMessageId,
    replyToMessageId: options?.replyToMessageId,
  })

  // Mark the user message as completed
  if (options?.replyToMessageId) {
    await db
      .update(conversationMessages)
      .set({ status: "completed" })
      .where(eq(conversationMessages.id, options.replyToMessageId))
  }
}

/**
 * Mark a message as errored (prevents retry loops)
 */
export async function markMessageError(
  messageId: string,
  errorMessage: string
): Promise<void> {
  await db
    .update(conversationMessages)
    .set({ status: "error", errorMessage })
    .where(eq(conversationMessages.id, messageId))
}

/**
 * Soft delete a message by its channel message ID.
 * The message remains in DB for audit but is excluded from history.
 */
export async function deleteMessageByChannelId(
  agentId: string,
  chatId: string,
  channelMessageId: string
): Promise<boolean> {
  const result = await db
    .update(conversationMessages)
    .set({ isDeleted: 1 })
    .where(
      and(
        eq(conversationMessages.agentId, agentId),
        eq(conversationMessages.chatId, chatId),
        eq(conversationMessages.channelMessageId, channelMessageId)
      )
    )
    .returning({ id: conversationMessages.id })

  return result.length > 0
}

/**
 * Soft delete a message by its DB ID
 */
export async function softDeleteMessage(messageId: string): Promise<boolean> {
  const result = await db
    .update(conversationMessages)
    .set({ isDeleted: 1 })
    .where(eq(conversationMessages.id, messageId))
    .returning({ id: conversationMessages.id })

  return result.length > 0
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
  // Get IDs of messages to keep (most recent N)
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

  // No messages to keep means nothing to prune against
  if (keepIds.length === 0) return

  // Bulk delete all messages NOT in the keep list (single query)
  await db
    .delete(conversationMessages)
    .where(
      and(
        eq(conversationMessages.agentId, agentId),
        eq(conversationMessages.chatId, chatId),
        notInArray(conversationMessages.id, keepIds)
      )
    )
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
