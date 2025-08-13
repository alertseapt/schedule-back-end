const express = require('express');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const dpVerificationService = require('../services/dpVerificationService');

const router = express.Router();

// Todas as rotas requerem autenticação de admin
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * Inicia o serviço de verificação de DP
 */
router.post('/start', async (req, res) => {
  try {
    dpVerificationService.start();
    
    res.json({
      success: true,
      message: 'Serviço de verificação de DP iniciado com sucesso',
      status: dpVerificationService.getStatus()
    });
  } catch (error) {
    console.error('Erro ao iniciar serviço de verificação de DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Para o serviço de verificação de DP
 */
router.post('/stop', async (req, res) => {
  try {
    dpVerificationService.stop();
    
    res.json({
      success: true,
      message: 'Serviço de verificação de DP parado com sucesso',
      status: dpVerificationService.getStatus()
    });
  } catch (error) {
    console.error('Erro ao parar serviço de verificação de DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Obtém o status do serviço de verificação de DP
 */
router.get('/status', async (req, res) => {
  try {
    const status = dpVerificationService.getStatus();
    
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
 * Força verificação manual de um agendamento específico
 */
router.post('/verify/:scheduleId', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    
    if (!scheduleId || isNaN(scheduleId)) {
      return res.status(400).json({
        success: false,
        message: 'ID do agendamento inválido'
      });
    }

    const result = await dpVerificationService.forceVerification(parseInt(scheduleId));
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        dpNumber: result.dpNumber,
        scheduleId: parseInt(scheduleId)
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message,
        scheduleId: parseInt(scheduleId)
      });
    }
  } catch (error) {
    console.error('Erro na verificação manual:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: error.message
    });
  }
});

/**
 * Executa uma verificação completa manual (sem esperar o intervalo)
 */
router.post('/run-verification', async (req, res) => {
  try {
    // Executar verificação de forma assíncrona para não bloquear a resposta
    dpVerificationService.runVerification().then(() => {
      console.log('✅ Verificação manual completa executada');
    }).catch(error => {
      console.error('❌ Erro na verificação manual completa:', error);
    });
    
    res.json({
      success: true,
      message: 'Verificação manual iniciada. Verifique os logs para acompanhar o progresso.',
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
 * Busca DP com triangulação rigorosa (CNPJ + NF + Data de inclusão)
 */
router.get('/search-dp-triangulation', async (req, res) => {
  try {
    const { nf_number, client_cnpj, schedule_id } = req.query;
    
    if (!nf_number || !client_cnpj || !schedule_id) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros nf_number, client_cnpj e schedule_id são obrigatórios para triangulação',
        required_params: ['nf_number', 'client_cnpj', 'schedule_id']
      });
    }

    // Usar serviço de triangulação rigorosa
    const DPVerificationServiceWithDate = require('../services/dpVerificationServiceWithDate');
    const dpService = new DPVerificationServiceWithDate();
    
    console.log(`🔍 [API-TRIANGULATION] Buscando DP com triangulação rigorosa`);
    console.log(`   NF: ${nf_number}, CNPJ: ${client_cnpj}, Schedule ID: ${schedule_id}`);
    
    const dpResult = await dpService.getDPFromWtrTableWithTriangulation(
      nf_number, 
      client_cnpj, 
      parseInt(schedule_id)
    );
    
    if (dpResult && dpResult.triangulation_complete) {
      console.log(`✅ [API-TRIANGULATION] DP encontrado com triangulação válida: ${dpResult.dp_number}`);
      
      res.json({
        success: true,
        message: 'DP encontrado com triangulação válida (CNPJ + NF + Data)',
        no_dp: dpResult.dp_number,
        nf_number,
        client_cnpj,
        schedule_id: parseInt(schedule_id),
        triangulation_complete: true,
        date_validated: dpResult.date_validated,
        date_match: dpResult.date_match,
        strategy_used: dpResult.strategy_used,
        found_at: dpResult.found_at,
        details: {
          cnpj_in_record: dpResult.cnpj,
          client_in_record: dpResult.client_number,
          nf_in_record: dpResult.nf_number,
          dt_inclusao: dpResult.dt_inclusao,
          situacao: dpResult.situacao
        }
      });
    } else {
      console.log(`❌ [API-TRIANGULATION] Triangulação falhou - NF: ${nf_number}, CNPJ: ${client_cnpj}`);
      
      res.status(404).json({
        success: false,
        message: 'DP não encontrado - triangulação falhou',
        reason: 'Sem correspondência exata de CNPJ + NF + Data de inclusão',
        nf_number,
        client_cnpj,
        schedule_id: parseInt(schedule_id),
        triangulation_complete: false,
        suggestions: [
          'Verifique se a data de alteração para "Agendado" está no histórico',
          'Confirme se o CNPJ está correto',
          'Verifique se a NF está correta',
          'Confirme se existe registro na tabela WTR com data de inclusão correspondente'
        ]
      });
    }
  } catch (error) {
    console.error('❌ [API-TRIANGULATION] Erro na triangulação:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno na triangulação de DP',
      error: error.message
    });
  }
});

/**
 * Busca DP diretamente na tabela wtr por NF e cliente (OTIMIZADO)
 */
router.get('/search-dp', async (req, res) => {
  try {
    const { nf_number, client_cnpj, client_number } = req.query;
    
    if (!nf_number || !client_cnpj) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros nf_number e client_cnpj são obrigatórios'
      });
    }

    // Usar serviço otimizado para buscar na tabela WTR
    const DPVerificationServiceOptimized = require('../services/dpVerificationServiceOptimized');
    const dpService = new DPVerificationServiceOptimized();
    
    console.log(`🔍 [API-SEARCH] Buscando DP - NF: ${nf_number}, CNPJ: ${client_cnpj}`);
    
    const dpResult = await dpService.getDPFromWtrTableOptimized(
      nf_number, 
      client_cnpj, 
      client_number || null
    );
    
    if (dpResult) {
      console.log(`✅ [API-SEARCH] DP encontrado: ${dpResult.dp_number} (${dpResult.strategy_used})`);
      
      res.json({
        success: true,
        message: 'DP encontrado na tabela WTR',
        no_dp: dpResult.dp_number,
        nf_number,
        client_cnpj,
        strategy_used: dpResult.strategy_used,
        found_at: dpResult.found_at,
        details: {
          cnpj_in_record: dpResult.cnpj,
          client_in_record: dpResult.client_number,
          nf_in_record: dpResult.nf_number
        }
      });
    } else {
      console.log(`❌ [API-SEARCH] DP não encontrado - NF: ${nf_number}, CNPJ: ${client_cnpj}`);
      
      res.status(404).json({
        success: false,
        message: 'DP não encontrado na tabela WTR para os parâmetros fornecidos',
        nf_number,
        client_cnpj,
        suggestions: [
          'Verifique se a NF está correta',
          'Verifique se o CNPJ está formatado corretamente',
          'Tente adicionar o parâmetro client_number para fallback'
        ]
      });
    }
  } catch (error) {
    console.error('Erro na busca de DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno na busca de DP',
      error: error.message
    });
  }
});

/**
 * Testa a funcionalidade de triangulação com dados de exemplo
 */
router.post('/test-triangulation', async (req, res) => {
  try {
    const { nf_number, client_cnpj, schedule_id, test_mode = false } = req.body;
    
    if (!nf_number || !client_cnpj) {
      return res.status(400).json({
        success: false,
        message: 'Parâmetros nf_number e client_cnpj são obrigatórios para teste',
        required_params: ['nf_number', 'client_cnpj']
      });
    }

    console.log(`🧪 [TEST-TRIANGULATION] Iniciando teste de triangulação`);
    console.log(`   NF: ${nf_number}, CNPJ: ${client_cnpj}, Schedule ID: ${schedule_id || 'N/A'}`);
    console.log(`   Modo teste: ${test_mode}`);

    const DPVerificationServiceWithDate = require('../services/dpVerificationServiceWithDate');
    const dpService = new DPVerificationServiceWithDate();
    
    let testResults = {
      triangulation_test: null,
      validation_test: null,
      statistics: null
    };

    // Teste 1: Triangulação rigorosa
    if (schedule_id) {
      console.log(`🔍 [TEST] Testando triangulação rigorosa...`);
      testResults.triangulation_test = await dpService.getDPFromWtrTableWithTriangulation(
        nf_number, 
        client_cnpj, 
        parseInt(schedule_id)
      );
    }

    // Teste 2: Validação de estrutura WTR
    console.log(`🔍 [TEST] Validando estrutura da tabela WTR...`);
    testResults.validation_test = await dpService.validateWTRStructure();

    // Teste 3: Estatísticas
    testResults.statistics = dpService.getStatistics();

    const hasValidTriangulation = testResults.triangulation_test && testResults.triangulation_test.triangulation_complete;
    
    res.json({
      success: true,
      message: 'Teste de triangulação concluído',
      test_params: {
        nf_number,
        client_cnpj,
        schedule_id: schedule_id ? parseInt(schedule_id) : null,
        test_mode
      },
      results: {
        triangulation: {
          success: hasValidTriangulation,
          data: testResults.triangulation_test,
          message: hasValidTriangulation 
            ? `DP ${testResults.triangulation_test.dp_number} encontrado com triangulação válida`
            : 'Triangulação falhou - sem correspondência exata de CNPJ + NF + Data'
        },
        wtr_structure: testResults.validation_test,
        service_statistics: testResults.statistics
      },
      recommendations: hasValidTriangulation 
        ? [
            'Triangulação funcionando corretamente',
            'Todos os três critérios foram atendidos: CNPJ + NF + Data',
            'DP pode ser capturado com segurança'
          ]
        : [
            'Triangulação não encontrou correspondência válida',
            'Verifique se os dados estão corretos',
            'Confirme se existe registro na WTR com data correspondente',
            schedule_id ? 'Data de alteração para "Agendado" encontrada no histórico' : 'Forneça schedule_id para validação completa'
          ]
    });

  } catch (error) {
    console.error('❌ [TEST-TRIANGULATION] Erro no teste:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno no teste de triangulação',
      error: error.message
    });
  }
});

/**
 * Lista agendamentos que ainda não têm DP atribuído
 */
router.get('/schedules-without-dp', async (req, res) => {
  try {
    const schedules = await dpVerificationService.getSchedulesWithoutDP();
    
    res.json({
      success: true,
      message: `${schedules.length} agendamentos sem DP encontrados`,
      data: schedules,
      total: schedules.length
    });
  } catch (error) {
    console.error('Erro ao listar agendamentos sem DP:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar agendamentos sem DP',
      error: error.message
    });
  }
});

module.exports = router;