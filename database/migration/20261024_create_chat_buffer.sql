-- Migration: 20261024_create_chat_buffer.sql
-- Description: Create chat_buffer and user_summarize_settings tables for group message buffering and summarization preferences

-- 1. Chat buffer table for ephemeral group message retention (AES-256-GCM encrypted)
CREATE TABLE IF NOT EXISTS chat_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(30) NOT NULL,            -- 'whatsapp', 'telegram', 'discord', 'slack'
    chat_id VARCHAR(100) NOT NULL,            -- Group / Room identifier
    chat_name TEXT,                           -- Encrypted group title (AES-256-GCM)
    sender_name TEXT,                         -- Encrypted sender display name (AES-256-GCM)
    message_text TEXT NOT NULL,               -- Encrypted message body (AES-256-GCM)
    is_summarized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for rapid retrieval and cron cleanup
CREATE INDEX IF NOT EXISTS idx_chat_buffer_unsummarized 
    ON chat_buffer(platform, chat_id, is_summarized, created_at);

CREATE INDEX IF NOT EXISTS idx_chat_buffer_cleanup 
    ON chat_buffer(is_summarized, created_at);

-- Comments on table columns
COMMENT ON TABLE chat_buffer IS 'Stores ephemeral, AES-256-GCM encrypted group messages for AI morning summarization.';
COMMENT ON COLUMN chat_buffer.message_text IS 'AES-256-GCM encrypted payload in format iv:authTag:ciphertext';

-- 2. User/Group summarize settings table
CREATE TABLE IF NOT EXISTS user_summarize_settings (
    user_id VARCHAR(100) PRIMARY KEY,
    platform VARCHAR(30) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    schedule_time VARCHAR(5) DEFAULT '08:00',  -- 24h format (HH:mm)
    voice_note_enabled BOOLEAN DEFAULT TRUE,
    language VARCHAR(5) DEFAULT 'en',          -- 'en' or 'id'
    last_run_at TIMESTAMPTZ
);

COMMENT ON TABLE user_summarize_settings IS 'Preferences for automated morning briefing delivery per user or group.';
