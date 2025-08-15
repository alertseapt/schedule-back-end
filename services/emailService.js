const nodemailer = require('nodemailer');
const { executeUsersQuery } = require('../config/database');

/**
 * Serviço de E-mail baseado no arquivo Python fornecido
 * Envia notificações de alteração de status de agendamentos
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializa o transportador SMTP com configurações do ambiente
   */
  initializeTransporter() {
    const smtpConfig = {
      host: process.env.SMTP_SERVER || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false, // true para 465, false para outros
      auth: {
        user: process.env.SMTP_USER || 'no-reply@mercocamptech.com.br',
        pass: process.env.SMTP_PASSWORD || 'Mercocamp.2025'
      },
      tls: {
        ciphers: 'SSLv3'
      }
    };

    this.transporter = nodemailer.createTransport(smtpConfig);

  }

  /**
   * Gera template HTML para notificação de alteração de status
   * @param {Object} scheduleData - Dados do agendamento
   * @param {string} oldStatus - Status anterior
   * @param {string} newStatus - Status atual
   * @param {string} user - Usuário que fez a alteração
   * @param {string} comment - Comentário da alteração
   */
  async generateStatusChangeTemplate(scheduleData, oldStatus, newStatus, user, comment) {
    const isCreation = oldStatus === null || oldStatus === undefined;
    const statusColors = {
      'Solicitado': '#17a2b8',
      'Contestado': '#ffc107', 
      'Agendado': '#28a745',
      'Conferência': '#6f42c1',
      'Tratativa': '#fd7e14',
      'Estoque': '#20c997',
      'Recusar': '#dc3545',
      'Cancelar': '#ffc107',
      'Recusado': '#dc3545',
      'Cancelado': '#6c757d'
    };

    const formatDate = (dateStr) => {
      if (!dateStr) return 'Não informada';
      const date = new Date(dateStr);
      return date.toLocaleDateString('pt-BR');
    };

    const warehouseInfo = await this.getWarehouseInfo(scheduleData);

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Alteração de Status - Agendamento</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                color: #333; 
                background-color: #f8f9fc;
                line-height: 1.6;
            }
            .container { 
                max-width: 650px; 
                margin: auto; 
                border: none; 
                border-radius: 12px; 
                overflow: hidden; 
                background: #ffffff; 
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: #fff; 
                padding: 30px 20px;
                text-align: center;
            }
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            .header .subtitle {
                margin: 8px 0 0 0;
                font-size: 14px;
                opacity: 0.9;
            }
            .content { 
                padding: 30px;
            }
            .status-section {
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
                border-left: 5px solid #667eea;
                padding: 20px;
                margin: 25px 0;
                border-radius: 0 8px 8px 0;
                box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            }
            .status-section h3 {
                margin: 0 0 15px 0;
                color: #495057;
                font-size: 18px;
            }
            .status-change {
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 20px 0;
                flex-wrap: wrap;
                gap: 15px;
            }
            .status-badge {
                display: inline-flex;
                align-items: center;
                padding: 8px 16px;
                border-radius: 25px;
                color: white;
                font-weight: 600;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .status-arrow {
                font-size: 20px;
                color: #667eea;
                margin: 0 10px;
                font-weight: bold;
            }
            .current-status {
                background: #28a745;
                animation: pulse 2s infinite;
            }
            @keyframes pulse {
                0% { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                50% { box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3); }
                100% { box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            }
            .user-info {
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                padding: 12px 16px;
                border-radius: 8px;
                margin: 15px 0;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .user-info .icon {
                font-size: 16px;
                color: #856404;
            }
            .schedule-info {
                background: #ffffff;
                border: 1px solid #e9ecef;
                border-radius: 10px;
                padding: 25px;
                margin: 25px 0;
                box-shadow: 0 1px 3px rgba(0,0,0,0.02);
            }
            .schedule-info h3 {
                margin: 0 0 20px 0;
                color: #495057;
                font-size: 18px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }
            .info-item {
                padding: 12px 0;
                border-bottom: 1px solid #f8f9fa;
            }
            .info-item:last-child {
                border-bottom: none;
            }
            .info-label {
                font-weight: 600;
                color: #6c757d;
                font-size: 13px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 4px;
            }
            .info-value {
                color: #495057;
                font-size: 15px;
                font-weight: 500;
            }
            .cta-section {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px;
                border-radius: 10px;
                text-align: center;
                margin: 25px 0;
            }
            .cta-button {
                display: inline-block;
                background: rgba(255,255,255,0.2);
                color: white;
                padding: 12px 30px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: 600;
                margin-top: 15px;
                transition: all 0.3s ease;
                border: 2px solid rgba(255,255,255,0.3);
            }
            .cta-button:hover {
                background: rgba(255,255,255,0.3);
                transform: translateY(-2px);
            }
            .timestamp {
                color: #6c757d;
                font-size: 13px;
                margin-top: 20px;
                text-align: center;
                font-style: italic;
            }
            .footer { 
                background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); 
                padding: 25px; 
                text-align: center; 
                font-size: 13px; 
                color: #6c757d; 
                border-top: 1px solid #dee2e6; 
            }
            .footer .company-info {
                margin-bottom: 10px;
                font-weight: 600;
                color: #495057;
            }
            .footer .disclaimer {
                font-size: 12px;
                opacity: 0.8;
            }
            @media (max-width: 600px) {
                .container { margin: 10px; border-radius: 8px; }
                .content { padding: 20px; }
                .info-grid { grid-template-columns: 1fr; }
                .status-change { flex-direction: column; }
                .status-arrow { transform: rotate(90deg); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>${isCreation ? '📋 Novo Agendamento' : '📋 Alteração de Status'}</h1>
                <div class="subtitle">Agendamento #${scheduleData.id}</div>
            </div>
            
            <div class="content">
                <div class="status-section">
                    <h3>${isCreation ? '✨ Status Inicial' : '🔄 Mudança de Status'}</h3>
                    <div class="status-change">
                        ${!isCreation ? `
                        <span class="status-badge" style="background-color: ${statusColors[oldStatus] || '#6c757d'}">
                            ${oldStatus}
                        </span>
                        <span class="status-arrow">→</span>
                        ` : ''}
                        <span class="status-badge current-status" style="background-color: ${statusColors[newStatus] || '#6c757d'}">
                            ✓ ${newStatus}
                        </span>
                    </div>
                    
                    <div class="user-info">
                        <span class="icon">👤</span>
                        <div>
                            <strong>${isCreation ? 'Criado por:' : 'Alterado por:'}</strong> ${user}<br>
                            <small>Status atual: <strong>${newStatus}</strong></small>
                        </div>
                    </div>
                    
                    ${comment ? `
                    <div style="background: #e7f3ff; border: 1px solid #b3d9ff; padding: 12px 16px; border-radius: 8px; margin-top: 15px;">
                        <strong>💬 Comentário:</strong><br>
                        <strong>${comment}</strong>
                    </div>
                    ` : ''}
                </div>

                <div class="schedule-info">
                    <h3>📦 Detalhes do Agendamento</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <div class="info-label">ID Agendamento</div>
                            <div class="info-value">${scheduleData.id || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Número da NF</div>
                            <div class="info-value">${scheduleData.number || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Estoque</div>
                            <div class="info-value">${warehouseInfo}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Data de Entrega</div>
                            <div class="info-value">${formatDate(scheduleData.date)}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Volumes</div>
                            <div class="info-value">${scheduleData.case_count || 0}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Fornecedor</div>
                            <div class="info-value">${scheduleData.supplier || 'N/A'}</div>
                        </div>
                        <div class="info-item">
                            <div class="info-label">Chave NFe</div>
                            <div class="info-value" style="font-size: 12px; word-break: break-all;">${scheduleData.nfe_key || 'N/A'}</div>
                        </div>
                    </div>
                </div>

                <div class="cta-section">
                    <h3 style="margin: 0 0 10px 0; font-size: 18px;">🌐 Acesse Nossa Plataforma</h3>
                    <p style="margin: 0 0 15px 0; opacity: 0.9;">Gerencie seus agendamentos e acompanhe o status em tempo real</p>
                    <a href="https://mercocamptech.com.br" class="cta-button" style="color: white; text-decoration: none;">
                        🚀 Visitar MercoCamp Tech
                    </a>
                </div>

                <div class="timestamp">
                    📅 Notificação enviada em: ${new Date().toLocaleString('pt-BR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
            
            <div class="footer">
                <div class="company-info">📧 Sistema de Agendamentos - Grupo Mercocamp</div>
                <div class="disclaimer">
                    Esta é uma notificação automática, não responda este e-mail.<br>
                    Para suporte: <a href="https://mercocamptech.com.br" style="color: #667eea; text-decoration: none;">mercocamptech.com.br</a>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Formata informações do estoque para exibição no e-mail
   * @param {Object} scheduleData - Dados do agendamento
   * @returns {string} - Informações formatadas do estoque
   */
  async getWarehouseInfo(scheduleData) {
    let warehouseInfo = '';
    const warehouseCnpj = scheduleData.client_cnpj || scheduleData.client;

    // Se já temos client_info, usar essas informações
    if (scheduleData.client_info) {
      const warehouseName = scheduleData.client_info.name;
      const warehouseNumber = scheduleData.client_info.number;
      const warehouseCnpj_info = scheduleData.client_info.cnpj;

      // Montar informação completa: Nome (Nº Número) - CNPJ: xxxxx
      let formattedInfo = '';

      // Adicionar nome se disponível e não for genérico
      if (warehouseName && warehouseName !== `Cliente ${warehouseCnpj}` && warehouseName !== warehouseCnpj) {
        formattedInfo += warehouseName;
      }

      // Adicionar número se disponível e diferente do CNPJ
      if (warehouseNumber && warehouseNumber !== warehouseCnpj && warehouseNumber !== warehouseCnpj_info) {
        if (formattedInfo) {
          formattedInfo += ` (Nº ${warehouseNumber})`;
        } else {
          formattedInfo = `Nº ${warehouseNumber}`;
        }
      }

      // Adicionar CNPJ sempre
      const cnpjToShow = warehouseCnpj_info || warehouseCnpj;
      if (cnpjToShow) {
        // Formatando CNPJ se tiver 14 dígitos
        let formattedCnpj = cnpjToShow;
        if (cnpjToShow.replace(/\D/g, '').length === 14) {
          const cleanCnpj = cnpjToShow.replace(/\D/g, '');
          formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        
        if (formattedInfo) {
          formattedInfo += ` - CNPJ: ${formattedCnpj}`;
        } else {
          formattedInfo = `CNPJ: ${formattedCnpj}`;
        }
      }

      return formattedInfo || `CNPJ: ${warehouseCnpj}`;
    }

    // Se não temos client_info, tentar buscar informações do estoque na tabela wcl (que sabemos que existe)
    try {
      const { executeMercocampQuery } = require('../config/database');
      
      // Limpar CNPJ para busca
      const cleanCnpj = warehouseCnpj ? warehouseCnpj.replace(/\D/g, '') : '';
      
      // Buscar na tabela wcl usando diferentes variações do CNPJ
      const clients = await executeMercocampQuery(
        `SELECT nome_cliente as name, no_seq as number, cnpj_cpf as cnpj 
         FROM wcl 
         WHERE REPLACE(REPLACE(REPLACE(REPLACE(cnpj_cpf, ".", ""), "/", ""), "-", ""), " ", "") = ? 
         OR cnpj_cpf = ?
         LIMIT 1`,
        [cleanCnpj, warehouseCnpj]
      );

      if (clients.length > 0) {
        const client = clients[0];
        let formattedInfo = '';
        
        // Adicionar nome se disponível
        if (client.name && client.name.trim() !== '') {
          formattedInfo += client.name.trim();
        }

        // Adicionar número se disponível e diferente do CNPJ
        if (client.number && client.number !== warehouseCnpj && client.number !== cleanCnpj) {
          if (formattedInfo) {
            formattedInfo += ` (Nº ${client.number})`;
          } else {
            formattedInfo = `Nº ${client.number}`;
          }
        }

        // Adicionar CNPJ formatado
        const cnpjToFormat = client.cnpj || warehouseCnpj;
        if (cnpjToFormat) {
          let formattedCnpj = cnpjToFormat;
          if (cnpjToFormat.replace(/\D/g, '').length === 14) {
            const cnpjNumbers = cnpjToFormat.replace(/\D/g, '');
            formattedCnpj = cnpjNumbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
          }
          
          if (formattedInfo) {
            formattedInfo += ` - CNPJ: ${formattedCnpj}`;
          } else {
            formattedInfo = `CNPJ: ${formattedCnpj}`;
          }
        }

        return formattedInfo || `CNPJ: ${warehouseCnpj}`;
      }
    } catch (error) {
      console.error('❌ Erro ao buscar informações do estoque na tabela wcl:', error);
    }

    // Fallback: retornar apenas CNPJ formatado
    if (warehouseCnpj) {
      let formattedCnpj = warehouseCnpj;
      if (warehouseCnpj.replace(/\D/g, '').length === 14) {
        const cleanCnpj = warehouseCnpj.replace(/\D/g, '');
        formattedCnpj = cleanCnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      }
      return `CNPJ: ${formattedCnpj}`;
    }
    
    return 'Estoque não identificado';
  }

  /**
   * Gera template de teste simples (baseado no arquivo Python)
   */
  generateTestTemplate() {
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                padding: 20px; 
                color: #333; 
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 600px; 
                margin: auto; 
                border: 1px solid #ddd; 
                border-radius: 10px; 
                overflow: hidden; 
                background: #ffffff; 
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header { 
                background: linear-gradient(90deg, #1976d2 0%, #2196f3 100%); 
                color: #fff; 
                padding: 20px;
                text-align: center;
            }
            .content { 
                padding: 30px; 
                text-align: center;
            }
            .test-message {
                font-size: 24px;
                font-weight: bold;
                color: #1976d2;
                margin: 20px 0;
            }
            .timestamp {
                color: #666;
                font-size: 14px;
                margin-top: 20px;
            }
            .footer { 
                background-color: #f8f9fa; 
                padding: 15px; 
                text-align: center; 
                font-size: 12px; 
                color: #666; 
                border-top: 1px solid #e0e0e0; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>E-mail de Teste</h2>
            </div>
            <div class="content">
                <div class="test-message">Teste</div>
                <p>Este é um e-mail de teste enviado pelo sistema.</p>
                <div class="timestamp">
                    Enviado em: ${new Date().toLocaleString('pt-BR')}
                </div>
            </div>
            <div class="footer">
                <p>Sistema de Agendamentos - Grupo Mercocamp</p>
            </div>
        </div>
    </body>
    </html>
    `;

    return html;
  }

  /**
   * Busca configurações de e-mail do usuário
   */
  async getUserEmailSettings(userId) {
    try {
      const users = await executeUsersQuery(
        'SELECT config FROM users WHERE id = ?',
        [userId]
      );

      if (users.length === 0) {
          return null;
      }

      const userConfig = users[0].config;
      if (!userConfig) {
          return null;
      }

      const config = typeof userConfig === 'string' ? JSON.parse(userConfig) : userConfig;
      return config.emailSettings || null;
    } catch (error) {
      console.error('Erro ao buscar configurações de e-mail do usuário:', error);
      return null;
    }
  }

  /**
   * Verifica se deve enviar notificação para um status específico
   */
  shouldSendNotification(emailSettings, status, isCreation = false) {
    // Para criação de agendamentos, sempre enviar se não houver configuração específica
    if (isCreation) {
      if (!emailSettings || !emailSettings.statusNotifications) {
        return true; // Por padrão, enviar notificação de criação
      }
      
      // Se há configuração, verificar se solicitado está habilitado
      return emailSettings.statusNotifications['solicitado'] !== false;
    }

    // Status importantes que sempre devem enviar notificação
    const importantStatuses = ['cancelar', 'cancelado', 'recusado'];
    const statusKey = status.toLowerCase();
    
    if (importantStatuses.includes(statusKey)) {
      return true; // Sempre enviar para status importantes
    }
    
    if (!emailSettings || !emailSettings.statusNotifications) {
      return false;
    }

    return emailSettings.statusNotifications[statusKey] === true;
  }

  /**
   * Envia e-mail de notificação de alteração de status
   */
  async sendStatusChangeNotification(userId, scheduleData, oldStatus, newStatus, user, comment) {
    try {
      const isCreation = oldStatus === null || oldStatus === undefined;

      const emailSettings = await this.getUserEmailSettings(userId);
      
      if (!this.shouldSendNotification(emailSettings, newStatus, isCreation)) {
        return { success: false, reason: `Notificação desabilitada para status ${newStatus}` };
      }

      let recipients = [];
      
      if (emailSettings) {
        if (emailSettings.primaryEmail) {
          recipients.push(emailSettings.primaryEmail);
        }
        
        if (emailSettings.ccEmails && Array.isArray(emailSettings.ccEmails)) {
          recipients.push(...emailSettings.ccEmails);
        }
      }

      if (recipients.length === 0) {
        return { success: true, reason: 'Nenhum e-mail configurado - envio pulado', skipped: true };
      }

      const htmlBody = await this.generateStatusChangeTemplate(scheduleData, oldStatus, newStatus, user, comment);

      const senderEmail = process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || 'no-reply@mercocamptech.com.br';
      const senderName = process.env.SMTP_SENDER_NAME || 'Sistema de Agendamentos';
      
      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: recipients.join(', '),
        subject: isCreation 
          ? `Novo Agendamento #${scheduleData.id} - ${newStatus}`
          : `Agendamento #${scheduleData.id} - Status alterado para ${newStatus}`,
        html: htmlBody
      };

      const info = await this.transporter.sendMail(mailOptions);

      return {
        success: true,
        messageId: info.messageId,
        recipients: recipients
      };

    } catch (error) {
      console.error(`Erro ao enviar e-mail de notificação (ID: ${scheduleData.id}):`, error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Envia e-mail de teste (baseado no arquivo Python)
   */
  async sendTestEmail(recipients) {
    try {
      const recipientList = Array.isArray(recipients) 
        ? recipients 
        : recipients.split(';').map(email => email.trim()).filter(email => email);

      if (recipientList.length === 0) {
        return {
          success: true,
          reason: 'Nenhum destinatário fornecido - teste pulado',
          skipped: true
        };
      }

      const htmlBody = this.generateTestTemplate();

      const senderEmail = process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || 'no-reply@mercocamptech.com.br';
      const senderName = process.env.SMTP_SENDER_NAME || 'Sistema de Agendamentos';
      
      const mailOptions = {
        from: `"${senderName}" <${senderEmail}>`,
        to: recipientList.join(', '),
        subject: 'Teste',
        html: htmlBody
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`E-mail de teste enviado com sucesso - Recipients: ${recipientList.length}`);

      return {
        success: true,
        messageId: info.messageId,
        recipients: recipientList
      };

    } catch (error) {
      console.error('Erro ao enviar e-mail de teste:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verifica conectividade SMTP
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Erro na verificação SMTP:', error);
      return false;
    }
  }
}

// Instância singleton
const emailService = new EmailService();

module.exports = emailService; 