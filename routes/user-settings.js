const express = require('express');
const { executeUsersQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const emailService = require('../services/emailService');
const clientEmailService = require('../services/clientEmailService');
const Joi = require('joi');

const router = express.Router();

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// Schemas de validação
const emailSettingsSchema = Joi.object({
  primaryEmail: Joi.alternatives().try(
    Joi.string().email(),
    Joi.string().allow('').empty('')
  ).optional(),
  ccEmails: Joi.array().items(Joi.string().email()).default([]),
  statusNotifications: Joi.object({
    solicitado: Joi.boolean().default(false),
    contestado: Joi.boolean().default(false),
    agendado: Joi.boolean().default(false),
    conferencia: Joi.boolean().default(false),
    recebido: Joi.boolean().default(false),
    tratativa: Joi.boolean().default(false),
    estoque: Joi.boolean().default(false), // Manter chave original para compatibilidade
    recusar: Joi.boolean().default(false),
    recusado: Joi.boolean().default(false),
    cancelado: Joi.boolean().default(false)
  }).default({})
});

const uiSettingsSchema = Joi.object({
  theme: Joi.string().valid('light', 'dark').default('light'),
  language: Joi.string().valid('pt', 'en').default('pt'),
  itemsPerPage: Joi.number().integer().min(5).max(100).default(10),
  defaultView: Joi.string().valid('dashboard', 'schedules', 'reports').default('dashboard')
});

const userSettingsSchema = Joi.object({
  emailSettings: emailSettingsSchema.optional(),
  uiSettings: uiSettingsSchema.optional()
});

// Obter configurações do usuário
router.get('/', async (req, res) => {
  try {
    console.log('📥 GET /user-settings - Usuário:', req.user.id);

    const users = await executeUsersQuery(
      'SELECT config FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const userConfig = users[0].config;
    let settings = {
      emailSettings: {
        primaryEmail: '',
        ccEmails: [],
        statusNotifications: {
          solicitado: false,
          contestado: false,
          agendado: false,
          conferencia: false,
          tratativa: false,
          estoque: false,
          recusar: false,
          recusado: false,
          cancelado: false
        }
      },
      uiSettings: {
        theme: 'light',
        language: 'pt',
        itemsPerPage: 10,
        defaultView: 'dashboard'
      }
    };

    if (userConfig) {
      const config = typeof userConfig === 'string' ? JSON.parse(userConfig) : userConfig;
      settings = { ...settings, ...config };
    }

    console.log('✅ Configurações carregadas:', JSON.stringify(settings, null, 2));

    res.json({
      settings: settings
    });

  } catch (error) {
    console.error('❌ Erro ao buscar configurações:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar todas as configurações
router.put('/', async (req, res) => {
  try {
    console.log('📥 PUT /user-settings - Dados recebidos:', JSON.stringify(req.body, null, 2));

    const { error, value } = userSettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.details
      });
    }

    // Buscar configurações atuais
    const users = await executeUsersQuery(
      'SELECT config FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const currentConfig = users[0].config;
    let settings = {};
    let oldEmailSettings = null;

    if (currentConfig) {
      settings = typeof currentConfig === 'string' ? JSON.parse(currentConfig) : currentConfig;
      oldEmailSettings = settings.emailSettings;
    }

    // NOVA FUNCIONALIDADE: Atualizar e-mails na tabela 'clientes' se emailSettings foi alterado
    if (value.emailSettings) {
      try {
        // Atualizar e-mail principal
        const oldPrimaryEmail = oldEmailSettings?.primaryEmail;
        const newPrimaryEmail = value.emailSettings.primaryEmail;
        
        if (oldPrimaryEmail !== newPrimaryEmail) {
          await clientEmailService.updateUserPrimaryEmail(req.user.id, oldPrimaryEmail, newPrimaryEmail);
          console.log(`✅ E-mail principal atualizado na tabela clientes: ${oldPrimaryEmail} → ${newPrimaryEmail}`);
        }
        
        // Atualizar e-mails em cópia
        const oldCcEmails = oldEmailSettings?.ccEmails || [];
        const newCcEmails = value.emailSettings.ccEmails || [];
        
        await clientEmailService.updateUserCcEmails(req.user.id, oldCcEmails, newCcEmails);
        console.log(`✅ E-mails em cópia atualizados na tabela clientes`);
        
      } catch (clientEmailError) {
        console.error('⚠️ Erro ao atualizar e-mails na tabela clientes:', clientEmailError.message);
        // Não falha a operação principal se houver erro na atualização da tabela clientes
      }
    }

    // Mesclar com novas configurações
    const updatedSettings = { ...settings, ...value };

    console.log('📤 Salvando configurações:', JSON.stringify(updatedSettings, null, 2));

    await executeUsersQuery(
      'UPDATE users SET config = ? WHERE id = ?',
      [JSON.stringify(updatedSettings), req.user.id]
    );

    res.json({
      message: 'Configurações atualizadas com sucesso',
      settings: updatedSettings
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configurações:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar apenas configurações de e-mail
router.patch('/email', async (req, res) => {
  try {
    console.log('📥 PATCH /user-settings/email - Dados recebidos:', JSON.stringify(req.body, null, 2));

    const { emailSettings } = req.body;
    const { error, value } = emailSettingsSchema.validate(emailSettings);
    
    if (error) {
      return res.status(400).json({
        error: 'Configurações de e-mail inválidas',
        details: error.details
      });
    }

    // Buscar configurações atuais
    const users = await executeUsersQuery(
      'SELECT config FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const currentConfig = users[0].config;
    let settings = {};
    let oldEmailSettings = null;

    if (currentConfig) {
      settings = typeof currentConfig === 'string' ? JSON.parse(currentConfig) : currentConfig;
      oldEmailSettings = settings.emailSettings;
    }

    // NOVA FUNCIONALIDADE: Atualizar e-mails na tabela 'clientes' baseado no cli_access
    try {
      // Atualizar e-mail principal
      const oldPrimaryEmail = oldEmailSettings?.primaryEmail;
      const newPrimaryEmail = value.primaryEmail;
      
      if (oldPrimaryEmail !== newPrimaryEmail) {
        await clientEmailService.updateUserPrimaryEmail(req.user.id, oldPrimaryEmail, newPrimaryEmail);
        console.log(`✅ E-mail principal atualizado na tabela clientes: ${oldPrimaryEmail} → ${newPrimaryEmail}`);
      }
      
      // Atualizar e-mails em cópia
      const oldCcEmails = oldEmailSettings?.ccEmails || [];
      const newCcEmails = value.ccEmails || [];
      
      await clientEmailService.updateUserCcEmails(req.user.id, oldCcEmails, newCcEmails);
      console.log(`✅ E-mails em cópia atualizados na tabela clientes`);
      
    } catch (clientEmailError) {
      console.error('⚠️ Erro ao atualizar e-mails na tabela clientes:', clientEmailError.message);
      // Não falha a operação principal se houver erro na atualização da tabela clientes
    }

    // Atualizar apenas configurações de e-mail
    settings.emailSettings = value;

    console.log('📤 Salvando configurações de e-mail:', JSON.stringify(settings, null, 2));

    await executeUsersQuery(
      'UPDATE users SET config = ? WHERE id = ?',
      [JSON.stringify(settings), req.user.id]
    );

    res.json({
      message: 'Configurações de e-mail atualizadas com sucesso',
      emailSettings: value
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configurações de e-mail:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Atualizar apenas configurações de interface
router.patch('/ui', async (req, res) => {
  try {
    console.log('📥 PATCH /user-settings/ui - Dados recebidos:', JSON.stringify(req.body, null, 2));

    const { uiSettings } = req.body;
    const { error, value } = uiSettingsSchema.validate(uiSettings);
    
    if (error) {
      return res.status(400).json({
        error: 'Configurações de interface inválidas',
        details: error.details
      });
    }

    // Buscar configurações atuais
    const users = await executeUsersQuery(
      'SELECT config FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const currentConfig = users[0].config;
    let settings = {};

    if (currentConfig) {
      settings = typeof currentConfig === 'string' ? JSON.parse(currentConfig) : currentConfig;
    }

    // Atualizar apenas configurações de interface
    settings.uiSettings = value;

    console.log('📤 Salvando configurações de interface:', JSON.stringify(settings, null, 2));

    await executeUsersQuery(
      'UPDATE users SET config = ? WHERE id = ?',
      [JSON.stringify(settings), req.user.id]
    );

    res.json({
      message: 'Configurações de interface atualizadas com sucesso',
      uiSettings: value
    });

  } catch (error) {
    console.error('❌ Erro ao atualizar configurações de interface:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Resetar configurações para padrão
router.delete('/', async (req, res) => {
  try {
    console.log('📥 DELETE /user-settings - Resetando configurações do usuário:', req.user.id);

    await executeUsersQuery(
      'UPDATE users SET config = NULL WHERE id = ?',
      [req.user.id]
    );

    res.json({
      message: 'Configurações resetadas para o padrão com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao resetar configurações:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Testar configurações de e-mail
router.post('/test-email', async (req, res) => {
  try {
    console.log('📥 POST /user-settings/test-email - Usuário:', req.user.id);

    // Buscar configurações de e-mail do usuário
    const users = await executeUsersQuery(
      'SELECT config FROM users WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        error: 'Usuário não encontrado'
      });
    }

    const userConfig = users[0].config;
    if (!userConfig) {
      return res.json({
        message: 'Teste de e-mail pulado - nenhuma configuração de e-mail definida',
        skipped: true,
        reason: 'Usuário não possui configurações de e-mail'
      });
    }

    const config = typeof userConfig === 'string' ? JSON.parse(userConfig) : userConfig;
    const emailSettings = config.emailSettings;

    if (!emailSettings || !emailSettings.primaryEmail || emailSettings.primaryEmail.trim() === '') {
      return res.json({
        message: 'Teste de e-mail pulado - e-mail principal não configurado',
        skipped: true,
        reason: 'E-mail principal não configurado'
      });
    }

    // Preparar lista de destinatários
    const recipients = [emailSettings.primaryEmail];
    if (emailSettings.ccEmails && Array.isArray(emailSettings.ccEmails)) {
      recipients.push(...emailSettings.ccEmails);
    }

    console.log('📤 Enviando e-mail de teste para:', recipients.join(', '));

    // Enviar e-mail de teste
    const result = await emailService.sendTestEmail(recipients);

    if (result.success) {
      if (result.skipped) {
        console.log('ℹ️ Teste de e-mail pulado');
        res.json({
          message: result.reason || 'Teste de e-mail pulado',
          skipped: true,
          reason: result.reason
        });
      } else {
        console.log('✅ E-mail de teste enviado com sucesso');
        res.json({
          message: 'E-mail de teste enviado com sucesso',
          recipients: result.recipients,
          messageId: result.messageId
        });
      }
    } else {
      console.error('❌ Falha ao enviar e-mail de teste:', result.error);
      res.status(500).json({
        error: 'Falha ao enviar e-mail de teste',
        details: result.error
      });
    }

  } catch (error) {
    console.error('❌ Erro ao testar e-mail:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Verificar conectividade SMTP
router.get('/smtp-status', async (req, res) => {
  try {
    console.log('📥 GET /user-settings/smtp-status - Verificando conectividade SMTP');

    const isConnected = await emailService.verifyConnection();

    res.json({
      connected: isConnected,
      message: isConnected ? 'Conexão SMTP funcionando' : 'Falha na conexão SMTP'
    });

  } catch (error) {
    console.error('❌ Erro ao verificar SMTP:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint de teste para verificar a funcionalidade de e-mails de clientes
router.get('/test-client-emails', async (req, res) => {
  try {
    console.log('📥 GET /user-settings/test-client-emails - Testando funcionalidade de e-mails de clientes');

    // Buscar todos os e-mails dos clientes do usuário
    const clientEmails = await clientEmailService.getAllUserClientEmails(req.user.id);
    
    // Buscar configurações atuais do usuário
    const users = await executeUsersQuery(
      'SELECT config, cli_access FROM users WHERE id = ?',
      [req.user.id]
    );
    
    let userSettings = null;
    let cliAccessData = null;
    
    if (users.length > 0) {
      const userConfig = users[0].config;
      if (userConfig) {
        userSettings = typeof userConfig === 'string' ? JSON.parse(userConfig) : userConfig;
      }
      
      const cliAccess = users[0].cli_access;
      if (cliAccess) {
        cliAccessData = typeof cliAccess === 'string' ? JSON.parse(cliAccess) : cliAccess;
      }
    }

    res.json({
      userId: req.user.id,
      userName: req.user.user,
      clientEmails: clientEmails,
      totalClientEmails: clientEmails.length,
      userEmailSettings: userSettings?.emailSettings || null,
      cliAccess: Object.keys(cliAccessData || {}),
      message: 'Teste da funcionalidade de e-mails de clientes executado com sucesso'
    });

  } catch (error) {
    console.error('❌ Erro ao testar funcionalidade de e-mails de clientes:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

module.exports = router; 