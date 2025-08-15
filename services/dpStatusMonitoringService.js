const { executeCheckinQuery, executeMercocampQuery } = require('../config/database');

/**
 * Serviço de Monitoramento de Status de DP
 * 
 * Monitora mudanças na situação dos DPs na tabela WTR e atualiza
 * automaticamente o status dos agendamentos quando DP for "Fechado"
 */
class DPStatusMonitoringService {
  constructor() {
    this.monitoringInterval = null;
    this.isRunning = false;
    this.checkIntervalMs = 30000; // 30 segundos
    this.statistics = {
      checks: 0,
      updates_made: 0,
      last_check: null,
      last_update: null,
      errors: 0
    };
  }

  /**
   * Inicia o serviço de monitoramento
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ [DP-STATUS] Serviço já está em execução');
      return;
    }

    console.log('🚀 [DP-STATUS] Iniciando serviço de monitoramento de situação DP...');
    this.isRunning = true;

    // Executar primeira verificação imediatamente
    this.checkDPStatus();

    // Configurar intervalo de verificação
    this.monitoringInterval = setInterval(() => {
      this.checkDPStatus();
    }, this.checkIntervalMs);

    console.log(`✅ [DP-STATUS] Serviço iniciado - verificação a cada ${this.checkIntervalMs / 1000}s`);
  }

  /**
   * Para o serviço de monitoramento
   */
  stop() {
    if (!this.isRunning) {
      console.log('⚠️ [DP-STATUS] Serviço já está parado');
      return;
    }

    console.log('🛑 [DP-STATUS] Parando serviço de monitoramento...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isRunning = false;
    console.log('✅ [DP-STATUS] Serviço parado com sucesso');
  }

  /**
   * Executa verificação completa de status dos DPs
   */
  async checkDPStatus() {
    const startTime = Date.now();
    
    console.log('🔍 [DP-STATUS] Iniciando verificação de situação dos DPs...');
    
    try {
      this.statistics.checks++;
      this.statistics.last_check = new Date().toISOString();

      // Buscar agendamentos que têm DP mas não estão em "Em estoque"
      const schedulesToCheck = await this.getSchedulesForStatusCheck();
      
      if (schedulesToCheck.length === 0) {
        console.log('ℹ️ [DP-STATUS] Nenhum agendamento encontrado para verificação');
        return;
      }

      console.log(`📋 [DP-STATUS] ${schedulesToCheck.length} agendamentos para verificar`);

      let updatesCount = 0;

      // Verificar cada agendamento
      for (const schedule of schedulesToCheck) {
        try {
          const wasUpdated = await this.checkAndUpdateScheduleStatus(schedule);
          if (wasUpdated) {
            updatesCount++;
          }
        } catch (error) {
          console.error(`❌ [DP-STATUS] Erro ao verificar agendamento ${schedule.id}:`, error.message);
          this.statistics.errors++;
        }
      }

      const duration = Date.now() - startTime;
      
      if (updatesCount > 0) {
        this.statistics.updates_made += updatesCount;
        this.statistics.last_update = new Date().toISOString();
        console.log(`✅ [DP-STATUS] ${updatesCount} agendamento(s) atualizado(s) para "Em estoque" em ${duration}ms`);
      } else {
        console.log(`ℹ️ [DP-STATUS] Verificação concluída - nenhuma atualização necessária (${duration}ms)`);
      }

    } catch (error) {
      console.error('❌ [DP-STATUS] Erro na verificação de situação:', error.message);
      this.statistics.errors++;
    }
  }

  /**
   * Busca agendamentos que precisam ser verificados
   */
  async getSchedulesForStatusCheck() {
    const query = `
      SELECT id, status, no_dp, number, client, historic
      FROM schedule_list 
      WHERE no_dp IS NOT NULL 
        AND no_dp != '' 
        AND status != 'Em estoque'
        AND status != 'Cancelado'
        AND status != 'Concluído'
      ORDER BY id DESC
      LIMIT 100
    `;

    return await executeCheckinQuery(query);
  }

  /**
   * Verifica e atualiza o status de um agendamento específico
   */
  async checkAndUpdateScheduleStatus(schedule) {
    const logPrefix = `[DP-STATUS][ID:${schedule.id}]`;
    
    try {
      // Verificar situação do DP na tabela WTR
      const dpStatus = await this.getDPStatus(schedule.no_dp);
      
      if (!dpStatus) {
        console.log(`${logPrefix} ⚠️ DP ${schedule.no_dp} não encontrado na tabela WTR`);
        return false;
      }

      console.log(`${logPrefix} 📋 DP: ${schedule.no_dp} | Situação: "${dpStatus.situacao}"`);

      // Verificar se situação é "Fechado"
      if (dpStatus.situacao && dpStatus.situacao.trim().toLowerCase() === 'fechado') {
        console.log(`${logPrefix} ✅ DP está "Fechado" - atualizando status para "Em estoque"`);
        
        // Atualizar status do agendamento
        await this.updateScheduleToEmEstoque(schedule);
        
        return true;
      } else {
        console.log(`${logPrefix} ℹ️ DP não está fechado (situação: "${dpStatus.situacao}")`);
        return false;
      }

    } catch (error) {
      console.error(`${logPrefix} ❌ Erro:`, error.message);
      throw error;
    }
  }

  /**
   * Busca o status de um DP na tabela WTR
   */
  async getDPStatus(dpNumber) {
    const query = `
      SELECT no_dp, situacao, no_nf, cnpj
      FROM wtr 
      WHERE no_dp = ?
      LIMIT 1
    `;

    const results = await executeMercocampQuery(query, [dpNumber]);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Atualiza um agendamento para status "Em estoque"
   */
  async updateScheduleToEmEstoque(schedule) {
    const logPrefix = `[DP-STATUS][ID:${schedule.id}]`;
    
    try {
      // Preparar histórico atualizado
      let historic = {};
      if (schedule.historic) {
        try {
          historic = typeof schedule.historic === 'string' 
            ? JSON.parse(schedule.historic) 
            : schedule.historic;
        } catch (e) {
          console.warn(`${logPrefix} ⚠️ Erro ao parsear histórico existente, criando novo`);
          historic = {};
        }
      }

      // Adicionar entrada no histórico
      const timestamp = Date.now();
      const historicKey = `status_${timestamp}`;
      
      historic[historicKey] = {
        timestamp: new Date().toISOString(),
        user: 'Sistema',
        action: 'Status alterado automaticamente para Em estoque',
        comment: `DP ${schedule.no_dp} foi marcado como "Fechado" na tabela WTR`,
        previous_status: schedule.status,
        new_status: 'Em estoque',
        dp_number: schedule.no_dp,
        automated: true
      };

      // Atualizar agendamento
      const updateQuery = `
        UPDATE schedule_list 
        SET status = ?, historic = ? 
        WHERE id = ?
      `;

      await executeCheckinQuery(updateQuery, [
        'Em estoque',
        JSON.stringify(historic),
        schedule.id
      ]);

      console.log(`${logPrefix} ✅ Agendamento atualizado: "${schedule.status}" → "Em estoque"`);
      console.log(`${logPrefix} 📝 Histórico atualizado com entrada do Sistema`);

    } catch (error) {
      console.error(`${logPrefix} ❌ Erro ao atualizar agendamento:`, error.message);
      throw error;
    }
  }

  /**
   * Força verificação de um agendamento específico
   */
  async forceCheckSchedule(scheduleId) {
    const logPrefix = `[DP-STATUS-FORCE][ID:${scheduleId}]`;
    
    try {
      console.log(`${logPrefix} 🔍 Forçando verificação do agendamento...`);

      // Buscar agendamento
      const schedules = await executeCheckinQuery(
        'SELECT id, status, no_dp, number, client, historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );

      if (schedules.length === 0) {
        return {
          success: false,
          message: 'Agendamento não encontrado'
        };
      }

      const schedule = schedules[0];

      if (!schedule.no_dp) {
        return {
          success: false,
          message: 'Agendamento não possui DP atribuído'
        };
      }

      if (schedule.status === 'Em estoque') {
        return {
          success: false,
          message: 'Agendamento já está em "Em estoque"'
        };
      }

      // Verificar e atualizar
      const wasUpdated = await this.checkAndUpdateScheduleStatus(schedule);

      if (wasUpdated) {
        return {
          success: true,
          message: 'Agendamento atualizado para "Em estoque"',
          dp_number: schedule.no_dp,
          previous_status: schedule.status,
          new_status: 'Em estoque'
        };
      } else {
        return {
          success: false,
          message: 'DP não está em situação "Fechado" na tabela WTR',
          dp_number: schedule.no_dp
        };
      }

    } catch (error) {
      console.error(`${logPrefix} ❌ Erro na verificação forçada:`, error.message);
      return {
        success: false,
        message: 'Erro interno na verificação',
        error: error.message
      };
    }
  }

  /**
   * Retorna estatísticas do serviço
   */
  getStatistics() {
    return {
      ...this.statistics,
      is_running: this.isRunning,
      check_interval_seconds: this.checkIntervalMs / 1000,
      uptime_since_start: this.isRunning ? 'Em execução' : 'Parado'
    };
  }

  /**
   * Retorna status do serviço
   */
  getStatus() {
    return {
      running: this.isRunning,
      check_interval: this.checkIntervalMs,
      statistics: this.getStatistics()
    };
  }

  /**
   * Configura o intervalo de verificação
   */
  setCheckInterval(intervalMs) {
    if (intervalMs < 10000) { // Mínimo 10 segundos
      throw new Error('Intervalo mínimo é 10 segundos');
    }

    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.checkIntervalMs = intervalMs;
    console.log(`⚙️ [DP-STATUS] Intervalo de verificação alterado para ${intervalMs / 1000}s`);

    if (wasRunning) {
      this.start();
    }
  }
}

module.exports = DPStatusMonitoringService;