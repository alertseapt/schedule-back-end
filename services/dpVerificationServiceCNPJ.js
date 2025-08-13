const { executeMercocampQuery, executeCheckinQuery } = require('../config/database-render');

/**
 * Serviço de Verificação de DP usando CNPJ
 * Versão adaptada para usar CNPJ ao invés do número do cliente
 */
class DPVerificationServiceCNPJ {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.verificationInterval = 5 * 60 * 1000; // 5 minutos
  }

  /**
   * Busca DP na tabela WTR usando CNPJ ao invés do número do cliente
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} cnpj - CNPJ do cliente
   * @returns {String|null} - Número da DP ou null
   */
  async getDPFromWtrTableByCNPJ(nfNumber, cnpj) {
    try {
      console.log(`🔍 [WTR-CNPJ] Buscando DP para NF: ${nfNumber}, CNPJ: ${cnpj}`);

      // Query principal para buscar na tabela wtr usando CNPJ
      // no_nf (número da NF), cnpj (CNPJ do cliente), no_dp (número da DP)
      const query = `
        SELECT no_dp, no_nf, no_cli, cnpj 
        FROM wtr 
        WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
        AND cnpj = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `;

      const searchPatterns = [
        nfNumber,
        `${nfNumber},%`,
        `%, ${nfNumber},%`,
        `%, ${nfNumber}`
      ];

      const results = await executeMercocampQuery(query, [...searchPatterns, cnpj]);

      if (results.length > 0) {
        console.log(`✅ [WTR-CNPJ] DP encontrado com correspondência exata: ${results[0].no_dp}`);
        console.log(`   NF: ${results[0].no_nf}, CNPJ: ${results[0].cnpj}, Cliente: ${results[0].no_cli}`);
        return results[0].no_dp;
      }

      // Se não encontrou com correspondência exata, tentar busca mais flexível
      console.log(`🔍 [WTR-CNPJ] Tentando busca flexível para NF: ${nfNumber}`);
      
      const flexibleQuery = `
        SELECT no_dp, no_nf, no_cli, cnpj 
        FROM wtr 
        WHERE no_nf = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `;

      const flexibleResults = await executeMercocampQuery(flexibleQuery, [nfNumber]);

      if (flexibleResults.length > 0) {
        // Verificar se o CNPJ é compatível
        const result = flexibleResults[0];
        console.log(`⚠️ [WTR-CNPJ] DP encontrado com busca flexível: ${result.no_dp}`);
        console.log(`   NF: ${result.no_nf}, CNPJ encontrado: ${result.cnpj}, CNPJ buscado: ${cnpj}`);
        
        // Se o CNPJ não corresponder exatamente, logar mas ainda retornar o DP
        if (result.cnpj !== cnpj) {
          console.log(`⚠️ [WTR-CNPJ] CNPJ não corresponde exatamente, mas DP encontrado`);
        }
        
        return result.no_dp;
      }

      // Última tentativa: buscar qualquer DP para esta NF (mais permissivo)
      console.log(`🔍 [WTR-CNPJ] Última tentativa: busca permissiva para NF: ${nfNumber}`);
      
      const permissiveQuery = `
        SELECT no_dp, no_nf, no_cli, cnpj 
        FROM wtr 
        WHERE CAST(no_nf AS CHAR) = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `;

      const permissiveResults = await executeMercocampQuery(permissiveQuery, [nfNumber]);

      if (permissiveResults.length > 0) {
        const result = permissiveResults[0];
        console.log(`⚠️ [WTR-CNPJ] DP encontrado com busca permissiva: ${result.no_dp}`);
        console.log(`   NF: ${result.no_nf}, CNPJ: ${result.cnpj}, Cliente: ${result.no_cli}`);
        return result.no_dp;
      }

      console.log(`❌ [WTR-CNPJ] DP não encontrado para NF: ${nfNumber}, CNPJ: ${cnpj}`);
      return null;
    } catch (error) {
      console.error('❌ [WTR-CNPJ] Erro ao buscar DP na tabela wtr:', error);
      
      // Se o erro for relacionado a colunas não existentes, tentar estruturas alternativas
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('🔍 [WTR-CNPJ] Tentando estruturas alternativas da tabela wtr...');
        return await this.tryAlternativeWtrStructuresByCNPJ(nfNumber, cnpj);
      }
      
      return null;
    }
  }

  /**
   * Tenta estruturas alternativas da tabela wtr usando CNPJ
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} cnpj - CNPJ do cliente  
   * @returns {String|null} - Número da DP ou null
   */
  async tryAlternativeWtrStructuresByCNPJ(nfNumber, cnpj) {
    // Possíveis nomes alternativos para as colunas
    const alternativeStructures = [
      // Estrutura 1: nomes abreviados
      { dp: 'dp', nf: 'nf', cnpj: 'cnpj' },
      // Estrutura 2: nomes longos
      { dp: 'numero_dp', nf: 'numero_nf', cnpj: 'cnpj_cliente' },
      // Estrutura 3: outras variações
      { dp: 'documento_portaria', nf: 'nota_fiscal', cnpj: 'cnpj' },
      // Estrutura 4: inglês
      { dp: 'dp_number', nf: 'nf_number', cnpj: 'client_cnpj' }
    ];

    for (const structure of alternativeStructures) {
      try {
        console.log(`🔍 [WTR-CNPJ] Tentando estrutura: dp=${structure.dp}, nf=${structure.nf}, cnpj=${structure.cnpj}`);
        
        const query = `
          SELECT ${structure.dp} as no_dp, ${structure.nf} as no_nf, ${structure.cnpj} as cnpj 
          FROM wtr 
          WHERE ${structure.nf} = ? 
          AND ${structure.cnpj} = ?
          AND ${structure.dp} IS NOT NULL 
          AND ${structure.dp} != '' 
          AND ${structure.dp} != '0'
          LIMIT 1
        `;

        const results = await executeMercocampQuery(query, [nfNumber, cnpj]);

        if (results.length > 0) {
          console.log(`✅ [WTR-CNPJ] DP encontrado com estrutura alternativa: ${results[0].no_dp}`);
          return results[0].no_dp;
        }
      } catch (altError) {
        // Continuar tentando outras estruturas
        continue;
      }
    }

    // Se nenhuma estrutura funcionou, tentar listar a estrutura da tabela
    try {
      console.log('🔍 [WTR-CNPJ] Verificando estrutura real da tabela wtr...');
      const tableStructure = await executeMercocampQuery('DESCRIBE wtr');
      console.log('📋 [WTR-CNPJ] Colunas disponíveis na tabela wtr:', tableStructure.map(col => col.Field).join(', '));
      
      // Tentar identificar colunas que possam conter DP/NF/CNPJ
      const columns = tableStructure.map(col => col.Field.toLowerCase());
      const dpColumn = columns.find(col => col.includes('dp') || col.includes('portaria') || col.includes('document'));
      const nfColumn = columns.find(col => col.includes('nf') || col.includes('nota') || col.includes('fiscal'));
      const cnpjColumn = columns.find(col => col.includes('cnpj') || col.includes('cpf') || col.includes('documento'));
      
      if (dpColumn && nfColumn && cnpjColumn) {
        console.log(`🔍 [WTR-CNPJ] Tentando colunas identificadas: dp=${dpColumn}, nf=${nfColumn}, cnpj=${cnpjColumn}`);
        
        const smartQuery = `
          SELECT ${dpColumn} as no_dp 
          FROM wtr 
          WHERE ${nfColumn} = ? 
          AND ${cnpjColumn} = ? 
          AND ${dpColumn} IS NOT NULL 
          LIMIT 1
        `;
        
        const smartResults = await executeMercocampQuery(smartQuery, [nfNumber, cnpj]);
        
        if (smartResults.length > 0) {
          console.log(`✅ [WTR-CNPJ] DP encontrado com detecção inteligente: ${smartResults[0].no_dp}`);
          return smartResults[0].no_dp;
        }
      }
      
    } catch (structureError) {
      console.error('❌ [WTR-CNPJ] Erro ao verificar estrutura da tabela:', structureError.message);
    }

    return null;
  }

  /**
   * Busca DP usando CNPJ e NF, com fallback para número do cliente
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} cnpj - CNPJ do cliente
   * @param {String} clientNumber - Número do cliente (fallback)
   * @returns {String|null} - Número da DP ou null
   */
  async getDPFromWtrTableWithFallback(nfNumber, cnpj, clientNumber = null) {
    try {
      // Primeira tentativa: buscar por CNPJ
      console.log(`🔍 [WTR-FALLBACK] Buscando DP por CNPJ: ${cnpj}`);
      const dpByCNPJ = await this.getDPFromWtrTableByCNPJ(nfNumber, cnpj);
      
      if (dpByCNPJ) {
        return dpByCNPJ;
      }

      // Se não encontrou por CNPJ e temos número do cliente, tentar por cliente
      if (clientNumber) {
        console.log(`🔍 [WTR-FALLBACK] CNPJ não encontrou, tentando por número do cliente: ${clientNumber}`);
        
        const query = `
          SELECT no_dp, no_nf, no_cli, cnpj 
          FROM wtr 
          WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
          AND no_cli = ?
          AND no_dp IS NOT NULL 
          AND no_dp != '' 
          AND no_dp != '0'
          LIMIT 1
        `;

        const searchPatterns = [
          nfNumber,
          `${nfNumber},%`,
          `%, ${nfNumber},%`,
          `%, ${nfNumber}`
        ];

        const results = await executeMercocampQuery(query, [...searchPatterns, clientNumber]);

        if (results.length > 0) {
          console.log(`✅ [WTR-FALLBACK] DP encontrado por número do cliente: ${results[0].no_dp}`);
          console.log(`   CNPJ associado: ${results[0].cnpj}`);
          return results[0].no_dp;
        }
      }

      console.log(`❌ [WTR-FALLBACK] DP não encontrado por CNPJ nem por número do cliente`);
      return null;
      
    } catch (error) {
      console.error('❌ [WTR-FALLBACK] Erro na busca com fallback:', error);
      return null;
    }
  }

  /**
   * Atualiza o campo no_dp do agendamento
   * 
   * @param {Number} scheduleId - ID do agendamento
   * @param {String} dpNumber - Número da DP
   */
  async updateScheduleDP(scheduleId, dpNumber) {
    try {
      await executeCheckinQuery(
        'UPDATE schedule_list SET no_dp = ? WHERE id = ?',
        [dpNumber, scheduleId]
      );
      
      console.log(`✅ [WTR-CNPJ] Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
    } catch (error) {
      console.error(`❌ [WTR-CNPJ] Erro ao atualizar agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Testa a funcionalidade de busca por CNPJ
   * 
   * @param {String} nfNumber - Número da NF para teste
   * @param {String} cnpj - CNPJ para teste
   */
  async testCNPJSearch(nfNumber, cnpj) {
    console.log(`🧪 [TEST] Testando busca por CNPJ`);
    console.log(`   NF: ${nfNumber}`);
    console.log(`   CNPJ: ${cnpj}`);
    
    const dp = await this.getDPFromWtrTableByCNPJ(nfNumber, cnpj);
    
    if (dp) {
      console.log(`✅ [TEST] DP encontrado: ${dp}`);
    } else {
      console.log(`❌ [TEST] DP não encontrado`);
    }
    
    return dp;
  }
}

module.exports = DPVerificationServiceCNPJ; 