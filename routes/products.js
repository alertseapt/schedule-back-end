const express = require('express');
const { executeCheckinQuery } = require('../config/database-render');
const { validate, paramSchemas, nfeSchemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireClientAccess, checkClientAccess } = require('../middleware/auth');
const productService = require('../services/productService');
const Joi = require('joi');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Schemas de validação para produtos (estrutura real: relacionamentos cliente/fornecedor)
const productSchemas = {
  create: Joi.object({
    cli_code: Joi.string().max(50).required(),
    cli_cnpj: Joi.string().length(14).required(),
    cli_desc: Joi.string().max(100).required(),
    supp_code: Joi.string().max(50).required(),
    supp_cnpj: Joi.string().length(14).required(),
    supp_desc: Joi.string().max(100).allow(''),
    user: Joi.string().max(50).required()
  }),

  update: Joi.object({
    cli_code: Joi.string().max(50),
    cli_cnpj: Joi.string().length(14),
    cli_desc: Joi.string().max(100),
    supp_code: Joi.string().max(50),
    supp_cnpj: Joi.string().length(14),
    supp_desc: Joi.string().max(100).allow(''),
    user: Joi.string().max(50)
  }).min(1),
};

// Função auxiliar para verificar acesso ao cliente
// Usa a função checkClientAccess do middleware auth.js que implementa cache
const hasClientAccess = (userCliAccess, clientCnpj) => {
  // Se não estamos em um contexto de requisição, usamos a verificação direta
  if (!global.currentRequest || !global.currentRequest.user) {
  if (!userCliAccess || typeof userCliAccess !== 'object') return false;
  return Object.keys(userCliAccess).includes(clientCnpj);
  }
  
  // Se estamos em um contexto de requisição, usamos a função com cache
  return checkClientAccess(global.currentRequest, clientCnpj);
};

// Listar produtos/relacionamentos
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      cli_cnpj = '', 
      supp_cnpj = '',
      user_filter = '',
      search = ''
    } = req.query;
    
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filtrar por acesso do usuário
    // Usuários nível 0 têm acesso total, outros precisam verificar cli_access
    if (!req.user._clientAccessCache.hasFullAccess) {
      const allowedClients = req.user._clientAccessCache.allowedClients;
      
      if (allowedClients.length === 0) {
        return res.json({
          products: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0
          }
        });
      }
      
      whereClause += ` AND cli_cnpj IN (${allowedClients.map(() => '?').join(',')})`;
      params.push(...allowedClients);
    }

    // Filtros
    if (cli_cnpj) {
      whereClause += ' AND cli_cnpj = ?';
      params.push(cli_cnpj);
    }

    if (supp_cnpj) {
      whereClause += ' AND supp_cnpj = ?';
      params.push(supp_cnpj);
    }

    if (user_filter) {
      whereClause += ' AND user = ?';
      params.push(user_filter);
    }

    if (search) {
      whereClause += ' AND (cli_desc LIKE ? OR supp_desc LIKE ? OR cli_code LIKE ? OR supp_code LIKE ?)' ;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Buscar produtos na tabela products do dbcheckin
    const products = await executeCheckinQuery(
      `SELECT 
        cli_code, cli_cnpj, cli_desc, supp_code, supp_cnpj, supp_desc, user, date, hist, latest_into_case
       FROM products 
       ${whereClause}
       ORDER BY date DESC 
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    // Processar dados para incluir histórico parseado
    const processedProducts = products.map(product => ({
      ...product,
      hist: typeof product.hist === 'string' ? JSON.parse(product.hist) : product.hist
    }));

    // Contar total
    const [{ total }] = await executeCheckinQuery(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      params
    );

    res.json({
      products: processedProducts,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao listar produtos:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar se produtos da NFe já existem na base
router.post('/check-existing', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) {
      return res.status(400).json({ error: 'Campo products deve ser um array' });
    }
    
    // Verificar se o usuário tem acesso total
    const hasFullAccess = req.user._clientAccessCache.hasFullAccess;
    const allowedClients = !hasFullAccess ? req.user._clientAccessCache.allowedClients : [];
    
    const results = [];
    for (const product of products) {
      if (!product.supp_code || !product.supp_cnpj || !product.cli_cnpj) {
        results.push({
          supp_code: product.supp_code,
          exists: false,
          error: 'Campos obrigatórios ausentes'
        });
        continue;
      }
      
      // Verificar se o usuário tem acesso ao cliente do produto
      if (!hasFullAccess && !allowedClients.includes(product.cli_cnpj)) {
        results.push({
          supp_code: product.supp_code,
          exists: false,
          error: 'Sem permissão para acessar este cliente'
        });
        continue;
      }
      try {
        const existing = await executeCheckinQuery(
          'SELECT * FROM products WHERE supp_code = ? AND supp_cnpj = ? AND cli_cnpj = ?',
          [product.supp_code, product.supp_cnpj, product.cli_cnpj]
        );
          results.push({
            supp_code: product.supp_code,
          exists: existing.length > 0,
          data: existing.length > 0 ? existing[0] : null
          });
      } catch (err) {
        results.push({
          supp_code: product.supp_code,
          exists: false,
          error: 'Erro ao consultar produto'
        });
      }
    }
    res.json({ results });
  } catch (error) {
    console.error('Erro ao verificar produtos existentes:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Criar novo relacionamento produto/cliente/fornecedor
router.post('/', validate(productSchemas.create), async (req, res) => {
  try {
    const { 
      cli_code, 
      cli_cnpj, 
      cli_desc, 
      supp_code, 
      supp_cnpj, 
      supp_desc,
      user 
    } = req.body;

    // Verificar acesso ao cliente
    // Usuários nível 0 têm acesso total, outros precisam verificar cli_access
    if (!req.user._clientAccessCache.hasFullAccess && !checkClientAccess(req, cli_cnpj)) {
      return res.status(403).json({
        error: 'Você não tem permissão para criar produtos para este cliente'
      });
    }

    // Criar histórico inicial
    const initialHist = {
      created: {
        timestamp: new Date().toISOString(),
        user: req.user.user,
        action: 'Produto criado manualmente',
        comment: 'Produto criado via interface'
      }
    };

    // Inserir produto na tabela products do dbcheckin
    await executeCheckinQuery(
      `INSERT INTO products 
       (cli_code, cli_cnpj, cli_desc, supp_code, supp_cnpj, supp_desc, user, date, hist, latest_into_case) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), ?, ?)` ,
      [cli_code, cli_cnpj, cli_desc, supp_code, supp_cnpj, supp_desc, user, JSON.stringify(initialHist), 1]
    );

    res.status(201).json({
      message: 'Relacionamento produto criado com sucesso',
      product: {
        cli_code,
        cli_cnpj,
        cli_desc,
        supp_code,
        supp_cnpj,
        supp_desc,
        user,
        date: new Date(),
        latest_into_case: 1
      }
    });

  } catch (error) {
    console.error('Erro ao criar produto:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar relacionamento produto (apenas admin)
router.put('/', requireAdmin, validate(productSchemas.update), async (req, res) => {
  try {
    const { 
      cli_code, 
      cli_cnpj, 
      cli_desc, 
      supp_code, 
      supp_cnpj, 
      supp_desc,
      user 
    } = req.body;

    // Para atualizar, precisamos identificar o registro
    // Como não há ID, vamos usar cli_code e cli_cnpj como identificadores
    if (!cli_code || !cli_cnpj) {
      return res.status(400).json({
        error: 'cli_code e cli_cnpj são obrigatórios para atualização'
      });
    }

    // Verificar se o registro existe
    const existingProducts = await executeCheckinQuery(
      'SELECT * FROM products WHERE cli_code = ? AND cli_cnpj = ?',
      [cli_code, cli_cnpj]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({
        error: 'Relacionamento produto não encontrado'
      });
    }
    
    // Verificar acesso ao cliente
    // Usuários nível 0 têm acesso total, outros precisam verificar cli_access
    if (!req.user._clientAccessCache.hasFullAccess && !checkClientAccess(req, cli_cnpj)) {
      return res.status(403).json({
        error: 'Você não tem permissão para atualizar produtos deste cliente'
      });
    }

    const product = existingProducts[0];

    // Atualizar histórico
    const currentHist = typeof product.hist === 'string' ? 
      JSON.parse(product.hist) : product.hist;
    
    const updatedHist = {
      ...currentHist,
      [`updated_${Date.now()}`]: {
        timestamp: new Date().toISOString(),
        user: req.user.user,
        action: 'Produto atualizado via interface',
        changes: {}
      }
    };

    // Preparar dados para atualização
    const updateFields = [];
    const updateParams = [];

    if (cli_desc) {
      updateFields.push('cli_desc = ?');
      updateParams.push(cli_desc);
      updatedHist[`updated_${Date.now()}`].changes.cli_desc = { from: product.cli_desc, to: cli_desc };
    }

    if (supp_code) {
      updateFields.push('supp_code = ?');
      updateParams.push(supp_code);
      updatedHist[`updated_${Date.now()}`].changes.supp_code = { from: product.supp_code, to: supp_code };
    }

    if (supp_cnpj) {
      updateFields.push('supp_cnpj = ?');
      updateParams.push(supp_cnpj);
      updatedHist[`updated_${Date.now()}`].changes.supp_cnpj = { from: product.supp_cnpj, to: supp_cnpj };
    }

    if (supp_desc !== undefined) {
      updateFields.push('supp_desc = ?');
      updateParams.push(supp_desc);
      updatedHist[`updated_${Date.now()}`].changes.supp_desc = { from: product.supp_desc, to: supp_desc };
    }

    if (user) {
      updateFields.push('user = ?');
      updateParams.push(user);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo válido para atualização fornecido'
      });
    }

    updateFields.push('date = NOW()');
    updateFields.push('hist = ?');
    updateParams.push(JSON.stringify(updatedHist));
    updateParams.push(cli_code, cli_cnpj);

    // Executar atualização
    await executeCheckinQuery(
      `UPDATE products SET ${updateFields.join(', ')} WHERE cli_code = ? AND cli_cnpj = ?`,
      updateParams
    );

    res.json({
      message: 'Relacionamento produto atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar produto:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Deletar relacionamento produto (apenas admin)
router.delete('/', requireAdmin, async (req, res) => {
  try {
    const { cli_code, cli_cnpj } = req.body;

    if (!cli_code || !cli_cnpj) {
      return res.status(400).json({
        error: 'cli_code e cli_cnpj são obrigatórios para deletar'
      });
    }

    // Verificar se o registro existe
    const existingProducts = await executeCheckinQuery(
      'SELECT * FROM products WHERE cli_code = ? AND cli_cnpj = ?',
      [cli_code, cli_cnpj]
    );

    if (existingProducts.length === 0) {
      return res.status(404).json({
        error: 'Relacionamento produto não encontrado'
      });
    }
    
    // Verificar acesso ao cliente
    // Usuários nível 0 têm acesso total, outros precisam verificar cli_access
    if (!req.user._clientAccessCache.hasFullAccess && !checkClientAccess(req, cli_cnpj)) {
      return res.status(403).json({
        error: 'Você não tem permissão para deletar produtos deste cliente'
      });
    }

    // Deletar registro
    await executeCheckinQuery(
      'DELETE FROM products WHERE cli_code = ? AND cli_cnpj = ?',
      [cli_code, cli_cnpj]
    );

    res.json({
      message: 'Relacionamento produto deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar produto:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/products/prefill/:suppCode/:suppCnpj
 * Busca dados de pré-preenchimento para um produto baseado no código e CNPJ do fornecedor
 */
router.get('/prefill/:suppCode/:suppCnpj', async (req, res) => {
  try {
    const { suppCode, suppCnpj } = req.params;
    const { cliCnpj } = req.query; // CNPJ do cliente/estoque (opcional)

    console.log('\n🔍 Buscando dados de pré-preenchimento:');
    console.log('   Código fornecedor:', suppCode);
    console.log('   CNPJ fornecedor:', suppCnpj);
    console.log('   CNPJ cliente:', cliCnpj || 'não especificado');

    const prefillData = await productService.getProductPrefillData(suppCode, suppCnpj, cliCnpj);

    if (prefillData && prefillData.source !== 'not_found') {
      console.log('✅ Dados encontrados para pré-preenchimento');
      
      res.json({
        success: true,
        data: prefillData,
        message: 'Dados de pré-preenchimento encontrados'
      });
    } else {
      console.log('⚠️ Nenhum dado encontrado para pré-preenchimento');
      
      res.json({
        success: false,
        data: null,
        message: 'Produto não encontrado no histórico'
      });
    }

  } catch (error) {
    console.error('❌ Erro ao buscar dados de pré-preenchimento:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

/**
 * POST /api/products/batch-prefill
 * Busca dados de pré-preenchimento para múltiplos produtos
 */
router.post('/batch-prefill', async (req, res) => {
  try {
    const { products, cliCnpj } = req.body;

    if (!products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        error: 'Lista de produtos é obrigatória'
      });
    }

    console.log('\n🔍 Buscando pré-preenchimento em lote:');
    console.log('   Quantidade de produtos:', products.length);
    console.log('   CNPJ cliente:', cliCnpj || 'não especificado');

    const results = [];

    for (const product of products) {
      const { supp_code, supp_cnpj } = product;
      
      if (supp_code && supp_cnpj) {
        const prefillData = await productService.getProductPrefillData(supp_code, supp_cnpj, cliCnpj);
        
        console.log(`🎯 Resultado final para ${supp_code}:`, {
          prefillData: prefillData,
          has_data: !!prefillData && prefillData.source !== 'not_found'
        });
        
        results.push({
          supp_code,
          supp_cnpj,
          prefill_data: prefillData,
          has_data: !!prefillData && prefillData.source !== 'not_found'
        });
      } else {
        results.push({
          supp_code: supp_code || 'N/A',
          supp_cnpj: supp_cnpj || 'N/A',
          prefill_data: null,
          has_data: false,
          error: 'Código ou CNPJ do fornecedor ausente'
        });
      }
    }

    const foundCount = results.filter(r => r.has_data).length;

    res.json({
      success: true,
      data: results,
      summary: {
        total: products.length,
        found: foundCount,
        not_found: products.length - foundCount
      },
      message: `${foundCount} de ${products.length} produtos encontrados no histórico`
    });

  } catch (error) {
    console.error('❌ Erro ao buscar pré-preenchimento em lote:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor',
      message: error.message
    });
  }
});

module.exports = router; 