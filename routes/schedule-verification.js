const express = require('express');
const { executeCheckinQuery, executeMercocampQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { triggerProductsIntegration, triggerNfEntryIntegration } = require('./corpem');
const Joi = require('joi');

const router = express.Router();


// Schema de validação para busca
const searchSchema = Joi.object({
  input: Joi.string().required().min(1)
});

// Schema de validação para alteração de status
const changeStatusSchema = Joi.object({
  scheduleId: Joi.number().integer().positive().required(),
  newStatus: Joi.string().required().min(1).max(50),
  comment: Joi.string().optional().max(500)
});

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Função para processar chave de NFe (44+ dígitos)
const processNfeKey = (input) => {
  // Remove espaços e letras, mantém apenas números
  const cleanedInput = input.replace(/[^\d]/g, '');
  return cleanedInput;
};

// Função para buscar informações do cliente na tabela wcl do banco dbmercocamp
const getClientInfoFromWcl = async (cnpj) => {
  try {
    // Remover formatação do CNPJ para busca
    const cleanCnpj = cnpj.replace(/[^\d]/g, '');
    
    // Buscar na tabela wcl usando CNPJ limpo ou formatado
    const results = await executeMercocampQuery(
      'SELECT nome_cliente, no_seq, cnpj_cpf FROM wcl WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, ".", ""), "/", ""), "-", ""), " ", "") = ? OR cnpj_cpf = ?',
      [cleanCnpj, cnpj]
    );
    
    if (results.length > 0) {
      return {
        name: results[0].nome_cliente,
        number: results[0].no_seq,
        cnpj: results[0].cnpj_cpf
      };
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar informações do cliente na tabela wcl:', error);
    return null;
  }
};

// Rota para buscar agendamento
router.post('/search', async (req, res) => {
  try {
    // Validar input
    const { error, value } = searchSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.details[0].message
      });
    }

    const { input } = value;
    
    console.log(`🔍 Busca iniciada por usuário: ${req.user.user} (Nível: ${req.user.level_access})`);
    let searchQuery;
    let searchParam;

    // Verificar se input tem 44 ou mais dígitos
    if (input.length >= 44) {
      // Processar chave NFe - remover espaços e letras
      const processedKey = processNfeKey(input);
      
      if (processedKey.length < 44) {
        return res.status(400).json({
          error: 'Chave de NFe inválida. Após processamento deve ter pelo menos 44 dígitos.'
        });
      }

      searchQuery = 'SELECT * FROM schedule_list WHERE nfe_key = ?';
      searchParam = processedKey;
    } else {
      // Buscar por número da NFe
      searchQuery = 'SELECT * FROM schedule_list WHERE number = ?';
      searchParam = input;
    }

    // Executar busca no banco
    console.log(`🔍 Executando busca - Query: ${searchQuery}, Param: ${searchParam}`);
    const results = await executeCheckinQuery(searchQuery, [searchParam]);
    console.log(`📊 Encontrados ${results.length} agendamentos na busca inicial`);

    // Buscar informações do cliente para cada resultado
    const enrichedResults = await Promise.all(
      results.map(async (schedule) => {
        const info = typeof schedule.info === 'string' ? JSON.parse(schedule.info) : schedule.info;
        
        // Buscar informações do cliente na tabela wcl usando o CNPJ da coluna 'client'
        const clientInfo = await getClientInfoFromWcl(schedule.client);
        
        return {
          id: schedule.id,
          number: schedule.number,
          nfe_key: schedule.nfe_key,
          client: schedule.client,
          client_cnpj: info?.client_cnpj || schedule.client,
          case_count: schedule.case_count,
          date: schedule.date,
          status: schedule.status,
          historic: typeof schedule.historic === 'string' ? JSON.parse(schedule.historic) : schedule.historic,
          supplier: schedule.supplier,
          qt_prod: schedule.qt_prod,
          info: info,
          observations: schedule.observations,
          // Informações do estoque escolhido pelo usuário (da tabela wcl do banco dbmercocamp)
          client_info: clientInfo || {
            name: null,
            number: null,
            cnpj: schedule.client
          }
        };
      })
    );

    // Filtrar resultados com base no nível de acesso do usuário
    let filteredResults = enrichedResults;
    
    if (req.user.level_access === 1) {
      // Usuários com nível 1 só podem ver agendamentos aos quais têm acesso
      if (req.user.cli_access) {
        let cliAccess;
        
        // Tratar cli_access se estiver como string
        if (typeof req.user.cli_access === 'string') {
          try {
            cliAccess = JSON.parse(req.user.cli_access);
          } catch (error) {
            console.error('Erro ao parsear cli_access:', error);
            cliAccess = {};
          }
        } else {
          cliAccess = req.user.cli_access || {};
        }
        
        // Obter lista de CNPJs aos quais o usuário tem acesso
        const allowedCnpjs = Object.keys(cliAccess);
        
        // Filtrar resultados pelos CNPJs permitidos
        filteredResults = enrichedResults.filter(schedule => {
          const scheduleCnpj = schedule.client_cnpj || schedule.client;
          return allowedCnpjs.some(cnpj => {
            // Comparar CNPJs removendo formatação
            const cleanScheduleCnpj = scheduleCnpj.replace(/[^\d]/g, '');
            const cleanAllowedCnpj = cnpj.replace(/[^\d]/g, '');
            return cleanScheduleCnpj === cleanAllowedCnpj;
          });
        });
        
        console.log(`👤 Usuário nível 1 - Filtrados ${filteredResults.length} de ${enrichedResults.length} agendamentos`);
      } else {
        // Se não tem cli_access, não pode ver nenhum agendamento
        filteredResults = [];
        console.log('👤 Usuário nível 1 sem cli_access - Nenhum agendamento retornado');
      }
    } else {
      // Usuários com nível diferente de 1 podem ver todos os agendamentos
      console.log(`👤 Usuário nível ${req.user.level_access} - Retornando todos os ${enrichedResults.length} agendamentos`);
    }

    // Retornar resultados
    res.json({
      success: true,
      searchType: input.length >= 44 ? 'nfe_key' : 'number',
      searchValue: searchParam,
      results: filteredResults
    });

  } catch (error) {
    console.error('Erro na busca de agendamento:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível realizar a busca'
    });
  }
});

// Rota para alterar status do agendamento
router.post('/change-status', async (req, res) => {
  try {
    // Validar dados
    const { error, value } = changeStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.details[0].message
      });
    }

    const { scheduleId, newStatus, comment } = value;

    // Verificar se o agendamento existe
    const existingSchedule = await executeCheckinQuery(
      'SELECT id, status, historic, integration FROM schedule_list WHERE id = ?',
      [scheduleId]
    );

    if (existingSchedule.length === 0) {
      return res.status(404).json({
        error: 'Agendamento não encontrado'
      });
    }

    const schedule = existingSchedule[0];

    // Verificar se o status atual permite alteração
    const currentStatus = schedule.status;
    const blockedStatuses = ['Em estoque', 'Estoque', 'Cancelado', 'Recusado'];
    
    if (blockedStatuses.includes(currentStatus)) {
      return res.status(400).json({
        error: `Não é possível alterar o status de um agendamento em "${currentStatus}"`
      });
    }

    // Preparar histórico
    let historic = {};
    if (schedule.historic) {
      try {
        historic = typeof schedule.historic === 'string' ? JSON.parse(schedule.historic) : schedule.historic;
      } catch (e) {
        console.error('Erro ao parsear histórico:', e);
        historic = {};
      }
    }

    // Adicionar entrada no histórico
    const historyEntry = {
      timestamp: new Date().toISOString(),
      user: req.user.name || req.user.user || 'Sistema',
      action: `Status alterado de "${currentStatus}" para "${newStatus}"`,
      old_status: currentStatus,
      new_status: newStatus,
      comment: comment || 'Status alterado via página de verificação de agendamentos',
      user_level: req.user.level_access
    };

    // Gerar chave única para o histórico
    const historyKey = `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    historic[historyKey] = historyEntry;

    // Atualizar no banco de dados - incluindo integration quando mudando para "Em conferência"
    let updateQuery = 'UPDATE schedule_list SET status = ?, historic = ?';
    let updateParams = [newStatus, JSON.stringify(historic)];
    
    // Se mudando para "Em conferência" ou "Conferência", definir data de integração se ainda não existir
    if ((newStatus === 'Em conferência' || newStatus === 'Conferência') && !schedule.integration) {
      updateQuery += ', integration = NOW()';
      console.log(`📅 Definindo data de integração para agendamento ${scheduleId} (status: ${newStatus})`);
    } else if ((newStatus === 'Em conferência' || newStatus === 'Conferência') && schedule.integration) {
      console.log(`📅 Agendamento ${scheduleId} já possui data de integração: ${schedule.integration}`);
    }
    
    updateQuery += ' WHERE id = ?';
    updateParams.push(scheduleId);
    
    await executeCheckinQuery(updateQuery, updateParams);

    // Disparar integrações Corpem baseadas no status
    if (newStatus === 'Agendado' || newStatus === 'Conferência') {
      console.log(`Status alterado para ${newStatus} - Verificando integrações Corpem (ID: ${scheduleId})`);
      
      try {
        const fullScheduleData = await executeCheckinQuery(
          'SELECT * FROM schedule_list WHERE id = ?',
          [scheduleId]
        );

        if (fullScheduleData.length > 0) {
          const scheduleData = fullScheduleData[0];
          
          if (scheduleData.info && typeof scheduleData.info === 'string') {
            try {
              scheduleData.info = JSON.parse(scheduleData.info);
            } catch (e) {
              console.log('Erro ao parsear info, mantendo como string');
            }
          }

          const userId = req.user.user || req.user.name || 'schedule-verification';

          // Cadastro de produtos: disparar quando status = "Agendado"
          if (newStatus === 'Agendado') {
            console.log(`Disparando cadastro de produtos CORPEM (ID: ${scheduleId})`);
            const productsResult = await triggerProductsIntegration(scheduleData, userId);
            
            if (productsResult.success) {
              console.log(`Cadastro de produtos CORPEM concluído com sucesso (ID: ${scheduleId})`);
            } else {
              console.log(`Cadastro de produtos CORPEM falhou (ID: ${scheduleId}):`, productsResult.message);
            }
          }

          // Integração NF: disparar quando status = "Conferência"
          if (newStatus === 'Conferência') {
            console.log(`Disparando integração de NF de entrada CORPEM (ID: ${scheduleId})`);
            const nfResult = await triggerNfEntryIntegration(scheduleData, userId);
            
            if (nfResult.success) {
              console.log(`Integração de NF CORPEM concluída com sucesso (ID: ${scheduleId})`);
            } else {
              console.log(`Integração de NF CORPEM falhou (ID: ${scheduleId}):`, nfResult.message);
            }
          }
        }
      } catch (integrationError) {
        console.error(`Erro nas integrações Corpem (ID: ${scheduleId}):`, integrationError);
      }
    }

    res.json({
      success: true,
      message: `Status alterado de "${currentStatus}" para "${newStatus}" com sucesso`,
      data: {
        scheduleId,
        oldStatus: currentStatus,
        newStatus,
        timestamp: historyEntry.timestamp,
        user: historyEntry.user
      }
    });

  } catch (error) {
    console.error('Erro ao alterar status do agendamento:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: 'Não foi possível alterar o status do agendamento'
    });
  }
});

// Rota para obter informações da página (opcional)
router.get('/info', (req, res) => {
  res.json({
    message: 'Página de verificação de agendamentos',
    user: {
      id: req.user.id,
      name: req.user.name,
      level_access: req.user.level_access
    },
    instructions: {
      search_by_key: 'Digite uma chave de NFe (44+ dígitos) para buscar pela chave',
      search_by_number: 'Digite um número menor que 44 dígitos para buscar pelo número da NFe'
    }
  });
});

module.exports = router;