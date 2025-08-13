const { executeMercocampQuery, executeCheckinQuery } = require('../config/database-render');

/**
 * Serviço de Verificação de DP Otimizado
 * 
 * Versão otimizada baseada na análise completa da estrutura da tabela WTR:
 * - Campo DP: no_dp (varchar(100)) - Chave Primária
 * - Campo NF: no_nf (varchar(1000)) - Pode conter múltiplas NFs (8.5% dos registros)
 * - Campo CNPJ: cnpj (varchar(20)) - Cobertura de 81.3%
 * - Campo Cliente: no_cli (varchar(20)) - Cobertura de 100%
 * - Total de registros: 16.904 (100% com DP válido)
 */
class DPVerificationServiceOptimized {
  constructor() {
    this.isRunning = false;
    this.interval = null;
    this.verificationInterval = 5 * 60 * 1000; // 5 minutos
    this.statistics = {
      searches: 0,
      exactMatches: 0,
      flexibleMatches: 0,
      clientFallbacks: 0,
      nfOnlyMatches: 0,
      notFound: 0
    };
  }

  /**
   * Busca DP na tabela WTR com estratégia otimizada
   * 
   * Estratégias em ordem de prioridade:
   * 1. Busca exata por CNPJ + NF (mais rápida)
   * 2. Busca flexível para múltiplas NFs (8.5% dos casos)
   * 3. Fallback por número do cliente (18.7% sem CNPJ)
   * 4. Busca apenas por NF (último recurso)
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} cnpj - CNPJ do cliente
   * @param {String} clientNumber - Número do cliente (fallback)
   * @returns {Object|null} - Objeto com dados da DP ou null
   */
  async getDPFromWtrTableOptimized(nfNumber, cnpj, clientNumber = null) {
    try {
      this.statistics.searches++;
      console.log(`🔍 [WTR-OPT] Buscando DP - NF: ${nfNumber}, CNPJ: ${cnpj}${clientNumber ? `, Cliente: ${clientNumber}` : ''}`);

      // Estratégia 1: Busca exata (mais eficiente para NFs únicas - 91.5% dos casos)
      console.log('   🎯 Estratégia 1: Busca exata por CNPJ + NF');
      let query = 'SELECT no_dp, no_nf, no_cli, cnpj FROM wtr WHERE no_nf = ? AND cnpj = ? LIMIT 1';
      let result = await executeMercocampQuery(query, [nfNumber, cnpj]);
      
      if (result.length > 0) {
        this.statistics.exactMatches++;
        console.log(`✅ [WTR-OPT] DP encontrado com busca exata: ${result[0].no_dp}`);
        return this.formatResult(result[0], 'exact_match');
      }

      // Estratégia 2: Busca flexível para múltiplas NFs (8.5% dos casos)
      console.log('   🔄 Estratégia 2: Busca flexível para múltiplas NFs');
      query = `SELECT no_dp, no_nf, no_cli, cnpj FROM wtr 
               WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
               AND cnpj = ? LIMIT 1`;
      result = await executeMercocampQuery(query, [
        nfNumber, 
        `${nfNumber},%`, 
        `%, ${nfNumber},%`, 
        `%, ${nfNumber}`, 
        cnpj
      ]);
      
      if (result.length > 0) {
        this.statistics.flexibleMatches++;
        console.log(`✅ [WTR-OPT] DP encontrado com busca flexível por CNPJ: ${result[0].no_dp}`);
        return this.formatResult(result[0], 'flexible_cnpj');
      }

      // Estratégia 3: Fallback por número do cliente (18.7% dos registros sem CNPJ)
      if (clientNumber) {
        console.log('   🔄 Estratégia 3: Fallback por número do cliente');
        query = `SELECT no_dp, no_nf, no_cli, cnpj FROM wtr 
                 WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
                 AND no_cli = ? LIMIT 1`;
        result = await executeMercocampQuery(query, [
          nfNumber, 
          `${nfNumber},%`, 
          `%, ${nfNumber},%`, 
          `%, ${nfNumber}`, 
          clientNumber
        ]);
        
        if (result.length > 0) {
          this.statistics.clientFallbacks++;
          console.log(`✅ [WTR-OPT] DP encontrado com fallback por cliente: ${result[0].no_dp}`);
          console.log(`   ⚠️ CNPJ do registro: ${result[0].cnpj || 'não informado'}`);
          return this.formatResult(result[0], 'client_fallback');
        }
      }

      // Estratégia 4: Busca apenas por NF (último recurso)
      console.log('   🔄 Estratégia 4: Busca apenas por NF (último recurso)');
      query = 'SELECT no_dp, no_nf, no_cli, cnpj FROM wtr WHERE no_nf = ? LIMIT 1';
      result = await executeMercocampQuery(query, [nfNumber]);
      
      if (result.length > 0) {
        this.statistics.nfOnlyMatches++;
        console.log(`⚠️ [WTR-OPT] DP encontrado apenas por NF (sem validação CNPJ): ${result[0].no_dp}`);
        console.log(`   CNPJ esperado: ${cnpj}`);
        console.log(`   CNPJ encontrado: ${result[0].cnpj || 'não informado'}`);
        console.log(`   Cliente encontrado: ${result[0].no_cli || 'não informado'}`);
        return this.formatResult(result[0], 'nf_only');
      }

      // Estratégia adicional: Buscar com CNPJ sem formatação
      if (cnpj && cnpj.includes('.')) {
        const cnpjNumericOnly = cnpj.replace(/[^\d]/g, '');
        console.log(`   🔄 Estratégia adicional: Busca com CNPJ sem formatação (${cnpjNumericOnly})`);
        
        query = `SELECT no_dp, no_nf, no_cli, cnpj FROM wtr 
                 WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
                 AND cnpj = ? LIMIT 1`;
        result = await executeMercocampQuery(query, [
          nfNumber, 
          `${nfNumber},%`, 
          `%, ${nfNumber},%`, 
          `%, ${nfNumber}`, 
          cnpjNumericOnly
        ]);
        
        if (result.length > 0) {
          this.statistics.flexibleMatches++;
          console.log(`✅ [WTR-OPT] DP encontrado com CNPJ sem formatação: ${result[0].no_dp}`);
          return this.formatResult(result[0], 'cnpj_unformatted');
        }
      }

      this.statistics.notFound++;
      console.log(`❌ [WTR-OPT] DP não encontrado para NF: ${nfNumber}, CNPJ: ${cnpj}`);
      return null;

    } catch (error) {
      console.error('❌ [WTR-OPT] Erro na busca otimizada:', error);
      return null;
    }
  }

  /**
   * Formata o resultado da busca com informações adicionais
   * 
   * @param {Object} dbResult - Resultado do banco de dados
   * @param {String} strategy - Estratégia que encontrou o resultado
   * @returns {Object} - Resultado formatado
   */
  formatResult(dbResult, strategy) {
    return {
      dp_number: dbResult.no_dp,
      nf_number: dbResult.no_nf,
      client_number: dbResult.no_cli,
      cnpj: dbResult.cnpj,
      strategy_used: strategy,
      found_at: new Date().toISOString()
    };
  }

  /**
   * Atualiza o campo no_dp do agendamento com informações detalhadas
   * 
   * @param {Number} scheduleId - ID do agendamento
   * @param {Object} dpResult - Resultado da busca de DP
   */
  async updateScheduleDP(scheduleId, dpResult) {
    try {
      const dpNumber = typeof dpResult === 'string' ? dpResult : dpResult.dp_number;
      
      await executeCheckinQuery(
        'UPDATE schedule_list SET no_dp = ? WHERE id = ?',
        [dpNumber, scheduleId]
      );
      
      console.log(`✅ [WTR-OPT] Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
      
      if (typeof dpResult === 'object') {
        console.log(`   Estratégia utilizada: ${dpResult.strategy_used}`);
        if (dpResult.cnpj) {
          console.log(`   CNPJ validado: ${dpResult.cnpj}`);
        }
      }
      
    } catch (error) {
      console.error(`❌ [WTR-OPT] Erro ao atualizar agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Busca múltiplas DPs de uma vez (batch processing)
   * 
   * @param {Array} searchRequests - Array de {nfNumber, cnpj, clientNumber}
   * @returns {Array} - Array de resultados
   */
  async batchGetDPs(searchRequests) {
    console.log(`📊 [WTR-OPT] Processamento em lote de ${searchRequests.length} buscas`);
    
    const results = [];
    const startTime = Date.now();
    
    for (const request of searchRequests) {
      const result = await this.getDPFromWtrTableOptimized(
        request.nfNumber, 
        request.cnpj, 
        request.clientNumber
      );
      
      results.push({
        ...request,
        result: result
      });
    }
    
    const endTime = Date.now();
    const avgTime = (endTime - startTime) / searchRequests.length;
    
    console.log(`📊 [WTR-OPT] Lote processado em ${endTime - startTime}ms (média: ${avgTime.toFixed(1)}ms por busca)`);
    
    return results;
  }

  /**
   * Retorna estatísticas de uso do serviço
   * 
   * @returns {Object} - Estatísticas detalhadas
   */
  getStatistics() {
    const total = this.statistics.searches;
    if (total === 0) return this.statistics;
    
    return {
      ...this.statistics,
      success_rate: ((total - this.statistics.notFound) / total * 100).toFixed(1) + '%',
      exact_match_rate: (this.statistics.exactMatches / total * 100).toFixed(1) + '%',
      flexible_match_rate: (this.statistics.flexibleMatches / total * 100).toFixed(1) + '%',
      client_fallback_rate: (this.statistics.clientFallbacks / total * 100).toFixed(1) + '%',
      nf_only_rate: (this.statistics.nfOnlyMatches / total * 100).toFixed(1) + '%',
      not_found_rate: (this.statistics.notFound / total * 100).toFixed(1) + '%'
    };
  }

  /**
   * Reseta as estatísticas
   */
  resetStatistics() {
    this.statistics = {
      searches: 0,
      exactMatches: 0,
      flexibleMatches: 0,
      clientFallbacks: 0,
      nfOnlyMatches: 0,
      notFound: 0
    };
  }

  /**
   * Valida a estrutura da tabela WTR
   * 
   * @returns {Object} - Resultado da validação
   */
  async validateWTRStructure() {
    try {
      console.log('🔍 [WTR-OPT] Validando estrutura da tabela WTR...');
      
      // Verificar estrutura
      const structure = await executeMercocampQuery('DESCRIBE wtr');
      const fields = structure.map(col => col.Field);
      
      const validation = {
        hasDP: fields.includes('no_dp'),
        hasNF: fields.includes('no_nf'),
        hasCNPJ: fields.includes('cnpj'),
        hasClient: fields.includes('no_cli'),
        totalFields: fields.length
      };
      
      // Verificar dados
      const counts = await executeMercocampQuery(`
        SELECT 
          COUNT(*) as total,
          COUNT(no_dp) as with_dp,
          COUNT(CASE WHEN cnpj IS NOT NULL AND cnpj != '' THEN 1 END) as with_cnpj,
          COUNT(CASE WHEN no_cli IS NOT NULL AND no_cli != '' THEN 1 END) as with_client,
          COUNT(CASE WHEN no_nf LIKE '%,%' THEN 1 END) as multiple_nfs
        FROM wtr
      `);
      
      validation.counts = counts[0];
      validation.cnpj_coverage = (counts[0].with_cnpj / counts[0].total * 100).toFixed(1) + '%';
      validation.multiple_nf_rate = (counts[0].multiple_nfs / counts[0].total * 100).toFixed(1) + '%';
      
      console.log('✅ [WTR-OPT] Estrutura validada:');
      console.log(`   Total de registros: ${validation.counts.total}`);
      console.log(`   Cobertura CNPJ: ${validation.cnpj_coverage}`);
      console.log(`   Taxa múltiplas NFs: ${validation.multiple_nf_rate}`);
      
      return validation;
      
    } catch (error) {
      console.error('❌ [WTR-OPT] Erro na validação da estrutura:', error);
      return null;
    }
  }

  /**
   * Método de compatibilidade com a implementação anterior
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} cnpj - CNPJ do cliente
   * @returns {String|null} - Número da DP ou null
   */
  async getDPFromWtrTableByCNPJ(nfNumber, cnpj) {
    const result = await this.getDPFromWtrTableOptimized(nfNumber, cnpj);
    return result ? result.dp_number : null;
  }

  /**
   * Método de compatibilidade com fallback
   * 
   * @param {String} nfNumber - Número da NF  
   * @param {String} cnpj - CNPJ do cliente
   * @param {String} clientNumber - Número do cliente
   * @returns {String|null} - Número da DP ou null
   */
  async getDPFromWtrTableWithFallback(nfNumber, cnpj, clientNumber = null) {
    const result = await this.getDPFromWtrTableOptimized(nfNumber, cnpj, clientNumber);
    return result ? result.dp_number : null;
  }
}

module.exports = DPVerificationServiceOptimized;