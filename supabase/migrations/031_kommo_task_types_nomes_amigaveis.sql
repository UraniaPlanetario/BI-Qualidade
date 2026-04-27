-- Padroniza coluna `astronomo` em bronze.kommo_task_types pra bater com os nomes
-- usados no custom field "Astrônomo" dos leads. Antes os nomes estavam em caixa
-- alta sem acento ("PROCÓPIO", "MATHEUSM", "MATHEUSN", "ROGERIO"), agora ficam
-- como "Procópio", "Matheus Magalhães", "Matheus Nascimento", "Rogério".
-- Isso simplifica a auditoria de nome (compara direto sem normalização extra)
-- e desambigua os dois Matheus.

UPDATE bronze.kommo_task_types SET astronomo = 'Aline'              WHERE astronomo = 'ALINE';
UPDATE bronze.kommo_task_types SET astronomo = 'Bruno'              WHERE astronomo = 'BRUNO';
UPDATE bronze.kommo_task_types SET astronomo = 'Cristian'           WHERE astronomo = 'CRISTIAN';
UPDATE bronze.kommo_task_types SET astronomo = 'Emerson'            WHERE astronomo = 'EMERSON';
UPDATE bronze.kommo_task_types SET astronomo = 'Marlon'             WHERE astronomo = 'MARLON';
UPDATE bronze.kommo_task_types SET astronomo = 'Matheus Magalhães'  WHERE astronomo = 'MATHEUSM';
UPDATE bronze.kommo_task_types SET astronomo = 'Matheus Nascimento' WHERE astronomo = 'MATHEUSN';
UPDATE bronze.kommo_task_types SET astronomo = 'Milenko'            WHERE astronomo = 'MILENKO';
UPDATE bronze.kommo_task_types SET astronomo = 'Nathalia'           WHERE astronomo = 'NATHALIA';
UPDATE bronze.kommo_task_types SET astronomo = 'Olivia'             WHERE astronomo = 'OLIVIA';
UPDATE bronze.kommo_task_types SET astronomo = 'Paulo'              WHERE astronomo = 'PAULO';
UPDATE bronze.kommo_task_types SET astronomo = 'Priscilla'          WHERE astronomo = 'PRISCILLA';
UPDATE bronze.kommo_task_types SET astronomo = 'Procópio'           WHERE astronomo = 'PROCÓPIO';
UPDATE bronze.kommo_task_types SET astronomo = 'Roberto'            WHERE astronomo = 'ROBERTO';
UPDATE bronze.kommo_task_types SET astronomo = 'Rogério'            WHERE astronomo = 'ROGERIO';
UPDATE bronze.kommo_task_types SET astronomo = 'Samantha'           WHERE astronomo = 'SAMANTHA';
UPDATE bronze.kommo_task_types SET astronomo = 'Sione'              WHERE astronomo = 'SIONE';
UPDATE bronze.kommo_task_types SET astronomo = 'Thales'             WHERE astronomo = 'THALES';
UPDATE bronze.kommo_task_types SET astronomo = 'Thiago'             WHERE astronomo = 'THIAGO';

-- Repopula a gold com os nomes novos
SELECT gold.refresh_agendamentos_astronomos();
