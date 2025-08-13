const { executeMercocampQuery, executeCheckinQuery } = require('../config/database-render');

/**
 * Serviço de Verificação de DP com Validação de Data
 * 
 * Versão aprimorada que verifica se a dt_inclusao do DP corresponde
 * à data de alteração do status para "Conferência" no histórico
 */
class DPVerificationServiceWithDate {
  constructor() {
    this.statistics = {
      searches: 0,
      successes: 0,
      failures: 0,
      date_validations: 0,
      date_matches: 0,
      date_mismatches: 0,
      success_rate: '0%'
    };
  }

  /**
   * Busca DP na tabela WTR com triangulação rigorosa (APENAS com as 3 informações)
   * CNPJ + NF-e + Data de inclusão devem corresponder exatamente
   */
  async getDPFromWtrTableWithTriangulation(nfNumber, cnpj, scheduleId) {
    const logPrefix = `[DP-TRIANGULATION][ID:${scheduleId || 'N/A'}]`;
    this.statistics.searches++;

    try {
      console.log(`${logPrefix} 🔍 Buscando DP com triangulação rigorosa...`);
      console.log(`${logPrefix}    NF: ${nfNumber}`);
      console.log(`${logPrefix}    CNPJ: ${cnpj}`);

      // 1. OBRIGATÓRIO: Extrair data de alteração para "Conferência" do histórico
      let conferenciaDate = null;
      if (scheduleId) {
        conferenciaDate = await this.extractConferenciaDateFromHistory(scheduleId);
        if (conferenciaDate) {
          console.log(`${logPrefix} 📅 Data alteração para Conferência: ${conferenciaDate}`);
        } else {
          console.log(`${logPrefix} ❌ Data do histórico não encontrada - BLOQUEANDO busca`);
          this.statistics.failures++;
          this.updateSuccessRate();
          return null;
        }
      } else {
        console.log(`${logPrefix} ❌ ID do agendamento não fornecido - BLOQUEANDO busca`);
        this.statistics.failures++;
        this.updateSuccessRate();
        return null;
      }

      // 2. TRIANGULAÇÃO: Buscar APENAS com correspondência exata das 3 informações
      console.log(`${logPrefix} 🎯 Executando triangulação rigorosa`);
      
      const query = `
        SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
        FROM wtr 
        WHERE no_nf = ? 
          AND cnpj = ? 
          AND DATE(dt_inclusao) = ?
        LIMIT 1
      `;
      
      const params = [nfNumber, cnpj, conferenciaDate];
      const results = await executeMercocampQuery(query, params);
      
      if (results.length > 0) {
        const result = results[0];
        
        // Validação adicional da data
        const wtrDate = new Date(result.dt_inclusao);
        const wtrDateStr = wtrDate.toISOString().split('T')[0];
        
        if (wtrDateStr === conferenciaDate) {
          console.log(`${logPrefix} ✅ DP encontrado com triangulação válida: ${result.no_dp}`);
          console.log(`${logPrefix}    ✓ NF: ${result.no_nf} = ${nfNumber}`);
          console.log(`${logPrefix}    ✓ CNPJ: ${result.cnpj} = ${cnpj}`);
          console.log(`${logPrefix}    ✓ Data: ${wtrDateStr} = ${conferenciaDate}`);
          
          this.statistics.successes++;
          this.statistics.date_matches++;
          this.updateSuccessRate();
          
          return {
            dp_number: result.no_dp,
            nf_number: result.no_nf,
            cnpj: result.cnpj,
            client_number: result.no_cli,
            dt_inclusao: result.dt_inclusao,
            situacao: result.situacao,
            strategy_used: 'triangulation_exact',
            strategy_level: 1,
            date_validated: true,
            date_match: true,
            triangulation_complete: true,
            found_at: new Date().toISOString()
          };
        } else {
          console.log(`${logPrefix} ❌ DP encontrado mas data não confere:`);
          console.log(`${logPrefix}    Data WTR: ${wtrDateStr} ≠ Data histórico: ${conferenciaDate}`);
          this.statistics.date_mismatches++;
        }
      }

      // IMPORTANTE: Se chegou aqui, não há triangulação válida
      console.log(`${logPrefix} ❌ Nenhuma triangulação válida encontrada`);
      console.log(`${logPrefix}    Motivo: Sem correspondência exata de CNPJ + NF + Data`);
      
      this.statistics.failures++;
      this.updateSuccessRate();
      return null;

    } catch (error) {
      console.error(`${logPrefix} ❌ Erro na triangulação:`, error.message);
      this.statistics.failures++;
      this.updateSuccessRate();
      throw error;
    }
  }

  /**
   * Busca DP na tabela WTR com validação de data de inclusão (implementação original)
   */
  async getDPFromWtrTableWithDate(nfNumber, cnpj, clientNumber, scheduleId) {
    const logPrefix = `[DP-DATE][ID:${scheduleId || 'N/A'}]`;
    this.statistics.searches++;

    try {
      console.log(`${logPrefix} 🔍 Buscando DP com validação de data...`);
      console.log(`${logPrefix}    NF: ${nfNumber}`);
      console.log(`${logPrefix}    CNPJ: ${cnpj}`);
      console.log(`${logPrefix}    Cliente: ${clientNumber || 'N/A'}`);

      // 1. Extrair data de alteração para "Agendado" do histórico
      let conferenciaDate = null;
      if (scheduleId) {
        conferenciaDate = await this.extractConferenciaDateFromHistory(scheduleId);
        if (conferenciaDate) {
          console.log(`${logPrefix} 📅 Data alteração para Conferência: ${conferenciaDate}`);
        } else {
          console.log(`${logPrefix} ⚠️ Não foi possível extrair data do histórico`);
        }
      }

      // 2. Buscar DP com estratégias existentes + filtro de data
      const strategies = [
        { name: 'exact_match_with_date', level: 1 },
        { name: 'flexible_nf_with_date', level: 2 },
        { name: 'client_fallback_with_date', level: 3 },
        { name: 'exact_match_no_date', level: 4 },
        { name: 'flexible_nf_no_date', level: 5 },
        { name: 'client_fallback_no_date', level: 6 },
        { name: 'last_resort', level: 7 }
      ];

      for (const strategy of strategies) {
        const result = await this.executeSearchStrategy(
          strategy, 
          nfNumber, 
          cnpj, 
          clientNumber, 
          conferenciaDate,
          logPrefix
        );

        if (result) {
          this.statistics.successes++;
          this.updateSuccessRate();
          return result;
        }
      }

      console.log(`${logPrefix} ❌ DP não encontrado em nenhuma estratégia`);
      this.statistics.failures++;
      this.updateSuccessRate();
      return null;

    } catch (error) {
      console.error(`${logPrefix} ❌ Erro na busca com data:`, error.message);
      this.statistics.failures++;
      this.updateSuccessRate();
      throw error;
    }
  }

  /**
   * Extrai a data de alteração para "Conferência" do histórico do agendamento
   */
  async extractConferenciaDateFromHistory(scheduleId) {
    try {
      const [schedule] = await executeCheckinQuery(
        'SELECT historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );

      if (!schedule || !schedule.historic) {
        return null;
      }

      let historic;
      try {
        // Tentar diferentes formas de parsear o histórico
        if (typeof schedule.historic === 'string') {
          historic = JSON.parse(schedule.historic);
        } else if (typeof schedule.historic === 'object') {
          historic = schedule.historic;
        } else {
          return null;
        }
      } catch (parseError) {
        return null;
      }

      // Procurar entrada de alteração para "Conferência"
      const conferenciaEntries = Object.values(historic).filter(entry => 
        entry && (
          entry.new_status === 'Conferência' ||
          (entry.action && entry.action.toLowerCase().includes('conferência'))
        )
      );

      if (conferenciaEntries.length > 0) {
        // Pegar a entrada mais recente
        const latestEntry = conferenciaEntries.sort((a, b) => 
          new Date(b.timestamp) - new Date(a.timestamp)
        )[0];

        const conferenciaDate = new Date(latestEntry.timestamp);
        return conferenciaDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
      }

      return null;
    } catch (error) {
      console.error(`[DP-DATE] Erro ao extrair data do histórico:`, error.message);
      return null;
    }
  }

  /**
   * Executa uma estratégia específica de busca
   */
  async executeSearchStrategy(strategy, nfNumber, cnpj, clientNumber, conferenciaDate, logPrefix) {
    try {
      let query = '';
      let params = [];
      let includeDate = strategy.name.includes('with_date') && conferenciaDate;

      switch (strategy.name) {
        case 'exact_match_with_date':
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE no_nf = ? 
              AND cnpj = ? 
              AND DATE(dt_inclusao) = ?
            LIMIT 1
          `;
          params = [nfNumber, cnpj, conferenciaDate];
          break;

        case 'flexible_nf_with_date':
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE (no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?)
              AND cnpj = ?
              AND DATE(dt_inclusao) = ?
            LIMIT 1
          `;
          params = [`%${nfNumber}%`, `${nfNumber},%`, `%,${nfNumber},%`, cnpj, conferenciaDate];
          break;

        case 'client_fallback_with_date':
          if (!clientNumber) return null;
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE no_nf = ? 
              AND no_cli = ?
              AND DATE(dt_inclusao) = ?
            LIMIT 1
          `;
          params = [nfNumber, clientNumber, conferenciaDate];
          break;

        case 'exact_match_no_date':
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE no_nf = ? AND cnpj = ?
            ORDER BY dt_inclusao DESC
            LIMIT 1
          `;
          params = [nfNumber, cnpj];
          break;

        case 'flexible_nf_no_date':
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE (no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) AND cnpj = ?
            ORDER BY dt_inclusao DESC
            LIMIT 1
          `;
          params = [`%${nfNumber}%`, `${nfNumber},%`, `%,${nfNumber},%`, cnpj];
          break;

        case 'client_fallback_no_date':
          if (!clientNumber) return null;
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE no_nf = ? AND no_cli = ?
            ORDER BY dt_inclusao DESC
            LIMIT 1
          `;
          params = [nfNumber, clientNumber];
          break;

        case 'last_resort':
          query = `
            SELECT no_dp, no_nf, cnpj, no_cli, dt_inclusao, situacao
            FROM wtr 
            WHERE no_nf = ?
            ORDER BY dt_inclusao DESC
            LIMIT 1
          `;
          params = [nfNumber];
          break;

        default:
          return null;
      }

      console.log(`${logPrefix} 🔍 Estratégia ${strategy.level}: ${strategy.name}`);
      
      const results = await executeMercocampQuery(query, params);
      
      if (results.length > 0) {
        const result = results[0];
        
        // Validar data se necessário
        if (includeDate && conferenciaDate) {
          this.statistics.date_validations++;
          
          const wtrDate = new Date(result.dt_inclusao);
          const wtrDateStr = wtrDate.toISOString().split('T')[0];
          
          if (wtrDateStr === conferenciaDate) {
            console.log(`${logPrefix} ✅ DP encontrado com data válida: ${result.no_dp}`);
            console.log(`${logPrefix}    Data WTR: ${wtrDateStr} = Data histórico: ${conferenciaDate}`);
            this.statistics.date_matches++;
          } else {
            console.log(`${logPrefix} ⚠️ DP encontrado mas data não confere:`);
            console.log(`${logPrefix}    Data WTR: ${wtrDateStr} ≠ Data histórico: ${conferenciaDate}`);
            this.statistics.date_mismatches++;
            
            // Se a estratégia exige data válida, continuar procurando
            if (strategy.name.includes('with_date')) {
              return null;
            }
          }
        }

        return {
          dp_number: result.no_dp,
          nf_number: result.no_nf,
          cnpj: result.cnpj,
          client_number: result.no_cli,
          dt_inclusao: result.dt_inclusao,
          situacao: result.situacao,
          strategy_used: strategy.name,
          strategy_level: strategy.level,
          date_validated: includeDate && conferenciaDate ? true : false,
          date_match: includeDate && conferenciaDate ? 
            (new Date(result.dt_inclusao).toISOString().split('T')[0] === conferenciaDate) : null,
          found_at: new Date().toISOString()
        };
      }

      return null;
    } catch (error) {
      console.error(`${logPrefix} ❌ Erro na estratégia ${strategy.name}:`, error.message);
      return null;
    }
  }

  /**
   * Atualiza agendamento com DP encontrado
   */
  async updateScheduleDP(scheduleId, dpResult) {
    try {
      // Buscar agendamento atual
      const [currentSchedule] = await executeCheckinQuery(
        'SELECT historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );

      if (!currentSchedule) {
        throw new Error('Agendamento não encontrado');
      }

      // Preparar histórico atualizado
      let historic = {};
      if (currentSchedule.historic) {
        try {
          historic = typeof currentSchedule.historic === 'string' 
            ? JSON.parse(currentSchedule.historic) 
            : currentSchedule.historic;
        } catch (e) {
          console.warn(`⚠️ Erro ao parsear histórico existente, criando novo`);
          historic = {};
        }
      }

      // Adicionar entrada no histórico
      const timestamp = Date.now();
      const historicKey = `dp_${timestamp}`;
      
      historic[historicKey] = {
        timestamp: new Date().toISOString(),
        user: 'Sistema',
        action: 'DP atribuído automaticamente com validação de data',
        comment: `DP ${dpResult.dp_number} encontrado via ${dpResult.strategy_used}`,
        dp_number: dpResult.dp_number,
        strategy_used: dpResult.strategy_used,
        date_validated: dpResult.date_validated,
        date_match: dpResult.date_match,
        automated: true
      };

      // Atualizar agendamento
      await executeCheckinQuery(
        'UPDATE schedule_list SET no_dp = ?, historic = ? WHERE id = ?',
        [dpResult.dp_number, JSON.stringify(historic), scheduleId]
      );

      console.log(`DP ${dpResult.dp_number} atribuído ao agendamento ${scheduleId}`);

    } catch (error) {
      console.error(`Erro ao salvar DP no agendamento ${scheduleId}:`, error.message);
      throw error;
    }
  }

  /**
   * Atualiza taxa de sucesso
   */
  updateSuccessRate() {
    if (this.statistics.searches > 0) {
      const rate = (this.statistics.successes / this.statistics.searches * 100).toFixed(1);
      this.statistics.success_rate = `${rate}%`;
    }
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStatistics() {
    return {
      ...this.statistics,
      date_validation_rate: this.statistics.date_validations > 0 ? 
        `${(this.statistics.date_matches / this.statistics.date_validations * 100).toFixed(1)}%` : '0%'
    };
  }

  /**
   * Valida estrutura da tabela WTR
   */
  async validateWTRStructure() {
    try {
      const structure = await executeMercocampQuery('DESCRIBE wtr');
      const hasDP = structure.some(field => field.Field === 'no_dp');
      const hasNF = structure.some(field => field.Field === 'no_nf');
      const hasCNPJ = structure.some(field => field.Field === 'cnpj');
      const hasDate = structure.some(field => field.Field === 'dt_inclusao');

      if (!hasDP || !hasNF || !hasCNPJ || !hasDate) {
        throw new Error('Estrutura da tabela WTR incompleta para validação de data');
      }

      const [countResult] = await executeMercocampQuery('SELECT COUNT(*) as total FROM wtr');
      
      return {
        valid: true,
        fields: { no_dp: hasDP, no_nf: hasNF, cnpj: hasCNPJ, dt_inclusao: hasDate },
        counts: { total: countResult.total }
      };
    } catch (error) {
      console.error('Erro ao validar estrutura WTR:', error.message);
      return { valid: false, error: error.message };
    }
  }
}

module.exports = DPVerificationServiceWithDate;