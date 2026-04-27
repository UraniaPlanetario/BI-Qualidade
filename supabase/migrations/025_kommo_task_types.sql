-- Tabela de mapeamento task_type_id → nome (ex: "CRISTIAN VISITA", "ALINE PRÉ").
-- Populada manualmente via edge function sync-kommo-task-types (não roda automaticamente
-- no cron — task types mudam raramente, executar quando precisar atualizar).

CREATE TABLE IF NOT EXISTS bronze.kommo_task_types (
  id bigint PRIMARY KEY,
  name text NOT NULL,
  color text,
  icon_id bigint,
  synced_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bronze.kommo_task_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_authenticated" ON bronze.kommo_task_types
  FOR SELECT TO authenticated, anon USING (true);
