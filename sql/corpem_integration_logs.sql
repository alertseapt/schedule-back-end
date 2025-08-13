-- Tabela para armazenar logs das integrações com Corpem WMS
CREATE TABLE IF NOT EXISTS corpem_integration_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  integration_type ENUM('products', 'nf_entry') NOT NULL,
  success TINYINT(1) NOT NULL DEFAULT 0,
  message TEXT,
  error_details TEXT,
  user_id VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_integration_type (integration_type),
  INDEX idx_success (success),
  INDEX idx_created_at (created_at)
);

-- Comentários
ALTER TABLE corpem_integration_logs COMMENT = 'Logs das integrações com Corpem WMS';
ALTER TABLE corpem_integration_logs MODIFY COLUMN schedule_id INT NOT NULL COMMENT 'ID do agendamento relacionado';
ALTER TABLE corpem_integration_logs MODIFY COLUMN integration_type ENUM('products', 'nf_entry') NOT NULL COMMENT 'Tipo de integração: products (Cadastro de Mercadorias) ou nf_entry (NF de Entrada)';
ALTER TABLE corpem_integration_logs MODIFY COLUMN success TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Indica se a integração foi bem-sucedida (1) ou falhou (0)';
ALTER TABLE corpem_integration_logs MODIFY COLUMN message TEXT COMMENT 'Mensagem de retorno da integração';
ALTER TABLE corpem_integration_logs MODIFY COLUMN error_details TEXT COMMENT 'Detalhes do erro em caso de falha (JSON)';
ALTER TABLE corpem_integration_logs MODIFY COLUMN user_id VARCHAR(50) COMMENT 'ID do usuário que iniciou a integração (ou "system" para triggers automáticos)';
ALTER TABLE corpem_integration_logs MODIFY COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'Data e hora da tentativa de integração';