-- OTIMIZAÇÕES DE PERFORMANCE PARA SCHEDULE_LIST

-- 1. Índices para melhorar performance das consultas mais comuns
-- Índice composto para ordenação principal (date DESC, id DESC)
CREATE INDEX IF NOT EXISTS idx_schedule_list_date_id ON schedule_list (date DESC, id DESC);

-- Índice para filtros por cliente
CREATE INDEX IF NOT EXISTS idx_schedule_list_client ON schedule_list (client);

-- Índice para filtros por status
CREATE INDEX IF NOT EXISTS idx_schedule_list_status ON schedule_list (status);

-- Índice composto para filtros por cliente e status (muito comum)
CREATE INDEX IF NOT EXISTS idx_schedule_list_client_status ON schedule_list (client, status);

-- Índice para filtros por data
CREATE INDEX IF NOT EXISTS idx_schedule_list_date ON schedule_list (date);

-- Índice para filtros por número NFe
CREATE INDEX IF NOT EXISTS idx_schedule_list_number ON schedule_list (number);

-- Índice para filtros por chave NFe
CREATE INDEX IF NOT EXISTS idx_schedule_list_nfe_key ON schedule_list (nfe_key);

-- 2. Índice composto para a consulta principal com paginação
-- Este índice otimiza a consulta com WHERE + ORDER BY + LIMIT
CREATE INDEX IF NOT EXISTS idx_schedule_list_main_query ON schedule_list (client, status, date DESC, id DESC);

-- 3. Índice para consultas de estatísticas
CREATE INDEX IF NOT EXISTS idx_schedule_list_stats ON schedule_list (status, case_count, qt_prod);

-- 4. Verificar se há colunas que podem ser otimizadas
-- ANALISAR O TAMANHO DAS COLUNAS JSON (historic, info)
-- Se essas colunas são muito grandes, considerar movê-las para tabelas separadas

-- 5. Comando para analisar a tabela e atualizar estatísticas
ANALYZE TABLE schedule_list;

-- 6. Verificar índices existentes
-- SHOW INDEX FROM schedule_list;

-- 7. Verificar plano de execução da consulta principal
-- EXPLAIN SELECT id, number, nfe_key, client, date, status, historic, supplier, qt_prod, info, case_count
-- FROM schedule_list 
-- WHERE client IN ('client1', 'client2') 
-- ORDER BY date DESC, id DESC 
-- LIMIT 20 OFFSET 0;

-- COMANDOS PARA MONITORAMENTO DE PERFORMANCE:

-- Verificar consultas lentas
-- SHOW VARIABLES LIKE 'slow_query_log';
-- SET GLOBAL slow_query_log = 'ON';
-- SET GLOBAL long_query_time = 1; -- queries > 1 segundo

-- Ver status de índices
-- SHOW INDEX FROM schedule_list;

-- Verificar tamanho da tabela
-- SELECT 
--   table_name AS 'Table',
--   ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)',
--   table_rows AS 'Rows'
-- FROM information_schema.tables 
-- WHERE table_schema = DATABASE() AND table_name = 'schedule_list';