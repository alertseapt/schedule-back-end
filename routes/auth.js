const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { executeUsersQuery } = require('../config/database');
const { validate, paramSchemas } = require('../middleware/validation');
const { authenticateToken } = require('../middleware/auth');
const Joi = require('joi');

const router = express.Router();

// Schemas de validação específicos para a estrutura real
const authSchemas = {
  login: Joi.object({
    user: Joi.string().required(),
    password: Joi.string().required()
  }),
  
  register: Joi.object({
    user: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(4).required(),
    name: Joi.string().max(100).allow(null, ''),
    level_access: Joi.number().integer().min(0).max(4).required(),
    cli_access: Joi.object().default({})
  })
};

// Login de usuário
router.post('/login', validate(authSchemas.login), async (req, res) => {
  try {
    const { user, password } = req.body;

    console.log('\n🔑 === TENTATIVA DE LOGIN ===');
    console.log(`👤 Usuário: ${user}`);
    console.log(`🔒 Senha: ***${password.slice(-3)}`);

    // Buscar usuário no banco dbusers
    const users = await executeUsersQuery(
      'SELECT id, user, password, name, level_access, cli_access FROM users WHERE user = ?',
      [user]
    );

    console.log(`🔍 Usuários encontrados no banco: ${users.length}`);

    if (users.length === 0) {
      console.log('❌ USUÁRIO NÃO ENCONTRADO - Login falhou');
      return res.status(401).json({
        error: 'Usuário ou senha inválidos'
      });
    }

    const userData = users[0];

    // Verificar senha usando bcrypt para senhas com hash ou comparação direta para senhas antigas
    let isPasswordValid = false;
    
    // Verificar se a senha no banco parece ser um hash bcrypt (começa com $2a$, $2b$ ou $2y$)
    if (userData.password && userData.password.startsWith('$2')) {
      // Senha com hash bcrypt - usar bcrypt.compare
      isPasswordValid = await bcrypt.compare(password, userData.password);
    } else {
      // Senha sem hash (legado) - comparação direta
      isPasswordValid = password === userData.password;
    }
    
    if (!isPasswordValid) {
      return res.status(401).json({
        error: 'Usuário ou senha inválidos'
      });
    }

    // Gerar token JWT (SEM cli_access para evitar tokens grandes)
    const token = jwt.sign(
      { 
        userId: userData.id, 
        user: userData.user,
        name: userData.name,
        level_access: userData.level_access
        // cli_access é enviado na resposta, mas NÃO no token para evitar overflow
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    console.log('✅ LOGIN BEM-SUCEDIDO');
    console.log(`🎫 Token JWT gerado (últimos 20 chars): ***${token.slice(-20)}`);
    console.log(`👤 Dados do usuário:`, {
      id: userData.id,
      user: userData.user,
      name: userData.name,
      level_access: userData.level_access
    });

    // Preparar resposta base
    const response = {
      message: 'Login realizado com sucesso',
      user: {
        id: userData.id,
        user: userData.user,
        name: userData.name,
        level_access: userData.level_access,
        cli_access: typeof userData.cli_access === 'string'
          ? JSON.parse(userData.cli_access)
          : (userData.cli_access || {})
      },
      token
    };

    // Se usuário tem nível de acesso 9, adicionar redirecionamento
    if (userData.level_access === 9) {
      response.redirect = '/schedule-verification';
      response.message = 'Login realizado com sucesso. Redirecionando para página de verificação de agendamentos.';
      console.log('🔀 USUÁRIO NÍVEL 9 - Redirecionamento para schedule-verification');
    }

    console.log('📤 ENVIANDO RESPOSTA DE LOGIN');
    console.log('🔑 === FIM DO PROCESSO DE LOGIN ===\n');
    res.json(response);

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Registrar novo usuário (apenas para admins level_access >= 1)
router.post('/register', validate(authSchemas.register), authenticateToken, async (req, res) => {
  try {
    // Verificar se o usuário atual tem permissão para criar usuários
    if (req.user.level_access < 1) {
      return res.status(403).json({
        error: 'Acesso negado. Permissões insuficientes para criar usuários.'
      });
    }

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
      return res.status(409).json({
        error: 'Usuário já existe'
      });
    }

    // Inserir usuário no banco dbusers
    const result = await executeUsersQuery(
      'INSERT INTO users (user, password, name, level_access, cli_access, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
      [user, password, name, level_access, JSON.stringify(cli_access), req.user.id]
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
    console.error('Erro no registro:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar token atual
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Refresh token
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    const token = jwt.sign(
      { 
        userId: req.user.id, 
        user: req.user.user,
        name: req.user.name,
        level_access: req.user.level_access,
        cli_access: req.user.cli_access
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      message: 'Token renovado com sucesso',
      token
    });

  } catch (error) {
    console.error('Erro no refresh:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Logout (invalidar token - implementação simples)
router.post('/logout', authenticateToken, (req, res) => {
  // Em uma implementação real, você poderia adicionar o token a uma blacklist
  res.json({
    message: 'Logout realizado com sucesso'
  });
});

module.exports = router; 