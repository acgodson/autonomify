import {
  pgTable,
  text,
  timestamp,
  jsonb,
  uuid,
  integer,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { relations } from "drizzle-orm"

export const agentTypeEnum = pgEnum("agent_type", ["telegram", "discord", "self_hosted"])

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  type: agentTypeEnum("type").notNull().default("telegram"),
  ownerAddress: text("owner_address").notNull(),
  telegramBotToken: text("telegram_bot_token"),
  agentIdBytes: text("agent_id_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})

export const delegationSyncStatusEnum = pgEnum("delegation_sync_status", ["pending", "synced", "failed"])

export const delegations = pgTable("delegations", {
  id: uuid("id").primaryKey().defaultRandom(),
  userAddress: text("user_address").notNull(),
  delegationHash: text("delegation_hash").notNull(),
  signedDelegation: text("signed_delegation").notNull(),
  executorAddress: text("executor_address").notNull(),
  chainId: integer("chain_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userChainUnique: uniqueIndex("delegations_user_chain_idx").on(table.userAddress, table.chainId),
}))

export const agentPolicies = pgTable("agent_policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  userAddress: text("user_address").notNull(),
  dailyLimit: text("daily_limit").notNull().default("100000000"),
  txLimit: text("tx_limit").notNull().default("25000000"),
  enableTimeWindow: integer("enable_time_window").notNull().default(0),
  startHour: integer("start_hour").notNull().default(0),
  endHour: integer("end_hour").notNull().default(24),
  whitelistRoot: text("whitelist_root"),
  policyVersion: integer("policy_version").notNull().default(1),
  syncStatus: delegationSyncStatusEnum("sync_status").notNull().default("pending"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  agentUnique: uniqueIndex("agent_policies_agent_idx").on(table.agentId),
}))

export const agentAllowedContracts = pgTable("agent_allowed_contracts", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  contractAddress: text("contract_address").notNull(),
  contractName: text("contract_name"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
}, (table) => ({
  agentContractUnique: uniqueIndex("agent_allowed_contracts_idx").on(table.agentId, table.contractAddress),
}))

export const executionStatusEnum = pgEnum("execution_status", ["pending", "simulating", "proving", "executing", "success", "failed"])

export const executions = pgTable("executions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  userAddress: text("user_address").notNull(),
  targetContract: text("target_contract").notNull(),
  functionName: text("function_name").notNull(),
  calldata: text("calldata").notNull(),
  value: text("value").notNull().default("0"),
  chainId: integer("chain_id").notNull(),
  status: executionStatusEnum("status").notNull().default("pending"),
  nullifier: text("nullifier"),
  txHash: text("tx_hash"),
  gasUsed: integer("gas_used"),
  errorMessage: text("error_message"),
  simulationResult: jsonb("simulation_result"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
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
export const messageStatusEnum = pgEnum("message_status", ["pending", "processing", "completed", "error"])

export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  chatId: text("chat_id").notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  toolCallId: text("tool_call_id"),
  toolName: text("tool_name"),
  toolResult: jsonb("tool_result"),
  channelMessageId: text("channel_message_id"),
  replyToMessageId: uuid("reply_to_message_id"),
  status: messageStatusEnum("status").default("completed"),
  errorMessage: text("error_message"),
  isDeleted: integer("is_deleted").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export const agentsRelations = relations(agents, ({ many }) => ({
  contracts: many(agentContracts),
  messages: many(conversationMessages),
  policies: many(agentPolicies),
  allowedContracts: many(agentAllowedContracts),
  executions: many(executions),
}))

export const delegationsRelations = relations(delegations, ({ }) => ({}))

export const agentPoliciesRelations = relations(agentPolicies, ({ one }) => ({
  agent: one(agents, {
    fields: [agentPolicies.agentId],
    references: [agents.id],
  }),
}))

export const agentAllowedContractsRelations = relations(agentAllowedContracts, ({ one }) => ({
  agent: one(agents, {
    fields: [agentAllowedContracts.agentId],
    references: [agents.id],
  }),
}))

export const executionsRelations = relations(executions, ({ one }) => ({
  agent: one(agents, {
    fields: [executions.agentId],
    references: [agents.id],
  }),
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
export type Delegation = typeof delegations.$inferSelect
export type NewDelegation = typeof delegations.$inferInsert
export type AgentPolicy = typeof agentPolicies.$inferSelect
export type NewAgentPolicy = typeof agentPolicies.$inferInsert
export type AgentAllowedContract = typeof agentAllowedContracts.$inferSelect
export type NewAgentAllowedContract = typeof agentAllowedContracts.$inferInsert
export type Execution = typeof executions.$inferSelect
export type NewExecution = typeof executions.$inferInsert
export type AgentContract = typeof agentContracts.$inferSelect
export type NewAgentContract = typeof agentContracts.$inferInsert
export type ConversationMessage = typeof conversationMessages.$inferSelect
export type NewConversationMessage = typeof conversationMessages.$inferInsert
