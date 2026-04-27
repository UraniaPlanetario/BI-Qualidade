-- Adiciona coluna `astronomo_card` (custom field "Astrônomo" do lead, ex: "Marlon")
-- e separa de `responsavel_evento` (custom field "Responsável pelo evento" — contato da escola).
-- A auditoria de nome compara astronomo (do task_type_id) vs astronomo_card (do lead).

ALTER TABLE gold.agendamentos_astronomos
  ADD COLUMN IF NOT EXISTS astronomo_card text;

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
     local_instalacao, turno, conteudo_apresentacao, responsavel_evento, astronomo_card,
     numero_diarias, cupula, segmento, cidade, uf, cidade_estado, endereco,
     coordenada, latitude, longitude, telefone_responsavel,
     nota_nps, nps, avaliacao_geral, avaliacao_astronomo, brinde)
  SELECT
    t.id AS task_id,
    t.entity_id AS lead_id,
    NULLIF(t.text, '') AS nome_tarefa,
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
    l.custom_fields->>'Astrônomo' AS astronomo_card,
    l.custom_fields->>'Nº de Diárias' AS numero_diarias,
    l.custom_fields->>'Cúpula' AS cupula,
    l.custom_fields->>'Faixa de alunos' AS segmento,
    CASE WHEN l.custom_fields->>'Cidade - Estado' ~ ' - '
      THEN trim(split_part(l.custom_fields->>'Cidade - Estado', ' - ', 1))
      ELSE l.custom_fields->>'Cidade - Estado' END AS cidade,
    CASE WHEN l.custom_fields->>'Cidade - Estado' ~ ' - '
      THEN trim(split_part(l.custom_fields->>'Cidade - Estado', ' - ', 2))
      ELSE NULL END AS uf,
    l.custom_fields->>'Cidade - Estado' AS cidade_estado,
    NULL::text AS endereco,
    l.custom_fields->>'Coordenada' AS coordenada,
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
