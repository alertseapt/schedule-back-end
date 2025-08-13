const express = require('express');
const { executeUsersQuery } = require('../config/database-render');
const { validate, paramSchemas } = require('../middleware/validation');
const { authenticateToken, requireAdmin, requireManager, requireOwnershipOrAdmin } = require('../middleware/auth');
const Joi = require('joi');
const bcrypt = require('bcryptjs'); // Added bcrypt for password hashing

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Schemas de validação
const schemas = {
  create: Joi.object({
    user: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(4).required(),
    name: Joi.string().max(100).allow(null, ''),
    level_access: Joi.number().integer().min(0).max(4).required(),
    cli_access: Joi.object().default({})
  }),

  update: Joi.object({
    user: Joi.string().alphanum().min(3).max(30),
    password: Joi.string().min(4),
    name: Joi.string().max(100).allow(null, ''),
    level_access: Joi.number().integer().min(0).max(4),
    cli_access: Joi.object()
  }),

  profile: Joi.object({
    name: Joi.string().max(100).allow(null, ''),
    password: Joi.string().min(4),
    currentPassword: Joi.string().when('password', {
      is: Joi.exist(),
      then: Joi.required(),
      otherwise: Joi.optional()
    })
  })
};

// Listar usuários (apenas admin/manager)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      level_access = '',
      sort_by = 'created_at',
      sort_order = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    // Filtros
    if (search) {
      whereClause += ' AND (user LIKE ? OR name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (level_access !== '') {
      whereClause += ' AND level_access = ?';
      params.push(parseInt(level_access));
    }

    // Ordenação
    const validSortFields = ['id', 'user', 'name', 'level_access', 'created_at'];
    const sortField = validSortFields.includes(sort_by) ? sort_by : 'created_at';
    const sortDirection = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    // Buscar usuários
    const users = await executeUsersQuery(
      `SELECT 
        id, user, name, level_access, created_by, created_at
       FROM users 
       ${whereClause}
       ORDER BY ${sortField} ${sortDirection}
       LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`,
      params
    );

    // Contar total
    const [{ total }] = await executeUsersQuery(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );

    res.json({
      users: users.map(user => ({
        ...user,
        created_at: user.created_at ? user.created_at.toISOString() : null
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Buscar usuário por ID
router.get('/:id', validate(paramSchemas.id, 'params'), requireOwnershipOrAdmin('id'), async (req, res) => {
  try {
    const { id } = req.params;

    const users = await executeUsersQuery(
      'SELECT id, user, name, level_access, cli_access, created_by, created_at FROM users WHERE id = ?',
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const user = users[0];
    
    // Processar cli_access
    const processedUser = {
      ...user,
      cli_access: typeof user.cli_access === 'string' ? 
        JSON.parse(user.cli_access) : user.cli_access,
      created_at: user.created_at ? user.created_at.toISOString() : null
    };

    res.json({
      user: processedUser
    });

  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Criar usuário (apenas admin/manager)
router.post('/', requireAdmin, validate(schemas.create), async (req, res) => {
  try {
    const { 
      user, 
      password, 
      name, 
      level_access, 
      cli_access 
    } = req.body;

    // Verificar se o usuário já existe
    const existingUsers = await executeUsersQuery(
      'SELECT id FROM users WHERE user = ?',
      [user]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        error: 'Nome de usuário já está em uso'
      });
    }

    // Hash da senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // Inserir usuário
    const result = await executeUsersQuery(
      'INSERT INTO users (user, password, name, level_access, cli_access, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [user, hashedPassword, name, level_access, JSON.stringify(cli_access), req.user.user]
    );

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: result.insertId,
        user,
        name,
        level_access
      }
    });

  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar usuário (apenas admin/manager)
router.put('/:id', requireAdmin, validate(paramSchemas.id, 'params'), validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const { user, password, name, level_access, cli_access } = req.body;

    // Verificar se o usuário existe
    const existingUser = await executeUsersQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // Verificar se o nome de usuário já está em uso por outro usuário
    if (user) {
      const userCheck = await executeUsersQuery(
        'SELECT id FROM users WHERE user = ? AND id != ?',
        [user, id]
      );

      if (userCheck.length > 0) {
        return res.status(400).json({
          error: 'Nome de usuário já está em uso por outro usuário'
        });
      }
    }

    // Construir query de atualização dinamicamente
    const updateFields = [];
    const updateParams = [];

    if (user !== undefined) {
      updateFields.push('user = ?');
      updateParams.push(user);
    }

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateParams.push(hashedPassword);
    }

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }

    if (level_access !== undefined) {
      updateFields.push('level_access = ?');
      updateParams.push(level_access);
    }

    if (cli_access !== undefined) {
      updateFields.push('cli_access = ?');
      updateParams.push(JSON.stringify(cli_access));
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo para atualizar fornecido'
      });
    }

    updateParams.push(id);

    await executeUsersQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    res.json({
      message: 'Usuário atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar próprio perfil
router.put('/profile/me', (req, res, next) => {
  console.log('🎯 Rota /profile/me interceptada ANTES da validação');
  console.log('🔍 Headers:', req.headers.authorization? 'Token presente' : 'Token ausente');
  next();
}, validate(schemas.profile), async (req, res) => {
  try {
    console.log('🔄 Rota /profile/me atingida. User ID:', req.user?.id);
    console.log('📝 Dados recebidos:', { 
      name: req.body.name, 
      hasPassword: !!req.body.password, 
      hasCurrentPassword: !!req.body.currentPassword 
    });
    
    const { name, password, currentPassword } = req.body;

    // Se está alterando senha, validar senha atual
    if (password && !currentPassword) {
      return res.status(400).json({
        error: 'Senha atual é obrigatória para alterar a senha'
      });
    }

    if (password && currentPassword) {
      // Buscar dados do usuário para validar senha atual
      const users = await executeUsersQuery(
        'SELECT password FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          error: 'Usuário não encontrado'
        });
      }

      // Validar senha atual
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
      if (!isCurrentPasswordValid) {
        return res.status(401).json({
          error: 'Senha atual incorreta'
        });
      }
    }

    // Construir query de atualização dinamicamente
    const updateFields = [];
    const updateParams = [];

    if (name !== undefined) {
      updateFields.push('name = ?');
      updateParams.push(name);
    }

    if (password !== undefined) {
      const hashedPassword = await bcrypt.hash(password, 10);
      updateFields.push('password = ?');
      updateParams.push(hashedPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        error: 'Nenhum campo para atualizar fornecido'
      });
    }

    updateParams.push(req.user.id);

    await executeUsersQuery(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );

    res.json({
      message: 'Perfil atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar perfil:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Deletar usuário (apenas manager)
router.delete('/:id', requireManager, validate(paramSchemas.id, 'params'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verificar se o usuário existe
    const existingUsers = await executeUsersQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // Não permitir deletar o próprio usuário
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        error: 'Não é possível deletar o próprio usuário'
      });
    }

    // Deletar usuário
    await executeUsersQuery(
      'DELETE FROM users WHERE id = ?',
      [id]
    );

    res.json({
      message: 'Usuário deletado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Obter perfil do usuário atual
router.get('/profile/me', (req, res) => {
  res.json({
    user: req.user
  });
});

// Buscar usuários por nível de acesso
router.get('/level/:level', requireAdmin, validate(paramSchemas.id, 'params'), async (req, res) => {
  try {
    const { level } = req.params;

    if (level < 0 || level > 2) {
      return res.status(400).json({
        error: 'Nível de acesso deve estar entre 0 e 2'
      });
    }

    const users = await executeUsersQuery(
      'SELECT id, user, name, level_access, created_at FROM users WHERE level_access = ? ORDER BY name',
      [level]
    );

    res.json({
      level_access: parseInt(level),
      users: users.map(user => ({
        ...user,
        created_at: user.created_at ? user.created_at.toISOString() : null
      }))
    });

  } catch (error) {
    console.error('Erro ao buscar usuários por nível:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar acesso de cliente para usuário
router.put('/:id/client-access', requireAdmin, validate(paramSchemas.id, 'params'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cli_access } = req.body;

    if (!cli_access || typeof cli_access !== 'object') {
      return res.status(400).json({
        error: 'cli_access deve ser um objeto válido'
      });
    }

    // Verificar se o usuário existe
    const existingUsers = await executeUsersQuery(
      'SELECT id FROM users WHERE id = ?',
      [id]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    // Atualizar acesso do cliente
    await executeUsersQuery(
      'UPDATE users SET cli_access = ? WHERE id = ?',
      [JSON.stringify(cli_access), id]
    );

    res.json({
      message: 'Acesso de cliente atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar acesso de cliente:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Listar clientes acessíveis pelo usuário atual
router.get('/clients/accessible', async (req, res) => {
  try {
    // Verificar se o usuário tem acesso total
    if (req.user._clientAccessCache.hasFullAccess) {
      // Para usuários com acesso total, retornar todos os clientes do cli_access
      const cliAccess = req.user.cli_access || {};
      
      const clients = Object.keys(cliAccess).map(cnpj => ({
        cnpj,
        name: cliAccess[cnpj].nome,
        number: cliAccess[cnpj].numero
      }));

      return res.json({
        clients
      });
    }
    
    // Para usuários com acesso restrito, usar a lista de clientes permitidos do cache
    const allowedClients = req.user._clientAccessCache.allowedClients;
    const cliAccess = req.user.cli_access || {};
    
    const clients = allowedClients.map(cnpj => ({
      cnpj,
      name: cliAccess[cnpj]?.nome || `Cliente ${cnpj}`,
      number: cliAccess[cnpj]?.numero || cnpj
    }));

    res.json({
      clients
    });

  } catch (error) {
    console.error('Erro ao buscar clientes acessíveis:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Estatísticas de usuários (apenas admin)
router.get('/stats/summary', requireAdmin, async (req, res) => {
  try {
    const stats = await executeUsersQuery(
      `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN level_access = 0 THEN 1 END) as users,
        COUNT(CASE WHEN level_access = 1 THEN 1 END) as admins,
        COUNT(CASE WHEN level_access = 2 THEN 1 END) as managers
       FROM users`
    );

    res.json({
      statistics: stats[0]
    });

  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router;