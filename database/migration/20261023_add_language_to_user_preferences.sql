-- Migration: 20261023_add_language_to_user_preferences.sql
-- Description: Add language column to user_preferences table for i18n support ('en' or 'id')

ALTER TABLE user_preferences 
ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';

COMMENT ON COLUMN user_preferences.language IS 'User preferred language: en (English default) or id (Indonesian)';
