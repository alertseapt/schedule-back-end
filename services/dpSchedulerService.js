const { executeCheckinQuery, executeMercocampQuery } = require('../config/database');

/**
 * Serviço de Agendamento de Busca de DP
 * 
 * Este serviço gerencia a busca automática de números de DP após a criação
 * de agendamentos com status "Conferência". A busca:
 * - Inicia 5 minutos após a criação da DP no Corpem
 * - Repete a cada 5 minutos
 * - Máximo de 10 tentativas
 * - Para quando encontra a DP ou atinge limite de tentativas
 */
class DPSchedulerService {
  constructor() {
    this.activeJobs = new Map(); // scheduleId -> jobInfo
    this.checkInterval = 30 * 1000; // Check a cada 30 segundos
    this.intervalRef = null;
    this.isRunning = false;
  }

  /**
   * Inicia o serviço de agendamento
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ DPSchedulerService já está em execução');
      return;
    }

    console.log('🚀 Iniciando DPSchedulerService...');
    this.isRunning = true;
    
    // Recuperar jobs pendentes do banco
    this.loadPendingJobs();
    
    // Iniciar verificação periódica
    this.intervalRef = setInterval(() => {
      this.processJobs();
    }, this.checkInterval);
  }

  /**
   * Para o serviço
   */
  stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
    this.isRunning = false;
    console.log('🛑 DPSchedulerService parado');
  }

  /**
   * Agenda uma busca de DP para um agendamento
   * @param {Object} scheduleData - Dados do agendamento
   */
  async scheduleDP(scheduleData) {
    const scheduleId = scheduleData.id;
    const now = new Date();
    const firstAttemptTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutos no futuro

    console.log(`📅 Agendando busca de DP para agendamento ${scheduleId}`);
    console.log(`⏰ Primeira tentativa em: ${firstAttemptTime.toLocaleString('pt-BR')}`);

    // Adicionar ao mapa de jobs ativos (sem usar tabela de controle)
    this.activeJobs.set(scheduleId, {
      scheduleId,
      nextAttemptAt: firstAttemptTime,
      attemptCount: 0,
      maxAttempts: 10,
      scheduleNumber: scheduleData.number,
      clientCnpj: scheduleData.client, // Mantido para compatibilidade
      scheduleData: scheduleData // Dados completos para extrair número do cliente
    });

    console.log(`✅ Busca de DP agendada para agendamento ${scheduleId} (em memória)`);
    console.log(`🔍 NF: ${scheduleData.number}, Cliente CNPJ: ${scheduleData.client}`);
  }

  /**
   * Carrega jobs pendentes (simplificado - não usa tabela de controle)
   */
  async loadPendingJobs() {
    console.log('📥 Inicializando serviço sem jobs persistidos (jobs são mantidos em memória)');
    // Jobs serão criados quando novos agendamentos forem marcados como "Agendado"
  }

  /**
   * Processa jobs que estão prontos para execução
   */
  async processJobs() {
    const now = new Date();
    const jobsToProcess = [];

    // Encontrar jobs prontos para execução
    for (const [scheduleId, job] of this.activeJobs) {
      if (job.nextAttemptAt <= now) {
        jobsToProcess.push(job);
      }
    }

    if (jobsToProcess.length > 0) {
      console.log(`⚡ Processando ${jobsToProcess.length} job(s) de busca de DP`);
    }

    // Processar cada job
    for (const job of jobsToProcess) {
      await this.executeJob(job);
    }
  }

  /**
   * Executa uma tentativa de busca de DP
   * @param {Object} job - Informações do job
   */
  async executeJob(job) {
    const { scheduleId, scheduleNumber, clientCnpj, attemptCount, maxAttempts } = job;
    
    console.log(`🔍 [DP-JOB] Tentativa ${attemptCount + 1}/${maxAttempts} - Agendamento ${scheduleId} (NF: ${scheduleNumber})`);

    try {
      // Buscar informações completas do agendamento para extrair número do cliente
      const scheduleData = await this.getScheduleData(scheduleId);
      if (!scheduleData) {
        console.error(`❌ [DP-JOB] Agendamento ${scheduleId} não encontrado`);
        return;
      }

      // Extrair número do cliente das informações da NF-e
      const clientNumber = await this.extractClientNumber(scheduleData);
      if (!clientNumber) {
        console.error(`❌ [DP-JOB] Número do cliente não encontrado para agendamento ${scheduleId}`);
        return;
      }

      console.log(`🔍 [DP-JOB] Usando número do cliente: ${clientNumber}`);

      // Buscar DP na tabela WTR usando triangulação
      const dpResult = await this.searchDPInWTR(scheduleNumber, clientNumber);
      
      if (dpResult.found) {
        console.log(`✅ [DP-JOB] DP encontrada: ${dpResult.dpNumber} para agendamento ${scheduleId}`);
        
        // Atualizar agendamento com DP encontrada
        await this.updateScheduleWithDP(scheduleId, dpResult.dpNumber);
        
        // Marcar job como concluído
        await this.completeJob(scheduleId, 'found', dpResult.dpNumber);
        
        // Remover do mapa de jobs ativos
        this.activeJobs.delete(scheduleId);
        
      } else {
        console.log(`⏳ [DP-JOB] DP não encontrada ainda - Agendamento ${scheduleId} (tentativa ${attemptCount + 1})`);
        
        // Verificar se atingiu limite de tentativas
        if (attemptCount + 1 >= maxAttempts) {
          console.log(`🚫 [DP-JOB] Limite de tentativas atingido para agendamento ${scheduleId}`);
          await this.completeJob(scheduleId, 'failed', null, 'Máximo de tentativas atingido');
          this.activeJobs.delete(scheduleId);
        } else {
          // Agendar próxima tentativa em 5 minutos
          await this.scheduleNextAttempt(job);
        }
      }
      
    } catch (error) {
      console.error(`❌ [DP-JOB] Erro na busca de DP para agendamento ${scheduleId}:`, error);
      
      // Agendar nova tentativa mesmo com erro (a menos que atinja limite)
      if (attemptCount + 1 >= maxAttempts) {
        await this.completeJob(scheduleId, 'failed', null, error.message);
        this.activeJobs.delete(scheduleId);
      } else {
        await this.scheduleNextAttempt(job, error.message);
      }
    }
  }

  /**
   * Busca dados completos do agendamento
   * @param {number} scheduleId - ID do agendamento
   */
  async getScheduleData(scheduleId) {
    try {
      const results = await executeCheckinQuery(`
        SELECT id, number, client, supplier, info, historic
        FROM schedule_list 
        WHERE id = ?
      `, [scheduleId]);

      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error(`❌ Erro ao buscar dados do agendamento ${scheduleId}:`, error);
      return null;
    }
  }

  /**
   * Extrai o número do cliente das informações da NF-e
   * @param {Object} scheduleData - Dados do agendamento
   */  
  async extractClientNumber(scheduleData) {
    try {
      // Primeiro tentar extrair das informações parseadas da NF-e
      if (scheduleData.info) {
        let nfeInfo;
        try {
          nfeInfo = typeof scheduleData.info === 'string' ? JSON.parse(scheduleData.info) : scheduleData.info;
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear info da NF-e:`, parseError);
        }

        if (nfeInfo) {
          // Procurar número do cliente nas informações da NF-e
          // Estrutura típica: nfeInfo.ide.numeroCliente ou similar
          if (nfeInfo.dest && nfeInfo.dest.numeroCliente) {
            return String(nfeInfo.dest.numeroCliente);
          }
          
          // Alternativa: buscar em outras estruturas da NF-e
          if (nfeInfo.ide && nfeInfo.ide.numeroCliente) {
            return String(nfeInfo.ide.numeroCliente);
          }

          console.log(`🔍 [CLIENT-EXTRACT] Estrutura da NF-e disponível:`, Object.keys(nfeInfo));
        }
      }

      // Se não encontrou nas informações da NF-e, tentar extrair do histórico
      if (scheduleData.historic) {
        try {
          const historic = typeof scheduleData.historic === 'string' ? JSON.parse(scheduleData.historic) : scheduleData.historic;
          if (historic.clientNumber) {
            return String(historic.clientNumber);
          }
        } catch (parseError) {
          console.warn(`⚠️ Erro ao parsear histórico:`, parseError);
        }
      }

      // Última tentativa: usar CNPJ como identificador e buscar em tabela auxiliar se necessário
      if (scheduleData.client) {
        console.log(`⚠️ [CLIENT-EXTRACT] Não foi possível extrair número do cliente, tentando usar CNPJ: ${scheduleData.client}`);
        // Pode ser necessário consultar uma tabela de correlação CNPJ -> número do cliente
        return await this.getCorporateClientNumber(scheduleData.client);
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
      
      console.log(`🔍 [CLIENT-EXTRACT] Buscando número do cliente para CNPJ: ${cleanCnpj}`);
      
      // Buscar na tabela wcl usando correlação CNPJ -> no_seq
      const clientResults = await executeMercocampQuery(`
        SELECT no_seq, nome_cliente, cnpj_cpf 
        FROM wcl 
        WHERE REPLACE(REPLACE(REPLACE(cnpj_cpf, '.', ''), '/', ''), '-', '') LIKE ?
        LIMIT 1
      `, [`%${cleanCnpj.substring(0, 8)}%`]);

      if (clientResults.length > 0) {
        const client = clientResults[0];
        console.log(`✅ [CLIENT-EXTRACT] Cliente encontrado: ${client.no_seq} - ${client.nome_cliente}`);
        return String(client.no_seq);
      }

      // Se não encontrou, usar fallback com primeiros dígitos do CNPJ
      console.log(`⚠️ [CLIENT-EXTRACT] Cliente não encontrado na wcl, usando fallback: ${cleanCnpj.substring(0, 8)}`);
      return cleanCnpj.substring(0, 8);

    } catch (error) {
      console.error(`❌ Erro ao processar CNPJ do cliente:`, error);
      // Fallback em caso de erro
      const cleanCnpj = cnpj.replace(/\D/g, '');
      return cleanCnpj.substring(0, 8);
    }
  }

  /**
   * Busca DP na tabela WTR do dbmercocamp
   * @param {string} nfNumber - Número da NF
   * @param {string} clientNumber - Número do cliente (no_cli)
   */
  async searchDPInWTR(nfNumber, clientNumber) {
    try {
      console.log(`🔎 [DP-SEARCH] Buscando DP para NF ${nfNumber}, Cliente ${clientNumber}`);

      // Buscar na tabela WTR usando triangulação: no_nf, no_cli e no_dp
      // Considera que no_nf pode conter múltiplas NFs separadas por vírgula
      const results = await executeMercocampQuery(`
        SELECT no_dp, no_nf, no_cli
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
        console.log(`✅ [DP-SEARCH] DP encontrada: ${dp.no_dp} (NF: ${dp.no_nf}, Cliente: ${dp.no_cli})`);
        return {
          found: true,
          dpNumber: dp.no_dp,
          data: dp
        };
      } else {
        console.log(`⏳ [DP-SEARCH] DP não encontrada para NF ${nfNumber}, Cliente ${clientNumber}`);
        
        // Busca alternativa apenas por NF para debug
        const nfOnlyResults = await executeMercocampQuery(`
          SELECT no_dp, no_nf, no_cli
          FROM wtr 
          WHERE no_nf = ?
          AND no_dp IS NOT NULL 
          AND no_dp != '' 
          AND no_dp != '0'
          LIMIT 3
        `, [nfNumber]);

        if (nfOnlyResults.length > 0) {
          console.log(`🔍 [DP-SEARCH] Encontradas ${nfOnlyResults.length} entradas para NF ${nfNumber}:`);
          nfOnlyResults.forEach(row => {
            console.log(`   - DP: ${row.no_dp}, Cliente: ${row.no_cli}`);
          });
        }
        
        return {
          found: false,
          dpNumber: null
        };
      }
      
    } catch (error) {
      console.error(`❌ [DP-SEARCH] Erro na busca:`, error);
      throw error;
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
      
      console.log(`✅ [DP-UPDATE] Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
    } catch (error) {
      console.error(`❌ [DP-UPDATE] Erro ao atualizar agendamento ${scheduleId}:`, error);
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
        console.log('📋 Adicionando colunas de DP na tabela schedule_list...');
        
        // Adicionar colunas para DP
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN no_dp VARCHAR(50) NULL COMMENT 'Número da DP (Documento de Portaria)',
          ADD COLUMN dp_found_at DATETIME NULL COMMENT 'Data e hora quando DP foi encontrada'
        `);
        
        console.log('✅ Colunas de DP adicionadas com sucesso');
      }
    } catch (error) {
      // Se erro for que coluna já existe, ignorar
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('📋 Colunas de DP já existem na tabela schedule_list');
      } else {
        console.error('❌ Erro ao verificar/criar colunas de DP:', error);
      }
    }
  }

  /**
   * Agenda a próxima tentativa de busca (apenas em memória)
   * @param {Object} job - Informações do job
   * @param {string} lastError - Último erro ocorrido
   */
  async scheduleNextAttempt(job, lastError = null) {
    const nextAttemptAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
    const newAttemptCount = job.attemptCount + 1;

    // Atualizar apenas no mapa local (sem usar tabela de controle)
    job.nextAttemptAt = nextAttemptAt;
    job.attemptCount = newAttemptCount;

    console.log(`⏰ [DP-JOB] Próxima tentativa agendada para ${nextAttemptAt.toLocaleString('pt-BR')} - Agendamento ${job.scheduleId}`);
  }

  /**
   * Marca um job como concluído (apenas em memória)
   * @param {number} scheduleId - ID do agendamento
   * @param {string} status - Status final ('found', 'failed')
   * @param {string} dpNumber - Número da DP (se encontrada)
   * @param {string} errorMessage - Mensagem de erro (se falhou)
   */
  async completeJob(scheduleId, status, dpNumber = null, errorMessage = null) {
    console.log(`🏁 [DP-JOB] Job concluído para agendamento ${scheduleId} - Status: ${status}`);
    // Job será removido do mapa de jobs ativos pelo chamador
  }

  /**
   * Retorna estatísticas dos jobs de busca de DP (apenas em memória)
   */
  async getStats() {
    return {
      active_jobs: this.activeJobs.size,
      service_running: this.isRunning,
      check_interval: this.checkInterval,
      max_attempts: 10,
      retry_interval: '5 minutos'
    };
  }
}

// Instância única do serviço
const dpSchedulerService = new DPSchedulerService();

module.exports = dpSchedulerService;