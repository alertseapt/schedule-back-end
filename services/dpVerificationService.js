const { executeCheckinQuery, executeMercocampQuery } = require('../config/database-render');
const corpemService = require('./corpemIntegration');

/**
 * Serviço de Verificação de DP (Documento de Portaria)
 * 
 * Este serviço verifica periodicamente se agendamentos sem DP atribuído
 * podem ter seu número de DP obtido através da consulta à tabela WTR
 * do banco de dados dbmercocamp.
 * 
 * Fluxo de verificação:
 * 1. Busca agendamentos sem DP (no_dp é null/vazio)
 * 2. Para cada agendamento, extrai número da NF e cliente
 * 3. Consulta tabela WTR do dbmercocamp para encontrar DP correspondente
 * 4. Se encontrado, atualiza o campo no_dp na tabela schedule_list
 * 
 * @author Sistema de Agendamentos
 * @version 2.0 - Apenas verificação via tabela WTR
 */
class DPVerificationService {
  constructor() {
    this.intervalRef = null;
    this.isRunning = false;
    this.VERIFICATION_INTERVAL = 5 * 1000; // 5 segundos
    
    // Flag para desabilitar temporariamente o serviço
    this.isTemporarilyDisabled = false; // ATIVADO PARA FUNCIONALIDADE DE NF/DP
  }

  /**
   * Inicia o serviço de verificação periódica
   */
  start() {
    // Verificar se está temporariamente desabilitado
    if (this.isTemporarilyDisabled) {
      console.log('⚠️ Serviço de verificação de DP está temporariamente DESABILITADO');
      console.log('💡 Para reabilitar, altere isTemporarilyDisabled = false no código');
      return;
    }

    if (this.isRunning) {
      console.log('⚠️ Serviço de verificação de DP já está em execução');
      return;
    }

    console.log('🚀 Iniciando serviço de verificação de DP...');
    this.isRunning = true;
    
    // Executar primeira verificação imediatamente
    this.runVerification();
    
    // Configurar verificação periódica
    this.intervalRef = setInterval(() => {
      this.runVerification();
    }, this.VERIFICATION_INTERVAL);
    
    console.log(`✅ Serviço de verificação de DP iniciado (intervalo: ${this.VERIFICATION_INTERVAL}ms)`);
  }

  /**
   * Para o serviço de verificação periódica
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ Serviço de verificação de DP não estava em execução');
      return;
    }

    console.log('🛑 Parando serviço de verificação de DP...');
    
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    
    this.isRunning = false;
    console.log('✅ Serviço de verificação de DP parado');
  }

  /**
   * Executa uma verificação completa de todos os agendamentos
   */
  async runVerification() {
    try {
      console.log('🔍 Iniciando verificação de DP...');
      
      // Buscar agendamentos que ainda não têm DP atribuído
      const schedules = await this.getSchedulesWithoutDP();
      
      if (schedules.length === 0) {
        console.log('ℹ️ Nenhum agendamento sem DP encontrado');
        return;
      }

      console.log(`📋 Encontrados ${schedules.length} agendamentos para verificação`);
      
      let processedCount = 0;
      let successCount = 0;

      for (const schedule of schedules) {
        try {
          const dpNumber = await this.verifyAndGetDP(schedule);
          
          if (dpNumber) {
            successCount++;
            console.log(`✅ DP ${dpNumber} atribuído ao agendamento ${schedule.id} (NF: ${schedule.number})`);
          }
          
          processedCount++;
        } catch (error) {
          console.error(`❌ Erro ao processar agendamento ${schedule.id}:`, error.message);
          processedCount++;
        }
      }

      console.log(`📊 Verificação concluída: ${processedCount} processados, ${successCount} atualizados`);
      
    } catch (error) {
      console.error('❌ Erro na verificação de DP:', error);
    }
  }

  /**
   * Busca agendamentos que ainda não têm DP atribuído
   */
  async getSchedulesWithoutDP() {
    const query = `
      SELECT id, number, nfe_key, client, supplier, info, historic
      FROM schedule_list 
      WHERE (no_dp IS NULL OR no_dp = '' OR no_dp = '0')
      AND number IS NOT NULL 
      AND client IS NOT NULL
      AND status NOT IN ('Cancelado', 'Recusado')
      ORDER BY date DESC
      LIMIT 100
    `;
    
    return await executeCheckinQuery(query);
  }

  /**
   * Verifica e obtém o número da DP para um agendamento usando triangulação rigorosa
   * APENAS captura DP se houver correspondência exata: CNPJ + NF + Data de inclusão
   * 
   * @param {Object} schedule - Dados do agendamento
   * @returns {String|null} - Número da DP ou null
   */
  async verifyAndGetDP(schedule) {
    try {
      const nfNumber = this.extractNfNumber(schedule);
      const cnpj = await this.extractCNPJ(schedule);

      if (!nfNumber || !cnpj) {
        console.log(`⚠️ Dados insuficientes para triangulação - NF: ${nfNumber}, CNPJ: ${cnpj}`);
        return null;
      }

      console.log(`📄 Verificando com triangulação rigorosa - NF: ${nfNumber}, CNPJ: ${cnpj}, ID: ${schedule.id}`);

      // Usar serviço de triangulação rigorosa
      const DPVerificationServiceWithDate = require('./dpVerificationServiceWithDate');
      const dpServiceWithDate = new DPVerificationServiceWithDate();
      
      const dpResult = await dpServiceWithDate.getDPFromWtrTableWithTriangulation(
        nfNumber, 
        cnpj, 
        schedule.id
      );
      
      if (dpResult && dpResult.triangulation_complete) {
        console.log(`✅ DP encontrado com triangulação válida: ${dpResult.dp_number}`);
        console.log(`   ✓ Triangulação completa: CNPJ + NF + Data confirmadas`);
        
        await this.updateScheduleDP(schedule.id, dpResult.dp_number);
        return dpResult.dp_number;
      }

      console.log(`❌ DP não encontrado - triangulação falhou para NF ${nfNumber}`);
      console.log(`   Motivo: Sem correspondência exata de CNPJ + NF + Data de inclusão`);
      return null;
    } catch (error) {
      console.error(`❌ Erro ao verificar DP para agendamento ${schedule.id}:`, error);
      return null;
    }
  }

  /**
   * Verifica e obtém o número da DP para um agendamento (implementação original)
   * Mantida para compatibilidade
   * 
   * @param {Object} schedule - Dados do agendamento
   * @returns {String|null} - Número da DP ou null
   */
  async verifyAndGetDPOriginal(schedule) {
    try {
      const nfNumber = this.extractNfNumber(schedule);
      const clientNumber = await this.extractClientNumber(schedule);

      if (!nfNumber || !clientNumber) {
        console.log(`⚠️ Dados insuficientes - NF: ${nfNumber}, Cliente: ${clientNumber}`);
        return null;
      }

      console.log(`📄 Verificando NF: ${nfNumber}, Cliente: ${clientNumber}`);

      // Buscar DP diretamente na tabela WTR
      const dpNumber = await this.getDPFromWtrTable(nfNumber, clientNumber);
      
      if (dpNumber) {
        console.log(`✅ DP encontrado na tabela WTR: ${dpNumber}`);
        await this.updateScheduleDP(schedule.id, dpNumber);
        return dpNumber;
      }

      console.log(`❌ DP não encontrado para NF ${nfNumber}`);
      return null;
    } catch (error) {
      console.error(`❌ Erro ao verificar DP para agendamento ${schedule.id}:`, error);
      return null;
    }
  }

  /**
   * Extrai número da NF do agendamento
   * 
   * @param {Object} schedule - Dados do agendamento
   * @returns {String|null} - Número da NF ou null
   */
  extractNfNumber(schedule) {
    // Tentar diferentes campos onde o número da NF pode estar
    if (schedule.number) {
      return String(schedule.number);
    }
    
    // Se tiver informações da NFe parseadas
    if (schedule.info) {
      try {
        const info = typeof schedule.info === 'string' ? JSON.parse(schedule.info) : schedule.info;
        if (info.ide && info.ide.nNF) {
          return String(info.ide.nNF);
        }
      } catch (error) {
        console.warn('Erro ao parsear info do agendamento:', error);
      }
    }
    
    return null;
  }

  /**
   * Extrai CNPJ do agendamento para triangulação
   * 
   * @param {Object} schedule - Dados do agendamento
   * @returns {String|null} - CNPJ ou null
   */
  async extractCNPJ(schedule) {
    try {
      // Primeiro tentar extrair das informações parseadas da NF-e
      if (schedule.info) {
        let nfeInfo;
        try {
          nfeInfo = typeof schedule.info === 'string' ? JSON.parse(schedule.info) : schedule.info;
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear info da NF-e:`, parseError);
        }

        if (nfeInfo) {
          // Procurar CNPJ nas informações da NF-e
          if (nfeInfo.dest && nfeInfo.dest.CNPJ) {
            return String(nfeInfo.dest.CNPJ);
          }
          
          if (nfeInfo.dest && nfeInfo.dest.cnpj) {
            return String(nfeInfo.dest.cnpj);
          }
          
          if (nfeInfo.ide && nfeInfo.ide.CNPJ) {
            return String(nfeInfo.ide.CNPJ);
          }
        }
      }

      // Se não encontrou nas informações da NF-e, usar o campo client diretamente
      if (schedule.client) {
        // Limpar CNPJ (manter apenas números)
        const cleanCnpj = schedule.client.replace(/\D/g, '');
        if (cleanCnpj.length >= 11) { // CNPJ tem 14 dígitos, CPF tem 11
          return cleanCnpj;
        }
        // Se não estiver limpo, retornar como está
        return schedule.client;
      }

      // Tentar extrair do histórico
      if (schedule.historic) {
        try {
          const historic = typeof schedule.historic === 'string' ? JSON.parse(schedule.historic) : schedule.historic;
          if (historic.client_cnpj) {
            return String(historic.client_cnpj);
          }
          if (historic.cnpj) {
            return String(historic.cnpj);
          }
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear histórico:`, parseError);
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Erro ao extrair CNPJ:`, error);
      return null;
    }
  }

  /**
   * Extrai o número do cliente do agendamento (compatível com tabela wtr.no_cli)
   */
  async extractClientNumber(schedule) {
    try {
      // Primeiro tentar extrair das informações parseadas da NF-e
      if (schedule.info) {
        let nfeInfo;
        try {
          nfeInfo = typeof schedule.info === 'string' ? JSON.parse(schedule.info) : schedule.info;
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear info da NF-e:`, parseError);
        }

        if (nfeInfo) {
          // Procurar número do cliente nas informações da NF-e
          if (nfeInfo.dest && nfeInfo.dest.numeroCliente) {
            return String(nfeInfo.dest.numeroCliente);
          }
          
          if (nfeInfo.ide && nfeInfo.ide.numeroCliente) {
            return String(nfeInfo.ide.numeroCliente);
          }
        }
      }

      // Se não encontrou nas informações da NF-e, tentar extrair do histórico
      if (schedule.historic) {
        try {
          const historic = typeof schedule.historic === 'string' ? JSON.parse(schedule.historic) : schedule.historic;
          if (historic.clientNumber) {
            return String(historic.clientNumber);
          }
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear histórico:`, parseError);
        }
      }

      // Última tentativa: usar CNPJ para buscar número do cliente na tabela wcl
      if (schedule.client) {
        const clientNumber = await this.getCorporateClientNumber(schedule.client);
        if (clientNumber) {
          return clientNumber;
        }
      }

      return null;
    } catch (error) {
      console.error(`❌ Erro ao extrair número do cliente:`, error);
      return null;
    }
  }

  /**
   * Obtém número do cliente através do CNPJ usando tabela wcl
   * @param {string} cnpj - CNPJ do cliente
   */
  async getCorporateClientNumber(cnpj) {
    try {
      // Limpar CNPJ (apenas números)
      const cleanCnpj = cnpj.replace(/\D/g, '');
      
      console.log(`🔍 Buscando número do cliente para CNPJ: ${cleanCnpj}`);
      
      // Buscar na tabela wcl usando correlação CNPJ -> no_seq
      const clientResults = await executeMercocampQuery(`
        SELECT no_seq, nome_cliente, cnpj_cpf 
        FROM wcl 
        WHERE REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '/', ''), '-', '') LIKE ?
        LIMIT 1
      `, [`%${cleanCnpj.substring(0, 8)}%`]);

      if (clientResults.length > 0) {
        const client = clientResults[0];
        console.log(`✅ Cliente encontrado: ${client.no_seq} - ${client.nome_cliente}`);
        return String(client.no_seq);
      }

      // Se não encontrou, usar fallback com primeiros dígitos do CNPJ
      console.log(`⚠️ Cliente não encontrado na wcl, usando fallback: ${cleanCnpj.substring(0, 8)}`);
      return cleanCnpj.substring(0, 8);

    } catch (error) {
      console.error(`❌ Erro ao processar CNPJ do cliente:`, error);
      // Fallback em caso de erro
      const cleanCnpj = cnpj.replace(/\D/g, '');
      return cleanCnpj.substring(0, 8);
    }
  }

  /**
   * Busca DP na tabela WTR do banco dbmercocamp
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} clientNumber - Número do cliente
   * @returns {String|null} - Número da DP ou null
   */
  async getDPFromWtrTable(nfNumber, clientNumber) {
    try {
      // Query principal para buscar na tabela wtr usando triangulação
      // no_nf (número da NF), no_cli (número do cliente), no_dp (número da DP)
      // Considera que no_nf pode conter múltiplas NFs separadas por vírgula
      const query = `
        SELECT no_dp, no_nf, no_cli 
        FROM wtr 
        WHERE (no_nf = ? OR no_nf LIKE ? OR no_nf LIKE ? OR no_nf LIKE ?) 
        AND no_cli = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `;

      const results = await executeMercocampQuery(query, [nfNumber, clientNumber]);

      if (results.length > 0) {
        console.log(`✅ DP encontrado com correspondência exata: ${results[0].no_dp}`);
        return results[0].no_dp;
      }

      // Se não encontrou com correspondência exata, tentar busca mais flexível
      console.log(`🔍 Tentando busca flexível na tabela wtr para NF: ${nfNumber}`);
      
      const flexibleQuery = `
        SELECT no_dp, no_nf, no_cli 
        FROM wtr 
        WHERE no_nf = ?
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
        LIMIT 1
      `;

      const flexibleResults = await executeMercocampQuery(flexibleQuery, [nfNumber]);

      if (flexibleResults.length > 0) {
        // Verificar se o cliente é compatível (pode ser uma verificação mais complexa)
        const result = flexibleResults[0];
        console.log(`⚠️ DP encontrado com busca flexível: ${result.no_dp} (cliente: ${result.no_cli})`);
        return result.no_dp;
      }

      // Última tentativa: buscar qualquer DP para esta NF (mais permissivo)
      console.log(`🔍 Última tentativa: busca permissiva para NF: ${nfNumber}`);
      
      const permissiveQuery = `
        SELECT no_dp, no_nf, no_cli 
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
        console.log(`⚠️ DP encontrado com busca permissiva: ${result.no_dp} (NF: ${result.no_nf}, Cliente: ${result.no_cli})`);
        return result.no_dp;
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar DP na tabela wtr:', error);
      
      // Se o erro for relacionado a colunas não existentes, tentar estruturas alternativas
      if (error.code === 'ER_BAD_FIELD_ERROR') {
        console.log('🔍 Tentando estruturas alternativas da tabela wtr...');
        return await this.tryAlternativeWtrStructures(nfNumber, clientNumber);
      }
      
      return null;
    }
  }

  /**
   * Tenta estruturas alternativas da tabela wtr caso as colunas padrão não existam
   * 
   * @param {String} nfNumber - Número da NF
   * @param {String} clientNumber - Número do cliente  
   * @returns {String|null} - Número da DP ou null
   */
  async tryAlternativeWtrStructures(nfNumber, clientNumber) {
    // Possíveis nomes alternativos para as colunas
    const alternativeStructures = [
      // Estrutura 1: nomes abreviados
      { dp: 'dp', nf: 'nf', cli: 'cli' },
      // Estrutura 2: nomes longos
      { dp: 'numero_dp', nf: 'numero_nf', cli: 'numero_cliente' },
      // Estrutura 3: outras variações
      { dp: 'documento_portaria', nf: 'nota_fiscal', cli: 'cliente' },
      // Estrutura 4: inglês
      { dp: 'dp_number', nf: 'nf_number', cli: 'client_number' }
    ];

    for (const structure of alternativeStructures) {
      try {
        console.log(`🔍 Tentando estrutura: dp=${structure.dp}, nf=${structure.nf}, cli=${structure.cli}`);
        
        const query = `
          SELECT ${structure.dp} as no_dp, ${structure.nf} as no_nf, ${structure.cli} as no_cli 
          FROM wtr 
          WHERE ${structure.nf} = ? 
          AND ${structure.cli} = ?
          AND ${structure.dp} IS NOT NULL 
          AND ${structure.dp} != '' 
          AND ${structure.dp} != '0'
          LIMIT 1
        `;

        const results = await executeMercocampQuery(query, [nfNumber, clientNumber]);

        if (results.length > 0) {
          console.log(`✅ DP encontrado com estrutura alternativa: ${results[0].no_dp}`);
          return results[0].no_dp;
        }
      } catch (altError) {
        // Continuar tentando outras estruturas
        continue;
      }
    }

    // Se nenhuma estrutura funcionou, tentar listar a estrutura da tabela
    try {
      console.log('🔍 Verificando estrutura real da tabela wtr...');
      const tableStructure = await executeMercocampQuery('DESCRIBE wtr');
      console.log('📋 Colunas disponíveis na tabela wtr:', tableStructure.map(col => col.Field).join(', '));
      
      // Tentar identificar colunas que possam conter DP/NF/Cliente
      const columns = tableStructure.map(col => col.Field.toLowerCase());
      const dpColumn = columns.find(col => col.includes('dp') || col.includes('portaria') || col.includes('document'));
      const nfColumn = columns.find(col => col.includes('nf') || col.includes('nota') || col.includes('fiscal'));
      const clientColumn = columns.find(col => col.includes('cli') || col.includes('client') || col.includes('cnpj'));
      
      if (dpColumn && nfColumn) {
        console.log(`🔍 Tentando colunas identificadas: dp=${dpColumn}, nf=${nfColumn}, cli=${clientColumn || 'ANY'}`);
        
        let smartQuery;
        let smartParams;
        
        if (clientColumn) {
          smartQuery = `SELECT ${dpColumn} as no_dp FROM wtr WHERE ${nfColumn} = ? AND ${clientColumn} = ? AND ${dpColumn} IS NOT NULL LIMIT 1`;
          smartParams = [nfNumber, clientNumber];
        } else {
          smartQuery = `SELECT ${dpColumn} as no_dp FROM wtr WHERE ${nfNumber} = ? AND ${dpColumn} IS NOT NULL LIMIT 1`;
          smartParams = [nfNumber];
        }
        
        const smartResults = await executeMercocampQuery(smartQuery, smartParams);
        
        if (smartResults.length > 0) {
          console.log(`✅ DP encontrado com detecção inteligente: ${smartResults[0].no_dp}`);
          return smartResults[0].no_dp;
        }
      }
      
    } catch (structureError) {
      console.error('Erro ao verificar estrutura da tabela:', structureError.message);
    }

    return null;
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
      
      console.log(`✅ Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
    } catch (error) {
      console.error(`❌ Erro ao atualizar DP do agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Verifica o status do serviço
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      interval: this.VERIFICATION_INTERVAL,
      nextRun: this.isRunning ? new Date(Date.now() + this.VERIFICATION_INTERVAL) : null
    };
  }

  /**
   * Força uma verificação manual de um agendamento específico
   * 
   * @param {Number} scheduleId - ID do agendamento
   * @returns {Object} - Resultado da verificação
   */
  async forceVerification(scheduleId) {
    try {
      console.log(`🔧 Verificação manual forçada para agendamento ${scheduleId}`);
      
      const schedules = await executeCheckinQuery(
        'SELECT id, number, nfe_key, client, supplier, info, historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );

      if (schedules.length === 0) {
        return { success: false, message: 'Agendamento não encontrado' };
      }

      const schedule = schedules[0];
      const dpNumber = await this.verifyAndGetDP(schedule);

      if (dpNumber) {
        return { 
          success: true, 
          message: `DP ${dpNumber} atribuído com sucesso`,
          dpNumber 
        };
      } else {
        return { 
          success: false, 
          message: 'DP não encontrado para este agendamento' 
        };
      }
    } catch (error) {
      console.error('Erro na verificação manual:', error);
      return { 
        success: false, 
        message: `Erro na verificação: ${error.message}` 
      };
    }
  }
}

module.exports = new DPVerificationService();