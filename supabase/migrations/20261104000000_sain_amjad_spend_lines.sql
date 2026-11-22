-- Line-wise spend entries against money received from Sain Amjad

CREATE TABLE IF NOT EXISTS sain_amjad_spend_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES sain_amjad_entries(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  spend_date date NOT NULL DEFAULT (current_date),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sain_amjad_spend_lines_entry_idx ON sain_amjad_spend_lines(entry_id);

ALTER TABLE sain_amjad_spend_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sain_amjad_spend_select" ON sain_amjad_spend_lines;
CREATE POLICY "sain_amjad_spend_select"
  ON sain_amjad_spend_lines FOR SELECT TO authenticated
  USING (can_access_shared_ledger());

DROP POLICY IF EXISTS "sain_amjad_spend_insert" ON sain_amjad_spend_lines;
CREATE POLICY "sain_amjad_spend_insert"
  ON sain_amjad_spend_lines FOR INSERT TO authenticated
  WITH CHECK (can_access_shared_ledger());

DROP POLICY IF EXISTS "sain_amjad_spend_delete" ON sain_amjad_spend_lines;
CREATE POLICY "sain_amjad_spend_delete"
  ON sain_amjad_spend_lines FOR DELETE TO authenticated
  USING (can_access_shared_ledger());

GRANT SELECT, INSERT, DELETE ON sain_amjad_spend_lines TO authenticated;
