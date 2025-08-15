const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const dpSchedulerService = require('../services/dpSchedulerService');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

/**
 * Obtém estatísticas do serviço de busca de DP
 */
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const stats = await dpSchedulerService.getStats();
    
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Erro ao obter estatísticas do DP Scheduler:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Força uma tentativa de busca para um agendamento específico
 */
router.post('/retry/:scheduleId', requireAdmin, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    // Buscar dados do agendamento
    const { executeCheckinQuery } = require('../config/database');
    const schedules = await executeCheckinQuery(
      'SELECT * FROM schedule_list WHERE id = ?',
      [scheduleId]
    );

    if (schedules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agendamento não encontrado'
      });
    }

    const schedule = schedules[0];
    
    // Agendar nova busca
    await dpSchedulerService.scheduleDP(schedule);
    
    res.json({
      success: true,
      message: `Busca de DP reagendada para agendamento ${scheduleId}`,
      scheduleId
    });
    
  } catch (error) {
    console.error('Erro ao reagendar busca de DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Lista jobs de busca de DP ativos (apenas em memória)
 */
router.get('/jobs', requireAdmin, async (req, res) => {
  try {
    const activeJobs = [];
    
    // Converter Map para Array para exibição
    for (const [scheduleId, job] of dpSchedulerService.activeJobs) {
      activeJobs.push({
        schedule_id: scheduleId,
        schedule_number: job.scheduleNumber,
        client_cnpj: job.clientCnpj,
        next_attempt_at: job.nextAttemptAt,
        attempt_count: job.attemptCount,
        max_attempts: job.maxAttempts,
        status: 'pending'
      });
    }
    
    res.json({
      success: true,
      data: {
        jobs: activeJobs,
        total_active: activeJobs.length,
        note: 'Jobs são mantidos apenas em memória. Dados não são persistidos em tabela.'
      }
    });
    
  } catch (error) {
    console.error('Erro ao listar jobs de busca de DP:', error);
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
    service: 'DP Scheduler Service',
    description: 'Serviço de busca automática de números de DP',
    config: {
      first_attempt_delay: '5 minutos após criação',
      retry_interval: '5 minutos',
      max_attempts: 10,
      check_interval: '30 segundos'
    },
    endpoints: {
      stats: 'GET /dp-scheduler/stats - Estatísticas do serviço',
      retry: 'POST /dp-scheduler/retry/:scheduleId - Reagendar busca',
      jobs: 'GET /dp-scheduler/jobs - Listar jobs de busca',
      info: 'GET /dp-scheduler/info - Informações do serviço'
    }
  });
});

module.exports = router;