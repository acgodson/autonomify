import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const agentTypeEnum = pgEnum("agent_type", ["telegram", "discord", "self_hosted"])

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: agentTypeEnum("type").notNull().default("telegram"),
  // Owner's wallet address (who created/owns this agent)
  ownerAddress: text("owner_address").notNull(),
  // For hosted agents (telegram, discord)
  telegramBotToken: text("telegram_bot_token"),
  walletId: text("wallet_id"),
  walletAddress: text("wallet_address"),
  // For self-hosted agents - they manage their own wallet
  // agentId is the bytes32 identifier for AutonomifyExecutor
  agentIdBytes: text("agent_id_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const agentContracts = pgTable("agent_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  address: text("address").notNull(),
  chainId: integer("chain_id").notNull(),
  chainConfig: jsonb("chain_config").notNull(),
  abi: jsonb("abi").notNull(),
  metadata: jsonb("metadata").notNull().default({}),
  functions: jsonb("functions").notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system", "tool"])

// Conversation history for maintaining context
export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  // Chat ID (Telegram chat ID, Discord channel ID, etc.)
  chatId: text("chat_id").notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  // For tool calls, store the tool call info
  toolCallId: text("tool_call_id"),
  toolName: text("tool_name"),
  toolResult: jsonb("tool_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const agentsRelations = relations(agents, ({ many }) => ({
  contracts: many(agentContracts),
  messages: many(conversationMessages),
}))

export const agentContractsRelations = relations(agentContracts, ({ one }) => ({
  agent: one(agents, {
    fields: [agentContracts.agentId],
    references: [agents.id],
  }),
}))

export const conversationMessagesRelations = relations(conversationMessages, ({ one }) => ({
  agent: one(agents, {
    fields: [conversationMessages.agentId],
    references: [agents.id],
  }),
}))

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type AgentContract = typeof agentContracts.$inferSelect
export type NewAgentContract = typeof agentContracts.$inferInsert
export type ConversationMessage = typeof conversationMessages.$inferSelect
export type NewConversationMessage = typeof conversationMessages.$inferInsert
