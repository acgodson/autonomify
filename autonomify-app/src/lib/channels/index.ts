/**
 * Channels Module
 *
 * Thin wrappers for different communication channels.
 * Each channel imports from @/lib/agents for core functionality.
 *
 * Supported channels:
 * - Telegram: @/lib/channels/telegram
 * - Discord: @/lib/channels/discord (coming soon)
 */

export { getOrCreateBot as getTelegramBot, clearBotInstance as clearTelegramBot } from "./telegram"
