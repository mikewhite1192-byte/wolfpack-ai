-- Add Meta/Facebook OAuth fields to workspaces
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_page_id TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_page_name TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_page_access_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_user_access_token TEXT;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_connected BOOLEAN DEFAULT FALSE;
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS meta_connected_at TIMESTAMPTZ;
