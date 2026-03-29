-- Multiple Pipelines
CREATE TABLE IF NOT EXISTS pipelines (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add pipeline_id to pipeline_stages
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS pipeline_id UUID REFERENCES pipelines(id);

-- Contact Lists
CREATE TABLE IF NOT EXISTS contact_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#E86A2A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add list_id to contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS list_id UUID REFERENCES contact_lists(id);

-- Migrate existing data: create a default pipeline and link existing stages
DO $$
DECLARE
  ws RECORD;
  pipe_id UUID;
BEGIN
  FOR ws IN SELECT DISTINCT workspace_id FROM pipeline_stages LOOP
    INSERT INTO pipelines (workspace_id, name, is_default)
    VALUES (ws.workspace_id, 'Sales Pipeline', TRUE)
    RETURNING id INTO pipe_id;

    UPDATE pipeline_stages SET pipeline_id = pipe_id WHERE workspace_id = ws.workspace_id AND pipeline_id IS NULL;
  END LOOP;
END $$;

-- Create a default "All Contacts" list for each workspace
DO $$
DECLARE
  ws RECORD;
BEGIN
  FOR ws IN SELECT DISTINCT workspace_id FROM contacts WHERE list_id IS NULL LOOP
    INSERT INTO contact_lists (workspace_id, name, color)
    VALUES (ws.workspace_id, 'All Contacts', '#E86A2A');
  END LOOP;
END $$;
