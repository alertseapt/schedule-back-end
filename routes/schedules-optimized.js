const express = require('express');
const { executeCheckinQuery, executeUsersQuery, executeMercocampQuery } = require('../config/database-render');
const { validate, paramSchemas, nfeSchemas, validateCNPJ, formatCNPJ } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireManager, requireClientAccess, checkClientAccess } = require('../middleware/auth');

const router = express.Router();

// Cache para informações de clientes (evita consultas repetitivas)
let clientInfoCache = new Map();
let cacheExpirationTime = 5 * 60 * 1000; // 5 minutos
let lastCacheUpdate = 0;

// Função otimizada para buscar informações de clientes em lote
const getClientsInfoBatch = async (clientCnpjs, userCliAccess = null) => {
  try {
    const now = Date.now();
    
    // Verificar se o cache precisa ser atualizado
    if (now - lastCacheUpdate > cacheExpirationTime) {
      console.log('🔄 Atualizando cache de clientes...');
      clientInfoCache.clear();
      
      // Carregar todos os cli_access de uma vez
      const users = await executeUsersQuery(
        'SELECT cli_access FROM users WHERE cli_access IS NOT NULL'
      );
      
      // Processar todos os cli_access
      for (const user of users) {
        const cliAccess = typeof user.cli_access === 'string' ? 
          JSON.parse(user.cli_access) : user.cli_access;
        
        for (const [cnpj, clientData] of Object.entries(cliAccess)) {
          if (!clientInfoCache.has(cnpj)) {
            clientInfoCache.set(cnpj, {
              cnpj: cnpj,
              name: clientData.nome || `Cliente ${cnpj}`,
              number: clientData.numero || cnpj,
              source: 'cli_access',
              cli_access_data: clientData
            });
          }
        }
      }
      
      lastCacheUpdate = now;
      console.log(`✅ Cache atualizado com ${clientInfoCache.size} clientes`);
    }
    
    // Retornar informações dos clientes solicitados
    const result = {};
    for (const cnpj of clientCnpjs) {
      if (clientInfoCache.has(cnpj)) {
        result[cnpj] = clientInfoCache.get(cnpj);
      } else {
        // Cliente não encontrado, usar dados básicos
        result[cnpj] = {
          cnpj: cnpj,
          name: `Cliente ${cnpj}`,
          number: cnpj,
          source: 'fallback'
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Erro ao buscar informações dos clientes:', error);
    // Retornar dados básicos em caso de erro
    const result = {};
    for (const cnpj of clientCnpjs) {
      result[cnpj] = {
        cnpj: cnpj,
        name: `Cliente ${cnpj}`,
        number: cnpj,
        source: 'error'
      };
    }
    return result;
  }
};

// Listar agendamentos OTIMIZADO
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Verificar se o usuário está autenticado
    if (!req.user) {
      return res.status(401).json({
        error: 'Usuário não autenticado'
      });
    }
    
    const { 
      page = 1, 
      limit = 20, // Aumentado para 20 por padrão para scroll infinito
      client = '', 
      status = '',
      date_from = '',
      date_to = '',
      nfe_key = '',
      number = '',
      supplier = ''
    } = req.query;
    
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filtrar por acesso do usuário
    const shouldFilterByCliAccess = !req.user._clientAccessCache.hasFullAccess;
    
    if (shouldFilterByCliAccess) {
      const allowedClients = req.user._clientAccessCache.allowedClients;
      
      if (allowedClients.length === 0) {
        return res.json({
          schedules: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
      
      // Normalizar CNPJs
      const normalizedClients = [];
      allowedClients.forEach(cnpj => {
        normalizedClients.push(cnpj);
        normalizedClients.push(cnpj.replace(/[^\d]/g, ''));
        const formatted = cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        if (formatted !== cnpj) {
          normalizedClients.push(formatted);
        }
      });
      
      const uniqueClients = [...new Set(normalizedClients)];
      whereClause += ` AND client IN (${uniqueClients.map(() => '?').join(',')})`;
      params.push(...uniqueClients);
    }

    // Filtros adicionais
    if (client) {
      whereClause += ' AND client = ?';
      params.push(client);
    }

    if (status) {
      whereClause += ' AND status = ?';
      params.push(status);
    }

    if (date_from) {
      whereClause += ' AND date >= ?';
      params.push(date_from);
    }

    if (date_to) {
      whereClause += ' AND date <= ?';
      params.push(date_to);
    }

    if (nfe_key) {
      whereClause += ' AND nfe_key = ?';
      params.push(nfe_key);
    }

    if (number) {
      whereClause += ' AND number = ?';
      params.push(number);
    }

    if (supplier) {
      whereClause += ' AND supplier LIKE ?';
      params.push(`%${supplier}%`);
    }

    // OTIMIZAÇÃO 1: Buscar dados e contagem em paralelo
    const [schedulesResult, countResult] = await Promise.all([
      // Buscar agendamentos
      executeCheckinQuery(
        `SELECT 
          id, number, nfe_key, client, date, status, historic, supplier, qt_prod, info, case_count
         FROM schedule_list 
         ${whereClause}
         ORDER BY date DESC, id DESC
         LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
        params
      ),
      // Contar total
      executeCheckinQuery(
        `SELECT COUNT(*) as total FROM schedule_list ${whereClause}`,
        params
      )
    ]);

    const schedules = schedulesResult;
    const total = countResult[0].total;

    // OTIMIZAÇÃO 2: Buscar informações de clientes em lote
    const uniqueClients = [...new Set(schedules.map(s => s.client))];
    const clientsInfo = await getClientsInfoBatch(uniqueClients, req.user.cli_access);

    // OTIMIZAÇÃO 3: Processar dados sem await desnecessários
    const processedSchedules = schedules.map((schedule) => {
      const clientInfo = clientsInfo[schedule.client];
      
      // Extrair informações do JSON info se disponível
      let supplierName = schedule.supplier;
      let totalValue = null;
      let parsedInfo = null;
      
      if (schedule.info) {
        try {
          parsedInfo = typeof schedule.info === 'string' ? 
            JSON.parse(schedule.info) : schedule.info;
          
          if (parsedInfo.emit && parsedInfo.emit.xNome) {
            supplierName = parsedInfo.emit.xNome;
          }
          
          // Buscar valor total
          if (parsedInfo.total && parsedInfo.total.ICMSTot) {
            totalValue = parsedInfo.total.ICMSTot.vProd || parsedInfo.total.ICMSTot.vNF || null;
          } else if (parsedInfo.products && Array.isArray(parsedInfo.products)) {
            totalValue = parsedInfo.products.reduce((sum, product) => {
              return sum + (product.total_value || 0);
            }, 0);
          }
        } catch (e) {
          parsedInfo = schedule.info;
        }
      }

      let parsedHistoric;
      try {
        parsedHistoric = typeof schedule.historic === 'string' ? 
          JSON.parse(schedule.historic) : schedule.historic;
      } catch (e) {
        parsedHistoric = {};
      }

      return {
        id: schedule.id,
        number: schedule.number,
        nfe_key: schedule.nfe_key,
        client: clientInfo.name,
        client_cnpj: schedule.client,
        supplier: supplierName,
        case_count: schedule.case_count || 0,
        status: schedule.status,
        date: schedule.date instanceof Date ? 
          `${schedule.date.getFullYear()}-${String(schedule.date.getMonth() + 1).padStart(2, '0')}-${String(schedule.date.getDate()).padStart(2, '0')}` : 
          schedule.date,
        qt_prod: schedule.qt_prod,
        total_value: totalValue,
        historic: parsedHistoric,
        info: parsedInfo,
        client_info: clientInfo
      };
    });

    const endTime = Date.now();
    console.log(`⚡ Query /schedules executada em ${endTime - startTime}ms`);
    console.log(`📊 Retornando ${processedSchedules.length} agendamentos de ${total} total`);

    res.json({
      schedules: processedSchedules,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      performance: {
        execution_time_ms: endTime - startTime,
        cached_clients: clientInfoCache.size
      }
    });

  } catch (error) {
    console.error('Erro ao listar agendamentos:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;