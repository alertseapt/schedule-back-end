-- Tabela para armazenar produtos cadastrados
-- Permite pré-preenchimento quando mesmo supp_code + supp_cnpj aparecer novamente

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  supp_code VARCHAR(100) NOT NULL COMMENT 'Código do produto do fornecedor',
  supp_desc VARCHAR(255) NOT NULL COMMENT 'Descrição do produto do fornecedor',
  supp_cnpj VARCHAR(14) NOT NULL COMMENT 'CNPJ do fornecedor (sem máscara)',
  cli_code VARCHAR(100) NOT NULL COMMENT 'Código de venda escolhido pelo usuário',
  cli_desc VARCHAR(255) NOT NULL COMMENT 'Descrição de venda escolhida pelo usuário',
  cli_cnpj VARCHAR(14) NOT NULL COMMENT 'CNPJ do estoque escolhido pelo usuário (sem máscara)',
  user VARCHAR(50) NOT NULL COMMENT 'Usuário que cadastrou o produto',
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Data do cadastro',
  latest_into_case DECIMAL(10,4) DEFAULT NULL COMMENT 'Último fator escolhido pelo usuário',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Índices para performance
  INDEX idx_supp_code_cnpj (supp_code, supp_cnpj),
  INDEX idx_cli_cnpj (cli_cnpj),
  INDEX idx_user (user),
  INDEX idx_date (date),
  
  -- Constraint única para evitar duplicação do mesmo produto do fornecedor para o mesmo estoque
  UNIQUE KEY unique_product_mapping (supp_code, supp_cnpj, cli_cnpj)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Comentários da tabela
ALTER TABLE products COMMENT = 'Produtos cadastrados para pré-preenchimento automático';