const { executeMercocampQuery, executeCheckinQuery } = require('../config/database');

/**
 * Serviço de Agendamento de DP usando CNPJ
 * Versão adaptada para usar CNPJ ao invés do número do cliente
 */
class DPSchedulerServiceCNPJ {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.processingInterval = 30 * 1000; // 30 segundos
    this.maxRetries = 3;
    this.retryDelay = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Busca DP na tabela WTR usando CNPJ
   * @param {string} nfNumber - Número da NF
   * @param {string} cnpj - CNPJ do cliente
   */
  async searchDPInWTRByCNPJ(nfNumber, cnpj) {
    try {
      console.log(`🔎 [DP-SEARCH-CNPJ] Buscando DP para NF ${nfNumber}, CNPJ ${cnpj}`);

      // Buscar na tabela WTR usando CNPJ: no_nf, cnpj e no_dp
      const results = await executeMercocampQuery(`
        SELECT no_dp, no_nf, no_cli, cnpj
        FROM wtr 
        WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
        AND cnpj = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `, [nfNumber, `${nfNumber},%`, `%, ${nfNumber},%`, `%, ${nfNumber}`, cnpj]);

      if (results.length > 0) {
        const dp = results[0];
        console.log(`✅ [DP-SEARCH-CNPJ] DP encontrada: ${dp.no_dp} (NF: ${dp.no_nf}, CNPJ: ${dp.cnpj}, Cliente: ${dp.no_cli})`);
        return {
          found: true,
          dpNumber: dp.no_dp,
          data: dp
        };
      } else {
        console.log(`⏳ [DP-SEARCH-CNPJ] DP não encontrada para NF ${nfNumber}, CNPJ ${cnpj}`);
        
        // Busca alternativa apenas por NF para debug
        const nfOnlyResults = await executeMercocampQuery(`
          SELECT no_dp, no_nf, no_cli, cnpj
          FROM wtr 
          WHERE no_nf = ?
          AND no_dp IS NOT NULL 
          AND no_dp != '' 
          AND no_dp != '0'
          LIMIT 3
        `, [nfNumber]);

        if (nfOnlyResults.length > 0) {
          console.log(`🔍 [DP-SEARCH-CNPJ] Encontradas ${nfOnlyResults.length} entradas para NF ${nfNumber}:`);
          nfOnlyResults.forEach(row => {
            console.log(`   - DP: ${row.no_dp}, CNPJ: ${row.cnpj}, Cliente: ${row.no_cli}`);
          });
        }
        
        return {
          found: false,
          dpNumber: null
        };
      }
      
    } catch (error) {
      console.error(`❌ [DP-SEARCH-CNPJ] Erro na busca:`, error);
      throw error;
    }
  }

  /**
   * Busca DP usando CNPJ com fallback para número do cliente
   * @param {string} nfNumber - Número da NF
   * @param {string} cnpj - CNPJ do cliente
   * @param {string} clientNumber - Número do cliente (fallback)
   */
  async searchDPInWTRWithFallback(nfNumber, cnpj, clientNumber = null) {
    try {
      console.log(`🔎 [DP-SEARCH-FALLBACK] Buscando DP para NF ${nfNumber}, CNPJ ${cnpj}`);
      
      // Primeira tentativa: buscar por CNPJ
      const dpByCNPJ = await this.searchDPInWTRByCNPJ(nfNumber, cnpj);
      
      if (dpByCNPJ.found) {
        return dpByCNPJ;
      }

      // Se não encontrou por CNPJ e temos número do cliente, tentar por cliente
      if (clientNumber) {
        console.log(`🔍 [DP-SEARCH-FALLBACK] CNPJ não encontrou, tentando por número do cliente: ${clientNumber}`);
        
        const results = await executeMercocampQuery(`
          SELECT no_dp, no_nf, no_cli, cnpj
          FROM wtr 
          WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
          AND no_cli = ?
          AND no_dp IS NOT NULL 
          AND no_dp != '' 
          AND no_dp != '0'
          LIMIT 1
        `, [nfNumber, `${nfNumber},%`, `%, ${nfNumber},%`, `%, ${nfNumber}`, clientNumber]);

        if (results.length > 0) {
          const dp = results[0];
          console.log(`✅ [DP-SEARCH-FALLBACK] DP encontrada por número do cliente: ${dp.no_dp}`);
          console.log(`   CNPJ associado: ${dp.cnpj}`);
          return {
            found: true,
            dpNumber: dp.no_dp,
            data: dp
          };
        }
      }

      console.log(`❌ [DP-SEARCH-FALLBACK] DP não encontrada por CNPJ nem por número do cliente`);
      return {
        found: false,
        dpNumber: null
      };
      
    } catch (error) {
      console.error(`❌ [DP-SEARCH-FALLBACK] Erro na busca com fallback:`, error);
      throw error;
    }
  }

  /**
   * Extrai CNPJ dos dados do agendamento
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {string|null} - CNPJ extraído ou null
   */
  extractCNPJ(scheduleData) {
    try {
      // Tentar extrair CNPJ de diferentes campos possíveis
      const possibleFields = [
        'cnpj',
        'client_cnpj',
        'cnpj_cliente',
        'client_cnpj_cpf',
        'cnpj_cpf',
        'documento',
        'client_document'
      ];

      for (const field of possibleFields) {
        if (scheduleData[field] && scheduleData[field].trim()) {
          const cnpj = scheduleData[field].trim();
          console.log(`📋 [EXTRACT-CNPJ] CNPJ encontrado no campo '${field}': ${cnpj}`);
          return this.cleanCNPJ(cnpj);
        }
      }

      // Se não encontrou em campos específicos, tentar extrair do campo 'client'
      if (scheduleData.client) {
        const clientStr = scheduleData.client.toString();
        
        // Procurar por padrão de CNPJ no campo client
        const cnpjPattern = /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/;
        const match = clientStr.match(cnpjPattern);
        
        if (match) {
          const cnpj = match[1];
          console.log(`📋 [EXTRACT-CNPJ] CNPJ extraído do campo 'client': ${cnpj}`);
          return this.cleanCNPJ(cnpj);
        }
      }

      console.log(`❌ [EXTRACT-CNPJ] CNPJ não encontrado nos dados do agendamento`);
      return null;
    } catch (error) {
      console.error(`❌ [EXTRACT-CNPJ] Erro ao extrair CNPJ:`, error);
      return null;
    }
  }

  /**
   * Limpa e formata CNPJ
   * @param {string} cnpj - CNPJ para limpar
   * @returns {string} - CNPJ limpo
   */
  cleanCNPJ(cnpj) {
    if (!cnpj) return null;
    
    // Remover caracteres não numéricos
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    
    // Verificar se tem 14 dígitos (CNPJ) ou 11 dígitos (CPF)
    if (cleanCnpj.length === 14) {
      // Formatar como CNPJ: XX.XXX.XXX/XXXX-XX
      return cleanCnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    } else if (cleanCnpj.length === 11) {
      // Formatar como CPF: XXX.XXX.XXX-XX
      return cleanCnpj.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    }
    
    return cnpj; // Retornar original se não conseguir formatar
  }

  /**
   * Processa um agendamento para buscar DP usando CNPJ
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {Object} - Resultado do processamento
   */
  async processScheduleWithCNPJ(scheduleData) {
    try {
      console.log(`🔄 [PROCESS-CNPJ] Processando agendamento ${scheduleData.id}`);
      
      // Extrair CNPJ dos dados do agendamento
      const cnpj = this.extractCNPJ(scheduleData);
      
      if (!cnpj) {
        console.log(`❌ [PROCESS-CNPJ] CNPJ não encontrado para agendamento ${scheduleData.id}`);
        return {
          success: false,
          error: 'CNPJ não encontrado',
          scheduleId: scheduleData.id
        };
      }

      // Extrair número da NF
      const nfNumber = this.extractNfNumber(scheduleData);
      
      if (!nfNumber) {
        console.log(`❌ [PROCESS-CNPJ] Número da NF não encontrado para agendamento ${scheduleData.id}`);
        return {
          success: false,
          error: 'Número da NF não encontrado',
          scheduleId: scheduleData.id
        };
      }

      // Extrair número do cliente como fallback
      const clientNumber = this.extractClientNumber(scheduleData);

      console.log(`🔍 [PROCESS-CNPJ] Buscando DP para NF: ${nfNumber}, CNPJ: ${cnpj}`);
      
      // Buscar DP usando CNPJ com fallback
      const dpResult = await this.searchDPInWTRWithFallback(nfNumber, cnpj, clientNumber);

      if (dpResult.found) {
        console.log(`✅ [PROCESS-CNPJ] DP encontrada: ${dpResult.dpNumber}`);
        
        // Atualizar agendamento com DP encontrada
        await this.updateScheduleWithDP(scheduleData.id, dpResult.dpNumber);
        
        return {
          success: true,
          dpNumber: dpResult.dpNumber,
          scheduleId: scheduleData.id,
          method: 'CNPJ'
        };
      } else {
        console.log(`❌ [PROCESS-CNPJ] DP não encontrada para agendamento ${scheduleData.id}`);
        return {
          success: false,
          error: 'DP não encontrada',
          scheduleId: scheduleData.id
        };
      }
      
    } catch (error) {
      console.error(`❌ [PROCESS-CNPJ] Erro ao processar agendamento ${scheduleData.id}:`, error);
      return {
        success: false,
        error: error.message,
        scheduleId: scheduleData.id
      };
    }
  }

  /**
   * Extrai número da NF dos dados do agendamento
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {string|null} - Número da NF ou null
   */
  extractNfNumber(scheduleData) {
    try {
      // Tentar extrair de diferentes campos possíveis
      const possibleFields = [
        'nfe-key',
        'nfe_key',
        'nf_key',
        'nf-key',
        'nota_fiscal',
        'nf',
        'number'
      ];

      for (const field of possibleFields) {
        if (scheduleData[field] && scheduleData[field].toString().trim()) {
          const nfNumber = scheduleData[field].toString().trim();
          console.log(`📋 [EXTRACT-NF] NF encontrada no campo '${field}': ${nfNumber}`);
          return nfNumber;
        }
      }

      console.log(`❌ [EXTRACT-NF] Número da NF não encontrado`);
      return null;
    } catch (error) {
      console.error(`❌ [EXTRACT-NF] Erro ao extrair número da NF:`, error);
      return null;
    }
  }

  /**
   * Extrai número do cliente dos dados do agendamento (fallback)
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {string|null} - Número do cliente ou null
   */
  extractClientNumber(scheduleData) {
    try {
      // Tentar extrair de diferentes campos possíveis
      const possibleFields = [
        'client',
        'client_number',
        'no_cli',
        'cliente',
        'client_id'
      ];

      for (const field of possibleFields) {
        if (scheduleData[field] && scheduleData[field].toString().trim()) {
          const clientNumber = scheduleData[field].toString().trim();
          console.log(`📋 [EXTRACT-CLIENT] Cliente encontrado no campo '${field}': ${clientNumber}`);
          return clientNumber;
        }
      }

      console.log(`❌ [EXTRACT-CLIENT] Número do cliente não encontrado`);
      return null;
    } catch (error) {
      console.error(`❌ [EXTRACT-CLIENT] Erro ao extrair número do cliente:`, error);
      return null;
    }
  }

  /**
   * Atualiza o agendamento com o número da DP encontrada
   * @param {number} scheduleId - ID do agendamento
   * @param {string} dpNumber - Número da DP
   */
  async updateScheduleWithDP(scheduleId, dpNumber) {
    try {
      // Primeiro verificar se as colunas existem, se não existir, criar
      await this.ensureDPColumns();
      
      await executeCheckinQuery(`
        UPDATE schedule_list 
        SET no_dp = ?, dp_found_at = NOW()
        WHERE id = ?
      `, [dpNumber, scheduleId]);
      
      console.log(`✅ [DP-UPDATE-CNPJ] Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
    } catch (error) {
      console.error(`❌ [DP-UPDATE-CNPJ] Erro ao atualizar agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Garante que as colunas de DP existam na tabela schedule_list
   */
  async ensureDPColumns() {
    try {
      // Verificar se colunas já existem
      const columns = await executeCheckinQuery(`
        SHOW COLUMNS FROM schedule_list LIKE 'no_dp'
      `);

      if (columns.length === 0) {
        console.log(`📋 [DP-COLUMNS] Criando coluna no_dp na tabela schedule_list`);
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN no_dp VARCHAR(50) NULL 
          COMMENT 'Número do Documento de Portaria (DP) obtido da tabela wtr'
        `);
      }

      const dpFoundAtColumns = await executeCheckinQuery(`
        SHOW COLUMNS FROM schedule_list LIKE 'dp_found_at'
      `);

      if (dpFoundAtColumns.length === 0) {
        console.log(`📋 [DP-COLUMNS] Criando coluna dp_found_at na tabela schedule_list`);
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN dp_found_at DATETIME NULL 
          COMMENT 'Data/hora em que o DP foi encontrado'
        `);
      }
    } catch (error) {
      console.error(`❌ [DP-COLUMNS] Erro ao verificar/criar colunas de DP:`, error);
      throw error;
    }
  }

  /**
   * Testa a funcionalidade de busca por CNPJ
   * @param {string} nfNumber - Número da NF para teste
   * @param {string} cnpj - CNPJ para teste
   */
  async testCNPJSearch(nfNumber, cnpj) {
    console.log(`🧪 [TEST-CNPJ] Testando busca por CNPJ`);
    console.log(`   NF: ${nfNumber}`);
    console.log(`   CNPJ: ${cnpj}`);
    
    const dpResult = await this.searchDPInWTRByCNPJ(nfNumber, cnpj);
    
    if (dpResult.found) {
      console.log(`✅ [TEST-CNPJ] DP encontrado: ${dpResult.dpNumber}`);
    } else {
      console.log(`❌ [TEST-CNPJ] DP não encontrado`);
    }
    
    return dpResult;
  }
}

module.exports = DPSchedulerServiceCNPJ; 