const express = require('express');
const emailService = require('../services/emailService');
const Joi = require('joi');

const router = express.Router();

// Schema de validação para teste de e-mail
const testEmailSchema = Joi.object({
  recipients: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email()).min(1)
  ).required(),
  type: Joi.string().valid('simple', 'notification').default('simple')
});

// Schema para teste de notificação
const testNotificationSchema = Joi.object({
  recipients: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email()).min(1)
  ).required(),
  scheduleData: Joi.object({
    id: Joi.number().default(1),
    number: Joi.string().default("123456"),
    nfe_key: Joi.string().default("12345678901234567890123456789012345678901234"),
    client: Joi.string().default("12345678000100"),
    case_count: Joi.number().default(15),
    date: Joi.string().default("2025-01-24"),
    supplier: Joi.string().default("Fornecedor Teste Ltda"),
    qt_prod: Joi.number().default(50)
  }).default(),
  oldStatus: Joi.string().default('Solicitado'),
  newStatus: Joi.string().default('Agendado'),
  user: Joi.string().default('admin_teste'),
  comment: Joi.string().default('Teste do sistema de e-mail')
});

/**
 * POST /api/email-test/simple
 * Enviar e-mail de teste simples (baseado no arquivo Python)
 */
router.post('/simple', async (req, res) => {
  try {
    console.log('📥 POST /email-test/simple - Dados recebidos:', JSON.stringify(req.body, null, 2));

    const { error, value } = testEmailSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.details
      });
    }

    const { recipients } = value;
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    console.log('📤 Enviando e-mail de teste para:', recipientList.join(', '));

    // Enviar e-mail de teste
    const result = await emailService.sendTestEmail(recipientList);

    if (result.success) {
      if (result.skipped) {
        console.log('ℹ️ Teste de e-mail pulado - nenhum destinatário configurado');
        res.json({
          message: 'Teste de e-mail pulado - nenhum destinatário configurado',
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
    console.error('❌ Erro ao enviar e-mail de teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/email-test/notification
 * Enviar e-mail de notificação de alteração de status (teste)
 */
router.post('/notification', async (req, res) => {
  try {
    console.log('📥 POST /email-test/notification - Dados recebidos:', JSON.stringify(req.body, null, 2));

    const { error, value } = testNotificationSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Dados inválidos',
        details: error.details
      });
    }

    const { recipients, scheduleData, oldStatus, newStatus, user, comment } = value;
    const recipientList = Array.isArray(recipients) ? recipients : [recipients];

    console.log('📤 Enviando notificação de teste para:', recipientList.join(', '));
    console.log(`   Status: ${oldStatus} → ${newStatus}`);

    // Gerar template HTML
    const htmlBody = emailService.generateStatusChangeTemplate(
      scheduleData,
      oldStatus,
      newStatus,
      user,
      comment
    );

    // Configurar e-mail
    const senderEmail = process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || 'no-reply@mercocamptech.com.br';
    const senderName = process.env.SMTP_SENDER_NAME || 'Sistema de Agendamentos';
    
    const mailOptions = {
      from: `"${senderName}" <${senderEmail}>`,
      to: recipientList.join(', '),
      subject: `Agendamento ${scheduleData.number} - Status alterado para ${newStatus}`,
      html: htmlBody
    };

    // Enviar e-mail
    const info = await emailService.transporter.sendMail(mailOptions);

    console.log('✅ Notificação de teste enviada com sucesso!');
    console.log(`   Message ID: ${info.messageId}`);

    res.json({
      message: 'Notificação de teste enviada com sucesso',
      recipients: recipientList,
      messageId: info.messageId,
      statusChange: `${oldStatus} → ${newStatus}`,
      scheduleNumber: scheduleData.number
    });

  } catch (error) {
    console.error('❌ Erro ao enviar notificação de teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      details: error.message
    });
  }
});

/**
 * GET /api/email-test/smtp-status
 * Verificar status da conexão SMTP
 */
router.get('/smtp-status', async (req, res) => {
  try {
    console.log('📥 GET /email-test/smtp-status - Verificando conectividade SMTP');

    const isConnected = await emailService.verifyConnection();

    res.json({
      connected: isConnected,
      message: isConnected ? 'Conexão SMTP funcionando' : 'Falha na conexão SMTP',
      config: {
        host: process.env.SMTP_SERVER || 'smtp.hostinger.com',
        port: process.env.SMTP_PORT || 587,
        user: process.env.SMTP_USER || 'no-reply@mercocamptech.com.br',
        secure: false
      }
    });

  } catch (error) {
    console.error('❌ Erro ao verificar SMTP:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/email-test/template-preview
 * Visualizar template HTML de notificação
 */
router.get('/template-preview', (req, res) => {
  try {
    console.log('📥 GET /email-test/template-preview - Gerando preview do template');

    const mockScheduleData = {
      id: 1,
      number: "123456",
      nfe_key: "12345678901234567890123456789012345678901234",
      client: "12345678000100",
      case_count: 15,
      date: "2025-01-24",
      supplier: "Fornecedor Exemplo Ltda",
      qt_prod: 50
    };

    const htmlTemplate = emailService.generateStatusChangeTemplate(
      mockScheduleData,
      'Solicitado',
      'Agendado',
      'admin_preview',
      'Preview do template de e-mail'
    );

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlTemplate);

  } catch (error) {
    console.error('❌ Erro ao gerar preview:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * GET /api/email-test/test-template-preview
 * Visualizar template HTML de teste simples
 */
router.get('/test-template-preview', (req, res) => {
  try {
    console.log('📥 GET /email-test/test-template-preview - Gerando preview do template de teste');

    const htmlTemplate = emailService.generateTestTemplate();

    res.setHeader('Content-Type', 'text/html');
    res.send(htmlTemplate);

  } catch (error) {
    console.error('❌ Erro ao gerar preview de teste:', error);
    res.status(500).json({
      error: 'Erro interno do servidor'
    });
  }
});

module.exports = router; 