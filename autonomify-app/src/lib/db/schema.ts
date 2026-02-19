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

export const agentsRelations = relations(agents, ({ many }) => ({
  contracts: many(agentContracts),
}))

export const agentContractsRelations = relations(agentContracts, ({ one }) => ({
  agent: one(agents, {
    fields: [agentContracts.agentId],
    references: [agents.id],
  }),
}))

export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
export type AgentContract = typeof agentContracts.$inferSelect
export type NewAgentContract = typeof agentContracts.$inferInsert
