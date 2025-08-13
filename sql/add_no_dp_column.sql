-- Script para adicionar a coluna no_dp na tabela schedule_list
-- Execute este script apenas se a coluna ainda não existir

-- Verificar se a coluna já existe antes de adicionar
SET @column_exists = (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = 'dbcheckin'
  AND TABLE_NAME = 'schedule_list'
  AND COLUMN_NAME = 'no_dp'
);

-- Adicionar a coluna apenas se ela não existir
SET @sql = IF(
  @column_exists = 0,
  'ALTER TABLE schedule_list ADD COLUMN no_dp VARCHAR(50) NULL COMMENT "Número do Documento de Portaria (DP) obtido do CORPEM ou tabela wtr"',
  'SELECT "Coluna no_dp já existe na tabela schedule_list" as message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar índice para otimizar consultas por DP
CREATE INDEX IF NOT EXISTS idx_schedule_list_no_dp ON schedule_list (no_dp);

-- Comentário da nova coluna
ALTER TABLE schedule_list MODIFY COLUMN no_dp VARCHAR(50) NULL COMMENT 'Número do Documento de Portaria (DP) obtido do CORPEM WMS ou tabela wtr do dbmercocamp';

-- Mensagem de confirmação
SELECT 
  'Coluna no_dp adicionada/verificada na tabela schedule_list' as status,
  'Índice idx_schedule_list_no_dp criado para otimização' as index_status,
  NOW() as timestamp;