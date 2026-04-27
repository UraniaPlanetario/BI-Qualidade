-- Consolida tarefas atribuídas a "Astrônomos" + custom fields do lead em uma tabela
-- pronta pra dashboard. Refresh truncate-and-insert.

CREATE TABLE IF NOT EXISTS gold.agendamentos_astronomos (
  task_id              bigint PRIMARY KEY,
  lead_id              bigint,
  -- Tarefa
  nome_tarefa          text,        -- text da task (cidade - UF)
  status_tarefa        text,        -- 'aberta' | 'completa' | 'atrasada'
  data_criacao         timestamptz,
  data_conclusao       timestamptz, -- complete_till
  is_completed         boolean,
  task_type_id         bigint,
  tipo_tarefa          text,        -- nome completo do tipo: 'PROCÓPIO VISITA'
  desc_tarefa          text,        -- 'VISITA' | 'PRÉ' | 'RESERVA' | 'Ñ MARCAR'
  astronomo            text,        -- 'PROCÓPIO'
  criado_por_id        bigint,
  -- Lead (custom_fields)
  nome_escola          text,
  valor_venda          numeric,
  produtos             text,
  numero_alunos        text,
  data_agendamento     timestamptz,
  local_instalacao     text,
  turno                text,
  conteudo_apresentacao text,
  responsavel_evento   text,
  numero_diarias       text,
  cupula               text,
  segmento             text,
  cidade               text,
  uf                   text,
  cidade_estado        text,
  endereco             text,
  coordenada           text,
  latitude             numeric,
  longitude            numeric,
  telefone_responsavel text,
  nota_nps             text,
  nps                  text,
  avaliacao_geral      text,
  avaliacao_astronomo  text,
  brinde               text,
  refreshed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agend_astronomo ON gold.agendamentos_astronomos (astronomo);
CREATE INDEX IF NOT EXISTS idx_agend_data_agendamento ON gold.agendamentos_astronomos (data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agend_lead ON gold.agendamentos_astronomos (lead_id);

ALTER TABLE gold.agendamentos_astronomos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read_all_authenticated" ON gold.agendamentos_astronomos
  FOR SELECT TO authenticated, anon USING (true);

CREATE OR REPLACE FUNCTION gold.refresh_agendamentos_astronomos()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '300s'
AS $function$
DECLARE row_count INT;
BEGIN
  TRUNCATE gold.agendamentos_astronomos;

  INSERT INTO gold.agendamentos_astronomos
    (task_id, lead_id, nome_tarefa, status_tarefa, data_criacao, data_conclusao,
     is_completed, task_type_id, tipo_tarefa, desc_tarefa, astronomo, criado_por_id,
     nome_escola, valor_venda, produtos, numero_alunos, data_agendamento,
     local_instalacao, turno, conteudo_apresentacao, responsavel_evento,
     numero_diarias, cupula, segmento, cidade, uf, cidade_estado, endereco,
     coordenada, latitude, longitude, telefone_responsavel,
     nota_nps, nps, avaliacao_geral, avaliacao_astronomo, brinde)
  SELECT
    t.id AS task_id,
    t.entity_id AS lead_id,
    NULLIF(t.text, '') AS nome_tarefa,
    -- status: aberta / completa / atrasada
    CASE
      WHEN t.is_completed THEN 'completa'
      WHEN t.complete_till < now() THEN 'atrasada'
      ELSE 'aberta'
    END AS status_tarefa,
    t.created_at AS data_criacao,
    t.complete_till AS data_conclusao,
    COALESCE(t.is_completed, false) AS is_completed,
    t.task_type_id,
    tt.name AS tipo_tarefa,
    tt.tipo_tarefa AS desc_tarefa,
    tt.astronomo AS astronomo,
    t.created_by AS criado_por_id,

    -- Lead (custom fields do lead vinculado)
    l.custom_fields->>'Nome da escola' AS nome_escola,
    l.price AS valor_venda,
    l.custom_fields->>'Produtos' AS produtos,
    l.custom_fields->>'Nº de alunos' AS numero_alunos,
    CASE WHEN (l.custom_fields->>'Data e Hora do Agendamento') ~ '^\d{9,10}$'
      THEN to_timestamp((l.custom_fields->>'Data e Hora do Agendamento')::bigint)
      ELSE NULL END AS data_agendamento,
    l.custom_fields->>'Local coberto?' AS local_instalacao,
    l.custom_fields->>'Turnos do evento' AS turno,
    l.custom_fields->>'Conteúdo da apresentação' AS conteudo_apresentacao,
    l.custom_fields->>'Responsável pelo evento' AS responsavel_evento,
    l.custom_fields->>'Nº de Diárias' AS numero_diarias,
    l.custom_fields->>'Cúpula' AS cupula,
    l.custom_fields->>'Faixa de alunos' AS segmento,
    -- Cidade / UF parseados de 'Cidade - Estado'
    CASE WHEN l.custom_fields->>'Cidade - Estado' ~ ' - '
      THEN trim(split_part(l.custom_fields->>'Cidade - Estado', ' - ', 1))
      ELSE l.custom_fields->>'Cidade - Estado' END AS cidade,
    CASE WHEN l.custom_fields->>'Cidade - Estado' ~ ' - '
      THEN trim(split_part(l.custom_fields->>'Cidade - Estado', ' - ', 2))
      ELSE NULL END AS uf,
    l.custom_fields->>'Cidade - Estado' AS cidade_estado,
    NULL::text AS endereco, -- não há campo direto; pode ser preenchido futuramente
    l.custom_fields->>'Coordenada' AS coordenada,
    -- Parse lat,long do formato "lat, long"
    CASE WHEN l.custom_fields->>'Coordenada' ~ '^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$'
      THEN trim(split_part(l.custom_fields->>'Coordenada', ',', 1))::numeric
      ELSE NULL END AS latitude,
    CASE WHEN l.custom_fields->>'Coordenada' ~ '^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$'
      THEN trim(split_part(l.custom_fields->>'Coordenada', ',', 2))::numeric
      ELSE NULL END AS longitude,
    l.custom_fields->>'Telefone responsável pelo evento' AS telefone_responsavel,
    l.custom_fields->>'Nota NPS' AS nota_nps,
    l.custom_fields->>'NPS' AS nps,
    l.custom_fields->>'Avaliação da escola sobre exp. Geral' AS avaliacao_geral,
    l.custom_fields->>'Avaliação da escola sobre Astrônomo' AS avaliacao_astronomo,
    l.custom_fields->>'Brinde' AS brinde
  FROM bronze.kommo_tasks t
  JOIN bronze.kommo_task_types tt ON tt.id = t.task_type_id
  LEFT JOIN bronze.kommo_leads_raw l ON l.id = t.entity_id
  WHERE t.responsible_user_name = 'Astrônomos'
    AND tt.astronomo IS NOT NULL;

  GET DIAGNOSTICS row_count = ROW_COUNT;
  RETURN row_count || ' rows inserted';
END;
$function$;
