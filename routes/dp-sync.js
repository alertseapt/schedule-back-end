const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const dpSyncService = require('../services/dpSyncService');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * Obtém estatísticas do serviço de sincronização de DP
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await dpSyncService.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas do DP Sync Service:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Inicia o serviço de sincronização de DP
 */
router.post('/start', requireAdmin, async (req, res) => {
  try {
    dpSyncService.start();
    
    res.json({
      success: true,
      message: 'Serviço de sincronização de DP iniciado',
      service_running: dpSyncService.isRunning
    });
    
  } catch (error) {
    console.error('Erro ao iniciar DP Sync Service:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao iniciar serviço',
      error: error.message
    });
  }
});

/**
 * Para o serviço de sincronização de DP
 */
router.post('/stop', requireAdmin, async (req, res) => {
  try {
    dpSyncService.stop();
    
    res.json({
      success: true,
      message: 'Serviço de sincronização de DP parado',
      service_running: dpSyncService.isRunning
    });
    
  } catch (error) {
    console.error('Erro ao parar DP Sync Service:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao parar serviço',
      error: error.message
    });
  }
});

/**
 * Força uma sincronização imediata
 */
router.post('/sync-now', requireAdmin, async (req, res) => {
  try {
    // Executa um ciclo de sincronização imediatamente
    await dpSyncService.syncDPNumbers();
    
    const stats = await dpSyncService.getStats();
    
    res.json({
      success: true,
      message: 'Sincronização executada com sucesso',
      stats: stats
    });
    
  } catch (error) {
    console.error('Erro ao executar sincronização:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao executar sincronização',
      error: error.message
    });
  }
});

/**
 * Força sincronização para um agendamento específico
 */
router.post('/sync/:scheduleId', requireAdmin, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    if (!scheduleId || isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do agendamento inválido'
      });
    }
    
    const result = await dpSyncService.forceSyncSchedule(parseInt(scheduleId));
    
    res.json({
      success: result.success,
      message: result.message,
      schedule_id: result.schedule_id
    });
    
  } catch (error) {
    console.error('Erro ao sincronizar agendamento específico:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Lista agendamentos em conferência (para debug/monitoramento)
 */
router.get('/pending', requireAdmin, async (req, res) => {
  try {
    const allSchedules = await dpSyncService.getSchedulesInConference();
    const schedulesWithoutDP = allSchedules.filter(s => !s.no_dp || s.no_dp == '0' || s.no_dp === 0);
    const schedulesWithDP = allSchedules.filter(s => s.no_dp && s.no_dp != '0' && s.no_dp !== 0);
    
    res.json({
      success: true,
      data: {
        summary: {
          total_in_conference: allSchedules.length,
          without_dp: schedulesWithoutDP.length,
          with_dp: schedulesWithDP.length
        },
        schedules_without_dp: schedulesWithoutDP.slice(0, 25),
        schedules_with_dp: schedulesWithDP.slice(0, 25),
        note: 'Mostrando máximo 25 registros por categoria'
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao listar agendamentos em conferência:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Informações sobre o serviço
 */
router.get('/info', (req, res) => {
  res.json({
    success: true,
    service: 'DP Sync Service',
    description: 'Serviço de sincronização automática de números de DP entre tabelas schedule_list e wtr',
    algorithm: {
      step1: 'Busca agendamentos com status "Em conferência"',
      step2: 'Separa em dois grupos: no_dp = 0 e no_dp != 0',
      step3a: 'Grupo no_dp = 0: busca DP na tabela wtr usando número da NF',
      step3b: 'Filtra por CNPJ (remove máscara) ou aceita CNPJ NULL como válido',
      step3c: 'Filtra por data de integração (apenas dia/mês/ano)',
      step3d: 'Atualiza agendamento se houver apenas um match válido',
      step4a: 'Grupo no_dp != 0: verifica situação na tabela wtr usando no_dp existente',
      step4b: 'Se situação = "Fechado", altera status para "Em estoque"',
      step5: 'Todas alterações são registradas no histórico com usuário "Sistema"'
    },
    config: {
      check_interval: '1 minuto',
      cnpj_validation: 'Remove pontos, traços e barras antes da comparação. CNPJ NULL é considerado match válido',
      date_validation: 'Compara apenas dia, mês e ano (ignora hora)',
      status_automation: 'Altera automaticamente status para "Em estoque" quando situação WTR = "Fechado"',
      historic_tracking: 'Adiciona entradas no histórico com usuário "Sistema" para alterações automáticas',
      integration_datetime: 'Coluna "integration" é automaticamente preenchida quando status muda para "Em conferência"',
      loop_behavior: 'Executa continuamente processando agendamentos "Em conferência"',
      target_status: 'Processa apenas agendamentos com status "Em conferência"'
    },
    endpoints: {
      stats: 'GET /dp-sync/stats - Estatísticas do serviço',
      start: 'POST /dp-sync/start - Iniciar serviço',
      stop: 'POST /dp-sync/stop - Parar serviço',
      sync_now: 'POST /dp-sync/sync-now - Forçar sincronização imediata',
      sync_specific: 'POST /dp-sync/sync/:scheduleId - Sincronizar agendamento específico',
      pending: 'GET /dp-sync/pending - Listar agendamentos em conferência',
      info: 'GET /dp-sync/info - Informações do serviço'
    }
  });
});

module.exports = router;