const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const DPStatusMonitoringService = require('../services/dpStatusMonitoringService');

const router = express.Router();

// Instância única do serviço
const dpStatusService = new DPStatusMonitoringService();

// Todas as rotas requerem autenticação de admin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Inicia o serviço de monitoramento de status DP
 */
router.post('/start', async (req, res) => {
  try {
    dpStatusService.start();
    
    res.json({
      success: true,
      message: 'Serviço de monitoramento de status DP iniciado com sucesso',
      status: dpStatusService.getStatus()
    });
  } catch (error) {
    console.error('Erro ao iniciar serviço de monitoramento de status DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Para o serviço de monitoramento de status DP
 */
router.post('/stop', async (req, res) => {
  try {
    dpStatusService.stop();
    
    res.json({
      success: true,
      message: 'Serviço de monitoramento de status DP parado com sucesso',
      status: dpStatusService.getStatus()
    });
  } catch (error) {
    console.error('Erro ao parar serviço de monitoramento de status DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Obtém o status do serviço de monitoramento
 */
router.get('/status', async (req, res) => {
  try {
    const status = dpStatusService.getStatus();
    
    res.json({
      success: true,
      status: status
    });
  } catch (error) {
    console.error('Erro ao obter status do serviço:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Executa verificação manual completa
 */
router.post('/check-now', async (req, res) => {
  try {
    // Executar verificação de forma assíncrona para não bloquear a resposta
    dpStatusService.checkDPStatus().then(() => {
      console.log('✅ Verificação manual de status DP executada');
    }).catch(error => {
      console.error('❌ Erro na verificação manual de status DP:', error);
    });
    
    res.json({
      success: true,
      message: 'Verificação manual de status DP iniciada. Verifique os logs para acompanhar o progresso.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao executar verificação manual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Força verificação de um agendamento específico
 */
router.post('/check-schedule/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    if (!scheduleId || isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do agendamento inválido'
      });
    }

    const result = await dpStatusService.forceCheckSchedule(parseInt(scheduleId));
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          schedule_id: parseInt(scheduleId),
          dp_number: result.dp_number,
          previous_status: result.previous_status,
          new_status: result.new_status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message,
        data: {
          schedule_id: parseInt(scheduleId),
          dp_number: result.dp_number
        }
      });
    }
  } catch (error) {
    console.error('Erro na verificação manual de agendamento:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Obtém estatísticas do serviço
 */
router.get('/statistics', async (req, res) => {
  try {
    const statistics = dpStatusService.getStatistics();
    
    res.json({
      success: true,
      message: 'Estatísticas do serviço de monitoramento de status DP',
      data: statistics
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Configura o intervalo de verificação
 */
router.put('/interval', async (req, res) => {
  try {
    const { interval_seconds } = req.body;
    
    if (!interval_seconds || isNaN(interval_seconds) || interval_seconds < 10) {
      return res.status(400).json({
        success: false,
        message: 'Intervalo deve ser um número maior ou igual a 10 segundos'
      });
    }

    const intervalMs = interval_seconds * 1000;
    dpStatusService.setCheckInterval(intervalMs);
    
    res.json({
      success: true,
      message: `Intervalo de verificação alterado para ${interval_seconds} segundos`,
      new_interval: interval_seconds,
      status: dpStatusService.getStatus()
    });
  } catch (error) {
    console.error('Erro ao alterar intervalo:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Lista agendamentos candidatos para atualização
 */
router.get('/candidates', async (req, res) => {
  try {
    const candidates = await dpStatusService.getSchedulesForStatusCheck();
    
    res.json({
      success: true,
      message: `${candidates.length} agendamentos candidatos para verificação encontrados`,
      data: candidates.map(schedule => ({
        id: schedule.id,
        status: schedule.status,
        no_dp: schedule.no_dp,
        number: schedule.number,
        client: schedule.client
      })),
      total: candidates.length
    });
  } catch (error) {
    console.error('Erro ao listar candidatos:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agendamentos candidatos',
      error: error.message
    });
  }
});

module.exports = router;