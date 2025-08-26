const { executeCheckinQuery, executeMercocampQuery } = require('../config/database');

/**
 * Serviço de Sincronização de Números de DP
 * 
 * Este serviço sincroniza números de DP entre as tabelas schedule_list e wtr
 * seguindo as seguintes regras:
 * 1. Busca agendamentos com no_dp = 0
 * 2. Para cada agendamento, busca na tabela wtr usando o número da NF
 * 3. Filtra por CNPJ correspondente (removendo máscara)
 * 4. Filtra por data de integração correspondente
 * 5. Atualiza o agendamento se encontrar apenas um match válido
 */
class DPSyncService {
  constructor() {
    this.isRunning = false;
    this.intervalRef = null;
    this.checkInterval = 60 * 1000; // Check a cada 1 minuto
  }

  /**
   * Inicia o serviço de sincronização
   */
  start() {
    if (this.isRunning) {
      console.log('⚠️ DPSyncService já está em execução');
      return;
    }

    console.log('🚀 Iniciando DPSyncService para sincronização de números de DP...');
    this.isRunning = true;
    
    // Iniciar verificação periódica
    this.intervalRef = setInterval(() => {
      this.syncDPNumbers();
    }, this.checkInterval);

    // Executar uma vez imediatamente
    this.syncDPNumbers();
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
    console.log('🛑 DPSyncService parado');
  }

  /**
   * Busca agendamentos com status 'Em conferência' ou 'Conferência'
   */
  async getSchedulesInConference() {
    try {
      const query = `
        SELECT id, number, client, integration, no_dp, status
        FROM schedule_list 
        WHERE status IN ('Em conferência', 'Conferência')
        ORDER BY integration ASC
      `;
      
      const schedules = await executeCheckinQuery(query);
      console.log(`📋 Encontrados ${schedules.length} agendamentos em conferência`);
      
      return schedules;
    } catch (error) {
      console.error('❌ Erro ao buscar agendamentos em conferência:', error);
      return [];
    }
  }

  /**
   * Busca agendamentos com no_dp = 0 (mantida para compatibilidade)
   */
  async getSchedulesWithoutDP() {
    try {
      const query = `
        SELECT id, number, client, integration, no_dp, status
        FROM schedule_list 
        WHERE no_dp = 0 OR no_dp IS NULL
        ORDER BY integration ASC
      `;
      
      const schedules = await executeCheckinQuery(query);
      console.log(`📋 Encontrados ${schedules.length} agendamentos sem no_dp`);
      
      return schedules;
    } catch (error) {
      console.error('❌ Erro ao buscar agendamentos sem DP:', error);
      return [];
    }
  }

  /**
   * Busca registros na tabela wtr usando número do DP
   */
  async searchWTRByDP(dpNumber) {
    try {
      const query = `
        SELECT no_dp, situacao
        FROM wtr 
        WHERE no_dp = ?
        LIMIT 1
      `;
      
      const results = await executeMercocampQuery(query, [dpNumber]);
      console.log(`🔍 Verificando situação do DP ${dpNumber}: ${results.length ? results[0].situacao : 'não encontrado'}`);
      
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error(`❌ Erro ao buscar situação do DP ${dpNumber}:`, error);
      return null;
    }
  }

  /**
   * Busca registros na tabela wtr usando número da NF
   * Considera que no_nf pode conter múltiplas NFs separadas por vírgula
   */
  async searchWTRByNF(nfNumber) {
    try {
      const query = `
        SELECT no_dp, no_nf, cnpj, dt_inclusao, situacao
        FROM wtr 
        WHERE (
          no_nf = ? OR 
          no_nf LIKE ? OR 
          no_nf LIKE ? OR 
          no_nf LIKE ?
        )
        AND no_dp IS NOT NULL 
        AND no_dp != '' 
        AND no_dp != '0'
      `;
      
      // Padrões para busca:
      // 1. NF exata: '221616'
      // 2. NF no início: '221616, 221686'
      // 3. NF no meio: '221615, 221616, 221686'  
      // 4. NF no final: '221615, 221616'
      const patterns = [
        nfNumber,                    // Exata
        `${nfNumber},%`,            // Início (seguida de vírgula)
        `%, ${nfNumber},%`,         // Meio (precedida e seguida de vírgula com espaço)
        `%, ${nfNumber}`            // Final (precedida de vírgula com espaço)
      ];
      
      const results = await executeMercocampQuery(query, patterns);
      
      // Filtrar resultados para garantir match exato (evitar falsos positivos)
      const filteredResults = results.filter(record => {
        if (!record.no_nf) return false;
        
        // Separar as NFs por vírgula e limpar espaços
        const nfs = record.no_nf.toString().split(',').map(nf => nf.trim());
        
        // Verificar se nossa NF está na lista
        return nfs.includes(nfNumber.toString());
      });
      
      console.log(`🔍 Encontrados ${filteredResults.length} registros WTR para NF ${nfNumber}`);
      if (results.length > filteredResults.length) {
        console.log(`   ⚡ Filtrados ${results.length - filteredResults.length} falsos positivos`);
      }
      
      // Log detalhado dos registros encontrados
      filteredResults.forEach((record, index) => {
        const nfList = record.no_nf.toString().split(',').map(nf => nf.trim()).join(', ');
        console.log(`   ${index + 1}. DP: ${record.no_dp}, NFs: [${nfList}], CNPJ: ${record.cnpj || 'NULL'}`);
      });
      
      return filteredResults;
    } catch (error) {
      console.error(`❌ Erro ao buscar na tabela WTR para NF ${nfNumber}:`, error);
      return [];
    }
  }

  /**
   * Remove máscara do CNPJ deixando apenas números
   */
  removeCNPJMask(cnpj) {
    if (!cnpj) return '';
    return cnpj.replace(/[^0-9]/g, '');
  }

  /**
   * Filtra registros WTR por CNPJ correspondente ou NULL
   */
  filterByCNPJ(wtrRecords, scheduleCNPJ) {
    const cleanScheduleCNPJ = this.removeCNPJMask(scheduleCNPJ);
    
    const filtered = wtrRecords.filter(record => {
      // Se CNPJ na WTR for NULL, considerar como match válido
      if (!record.cnpj || record.cnpj === null || record.cnpj === '') {
        return true;
      }
      
      // Caso contrário, comparar os CNPJs
      const cleanWTRCNPJ = this.removeCNPJMask(record.cnpj);
      return cleanWTRCNPJ === cleanScheduleCNPJ;
    });

    const nullCnpjCount = wtrRecords.filter(record => !record.cnpj || record.cnpj === null || record.cnpj === '').length;
    console.log(`🔧 Filtrados ${filtered.length} de ${wtrRecords.length} registros por CNPJ ${cleanScheduleCNPJ}`);
    if (nullCnpjCount > 0) {
      console.log(`   ℹ️ Incluídos ${nullCnpjCount} registros com CNPJ NULL (considerados válidos)`);
    }
    
    return filtered;
  }

  /**
   * Compara datas ignorando hora (apenas dia, mês e ano)
   */
  isSameDate(date1, date2) {
    if (!date1 || !date2) return false;
    
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  /**
   * Filtra registros WTR por data de integração correspondente
   */
  filterByIntegrationDate(wtrRecords, scheduleIntegrationDate) {
    const filtered = wtrRecords.filter(record => {
      return this.isSameDate(record.dt_inclusao, scheduleIntegrationDate);
    });

    const scheduleDate = new Date(scheduleIntegrationDate).toLocaleDateString('pt-BR');
    console.log(`📅 Filtrados ${filtered.length} de ${wtrRecords.length} registros por data de integração ${scheduleDate}`);
    return filtered;
  }

  /**
   * Atualiza o agendamento com o número da DP e verifica se deve alterar status
   */
  async updateScheduleDP(scheduleId, matchedRecord) {
    try {
      const dpNumber = matchedRecord.no_dp;
      const situacao = matchedRecord.situacao;
      
      console.log(`✅ Atualizando agendamento ${scheduleId} com DP: ${dpNumber}, Situação: ${situacao}`);
      
      // Buscar dados atuais do agendamento para histórico
      const currentSchedule = await executeCheckinQuery(
        'SELECT status, historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );
      
      if (currentSchedule.length === 0) {
        throw new Error(`Agendamento ${scheduleId} não encontrado`);
      }
      
      const schedule = currentSchedule[0];
      let newStatus = schedule.status;
      let statusChanged = false;
      
      // Se situação for "Fechado", alterar status para "Em estoque"
      if (situacao && situacao.toLowerCase() === 'fechado') {
        if (schedule.status !== 'Em estoque') {
          newStatus = 'Em estoque';
          statusChanged = true;
          console.log(`🔄 Status será alterado de "${schedule.status}" para "${newStatus}" (situação WTR: ${situacao})`);
        }
      }
      
      // Atualizar agendamento
      if (statusChanged) {
        // Atualizar com novo status
        const query = `
          UPDATE schedule_list 
          SET no_dp = ?, dp_sync_at = NOW(), status = ?, historic = ?
          WHERE id = ?
        `;
        
        // Preparar novo histórico
        const newHistoric = await this.addToHistoric(schedule.historic, {
          action: 'status_change',
          from: schedule.status,
          to: newStatus,
          reason: `DP ${dpNumber} com situação "Fechado" - alteração automática`,
          user: 'Sistema',
          timestamp: new Date().toISOString()
        });
        
        await executeCheckinQuery(query, [dpNumber, newStatus, JSON.stringify(newHistoric), scheduleId]);
        console.log(`✅ Agendamento ${scheduleId} atualizado: DP=${dpNumber}, Status="${newStatus}"`);
        
      } else {
        // Atualizar apenas com DP
        const query = `
          UPDATE schedule_list 
          SET no_dp = ?, dp_sync_at = NOW()
          WHERE id = ?
        `;
        
        await executeCheckinQuery(query, [dpNumber, scheduleId]);
        console.log(`✅ Agendamento ${scheduleId} atualizado com DP: ${dpNumber}`);
      }
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Adiciona entrada ao histórico do agendamento
   */
  async addToHistoric(currentHistoric, newEntry) {
    let historic = [];
    
    try {
      if (currentHistoric) {
        historic = typeof currentHistoric === 'string' ? JSON.parse(currentHistoric) : currentHistoric;
        if (!Array.isArray(historic)) {
          historic = [];
        }
      }
    } catch (error) {
      console.warn('⚠️ Erro ao parsear histórico atual, criando novo:', error.message);
      historic = [];
    }
    
    // Adicionar nova entrada
    historic.push(newEntry);
    
    return historic;
  }

  /**
   * Garante que as colunas necessárias existam na tabela schedule_list
   */
  async ensureColumns() {
    try {
      // Verificar se coluna no_dp existe
      const noDpColumns = await executeCheckinQuery(`
        SHOW COLUMNS FROM schedule_list LIKE 'no_dp'
      `);

      if (noDpColumns.length === 0) {
        console.log('📋 Adicionando coluna no_dp na tabela schedule_list...');
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN no_dp VARCHAR(50) NULL DEFAULT '0' COMMENT 'Número da DP'
        `);
        console.log('✅ Coluna no_dp adicionada');
      }

      // Verificar se coluna dp_sync_at existe
      const dpSyncColumns = await executeCheckinQuery(`
        SHOW COLUMNS FROM schedule_list LIKE 'dp_sync_at'
      `);

      if (dpSyncColumns.length === 0) {
        console.log('📋 Adicionando coluna dp_sync_at na tabela schedule_list...');
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN dp_sync_at DATETIME NULL COMMENT 'Data e hora da sincronização do DP'
        `);
        console.log('✅ Coluna dp_sync_at adicionada');
      }

      // Verificar se coluna integration existe
      const integrationColumns = await executeCheckinQuery(`
        SHOW COLUMNS FROM schedule_list LIKE 'integration'
      `);

      if (integrationColumns.length === 0) {
        console.log('📋 Adicionando coluna integration na tabela schedule_list...');
        await executeCheckinQuery(`
          ALTER TABLE schedule_list 
          ADD COLUMN integration DATETIME NULL COMMENT 'Data e hora de integração (mudança para Em conferência)'
        `);
        console.log('✅ Coluna integration adicionada');
      }

    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('📋 Colunas já existem na tabela schedule_list');
      } else {
        console.error('❌ Erro ao verificar/criar colunas:', error);
      }
    }
  }

  /**
   * Processa um agendamento que já possui no_dp (verifica apenas situação)
   */
  async processScheduleWithDP(schedule) {
    try {
      console.log(`\n🔍 Verificando situação para agendamento ${schedule.id} - DP: ${schedule.no_dp}`);

      // Buscar situação na WTR usando no_dp
      const dpRecord = await this.searchWTRByDP(schedule.no_dp);
      
      if (!dpRecord) {
        console.log(`⏳ DP ${schedule.no_dp} não encontrado na tabela WTR`);
        return false;
      }

      // Verificar se situação é "Fechado" e status atual não é "Em estoque"
      if (dpRecord.situacao && dpRecord.situacao.toLowerCase() === 'fechado') {
        if (schedule.status !== 'Em estoque') {
          console.log(`🔄 DP ${schedule.no_dp} está "Fechado" - alterando status para "Em estoque"`);
          
          // Atualizar apenas o status (DP já existe)
          await this.updateScheduleStatus(schedule.id, 'Em estoque', schedule.status, `DP ${schedule.no_dp} com situação "Fechado"`);
          return true;
        } else {
          console.log(`ℹ️ DP ${schedule.no_dp} já está "Fechado" e agendamento já está "Em estoque"`);
        }
      } else {
        console.log(`ℹ️ DP ${schedule.no_dp} situação: "${dpRecord.situacao}" - sem alteração necessária`);
      }

      return false;
    } catch (error) {
      console.error(`❌ Erro ao processar agendamento com DP ${schedule.id}:`, error);
      return false;
    }
  }

  /**
   * Atualiza apenas o status do agendamento (para casos onde DP já existe)
   */
  async updateScheduleStatus(scheduleId, newStatus, oldStatus, reason) {
    try {
      // Buscar histórico atual
      const currentSchedule = await executeCheckinQuery(
        'SELECT historic FROM schedule_list WHERE id = ?',
        [scheduleId]
      );
      
      if (currentSchedule.length === 0) {
        throw new Error(`Agendamento ${scheduleId} não encontrado`);
      }
      
      // Preparar novo histórico
      const newHistoric = await this.addToHistoric(currentSchedule[0].historic, {
        action: 'status_change',
        from: oldStatus,
        to: newStatus,
        reason: `${reason} - alteração automática`,
        user: 'Sistema',
        timestamp: new Date().toISOString()
      });
      
      // Atualizar apenas status e histórico
      const query = `
        UPDATE schedule_list 
        SET status = ?, historic = ?, dp_sync_at = NOW()
        WHERE id = ?
      `;
      
      await executeCheckinQuery(query, [newStatus, JSON.stringify(newHistoric), scheduleId]);
      console.log(`✅ Agendamento ${scheduleId} status atualizado: "${oldStatus}" → "${newStatus}"`);
      
    } catch (error) {
      console.error(`❌ Erro ao atualizar status do agendamento ${scheduleId}:`, error);
      throw error;
    }
  }

  /**
   * Processa um agendamento individual (busca de DP)
   */
  async processSchedule(schedule) {
    try {
      console.log(`\n🔄 Processando agendamento ${schedule.id} - NF: ${schedule.number}`);

      // 1. Buscar na tabela wtr usando número da NF
      const wtrRecords = await this.searchWTRByNF(schedule.number);
      
      if (wtrRecords.length === 0) {
        console.log(`⏳ Nenhum registro encontrado na WTR para NF ${schedule.number}`);
        return false;
      }

      // 2. Filtrar por CNPJ correspondente
      const cnpjFiltered = this.filterByCNPJ(wtrRecords, schedule.client);
      
      if (cnpjFiltered.length === 0) {
        console.log(`⏳ Nenhum registro com CNPJ correspondente para agendamento ${schedule.id}`);
        return false;
      }

      // 3. Filtrar por data de integração
      const dateFiltered = this.filterByIntegrationDate(cnpjFiltered, schedule.integration);
      
      if (dateFiltered.length === 0) {
        console.log(`⏳ Nenhum registro com data de integração correspondente para agendamento ${schedule.id}`);
        return false;
      }

      // 4. Verificar resultado final
      if (dateFiltered.length > 1) {
        console.log(`⚠️ ALERTA: Múltiplos registros encontrados para agendamento ${schedule.id}:`);
        dateFiltered.forEach((record, index) => {
          console.log(`   ${index + 1}. DP: ${record.no_dp}, CNPJ: ${record.cnpj}, Data: ${new Date(record.dt_inclusao).toLocaleDateString('pt-BR')}`);
        });
        return false;
      }

      if (dateFiltered.length === 1) {
        const matchedRecord = dateFiltered[0];
        console.log(`✅ Match único encontrado para agendamento ${schedule.id} - DP: ${matchedRecord.no_dp}`);
        
        // 5. Atualizar agendamento
        await this.updateScheduleDP(schedule.id, matchedRecord);
        return true;
      }

    } catch (error) {
      console.error(`❌ Erro ao processar agendamento ${schedule.id}:`, error);
      return false;
    }
  }

  /**
   * Executa o ciclo principal de sincronização
   */
  async syncDPNumbers() {
    try {
      console.log('\n🔄 Iniciando ciclo de sincronização de números de DP...');

      // Garantir que colunas existam
      await this.ensureColumns();

      // 1. Buscar todos os agendamentos em conferência
      const allSchedules = await this.getSchedulesInConference();
      
      if (allSchedules.length === 0) {
        console.log('✅ Nenhum agendamento em conferência encontrado');
        return;
      }

      // 2. Separar em dois grupos
      const schedulesWithoutDP = allSchedules.filter(s => !s.no_dp || s.no_dp == '0' || s.no_dp === 0);
      const schedulesWithDP = allSchedules.filter(s => s.no_dp && s.no_dp != '0' && s.no_dp !== 0);

      console.log(`📊 Agendamentos encontrados:`);
      console.log(`   - Total em conferência: ${allSchedules.length}`);
      console.log(`   - Sem DP (no_dp = 0): ${schedulesWithoutDP.length}`);
      console.log(`   - Com DP (no_dp != 0): ${schedulesWithDP.length}`);

      let processedCount = 0;
      let updatedCount = 0;

      // 3. Processar agendamentos sem DP (busca e sincronização)
      if (schedulesWithoutDP.length > 0) {
        console.log(`\n📋 Processando ${schedulesWithoutDP.length} agendamentos sem DP...`);
        
        for (const schedule of schedulesWithoutDP) {
          const updated = await this.processSchedule(schedule);
          processedCount++;
          
          if (updated) {
            updatedCount++;
          }
        }
      }

      // 4. Processar agendamentos com DP (verificação de situação)
      if (schedulesWithDP.length > 0) {
        console.log(`\n🔍 Verificando situação de ${schedulesWithDP.length} agendamentos com DP...`);
        
        for (const schedule of schedulesWithDP) {
          const updated = await this.processScheduleWithDP(schedule);
          processedCount++;
          
          if (updated) {
            updatedCount++;
          }
        }
      }

      console.log(`\n📊 Ciclo de sincronização concluído:`);
      console.log(`   - Agendamentos processados: ${processedCount}`);
      console.log(`   - Agendamentos atualizados: ${updatedCount}`);
      console.log(`   - Agendamentos sem alteração: ${processedCount - updatedCount}`);

    } catch (error) {
      console.error('❌ Erro no ciclo de sincronização de DP:', error);
    }
  }

  /**
   * Retorna estatísticas do serviço
   */
  async getStats() {
    try {
      // Contar agendamentos em conferência
      const inConferenceResult = await executeCheckinQuery(`
        SELECT COUNT(*) as count
        FROM schedule_list 
        WHERE status IN ('Em conferência', 'Conferência')
      `);

      // Contar agendamentos em conferência sem DP
      const withoutDPResult = await executeCheckinQuery(`
        SELECT COUNT(*) as count
        FROM schedule_list 
        WHERE status IN ('Em conferência', 'Conferência') AND (no_dp = 0 OR no_dp IS NULL)
      `);

      // Contar agendamentos em conferência com DP
      const withDPResult = await executeCheckinQuery(`
        SELECT COUNT(*) as count
        FROM schedule_list 
        WHERE status IN ('Em conferência', 'Conferência') AND no_dp IS NOT NULL AND no_dp != '0'
      `);

      // Contar agendamentos em estoque
      const inStockResult = await executeCheckinQuery(`
        SELECT COUNT(*) as count
        FROM schedule_list 
        WHERE status = 'Em estoque'
      `);

      return {
        service_running: this.isRunning,
        check_interval_ms: this.checkInterval,
        schedules_in_conference: inConferenceResult[0].count,
        schedules_without_dp: withoutDPResult[0].count,
        schedules_with_dp: withDPResult[0].count,
        schedules_in_stock: inStockResult[0].count,
        last_check: new Date().toISOString()
      };
    } catch (error) {
      console.error('❌ Erro ao obter estatísticas:', error);
      return {
        service_running: this.isRunning,
        error: error.message
      };
    }
  }

  /**
   * Força sincronização para um agendamento específico
   */
  async forceSyncSchedule(scheduleId) {
    try {
      // Buscar dados do agendamento
      const schedules = await executeCheckinQuery(`
        SELECT id, number, client, integration
        FROM schedule_list 
        WHERE id = ?
      `, [scheduleId]);

      if (schedules.length === 0) {
        throw new Error(`Agendamento ${scheduleId} não encontrado`);
      }

      const schedule = schedules[0];
      console.log(`🔄 Forçando sincronização para agendamento ${scheduleId}`);
      
      const updated = await this.processSchedule(schedule);
      
      return {
        success: updated,
        schedule_id: scheduleId,
        message: updated ? 'DP sincronizado com sucesso' : 'Nenhum match encontrado para sincronização'
      };
    } catch (error) {
      console.error(`❌ Erro ao forçar sincronização do agendamento ${scheduleId}:`, error);
      throw error;
    }
  }
}

// Instância única do serviço
const dpSyncService = new DPSyncService();

module.exports = dpSyncService;