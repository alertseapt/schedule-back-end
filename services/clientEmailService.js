const { executeCobrancasQuery, executeUsersQuery } = require('../config/database');

/**
 * Serviço para gerenciar e-mails de clientes na tabela 'clientes' do banco 'dbcobrancas'
 */
class ClientEmailService {
  
  /**
   * Busca os e-mails de um cliente específico na tabela 'clientes'
   * @param {string} cnpj - CNPJ do cliente
   * @returns {Array<string>} - Lista de e-mails do cliente
   */
  async getClientEmails(cnpj) {
    try {
      console.log('📧 [CLIENT-EMAIL] Buscando e-mails para CNPJ:', cnpj);
      
      const results = await executeCobrancasQuery(
        'SELECT email FROM clientes WHERE cnpj = ?',
        [cnpj]
      );
      
      console.log('📧 [CLIENT-EMAIL] Resultado da query:', {
        cnpj,
        resultCount: results.length,
        results: results
      });
      
      if (results.length === 0) {
        console.log('📧 [CLIENT-EMAIL] Nenhum resultado encontrado para CNPJ:', cnpj);
        return [];
      }
      
      const emailsString = results[0].email;
      console.log('📧 [CLIENT-EMAIL] String de e-mails encontrada:', emailsString);
      
      if (!emailsString || emailsString.trim() === '') {
        console.log('📧 [CLIENT-EMAIL] String de e-mails vazia ou nula');
        return [];
      }
      
      // Separar os e-mails por ponto e vírgula e limpar espaços
      const emails = emailsString.split(';')
        .map(email => email.trim())
        .filter(email => email !== '');
      
      console.log('📧 [CLIENT-EMAIL] E-mails processados:', emails);
      
      return emails;
    } catch (error) {
      console.error('Erro ao buscar e-mails do cliente:', error);
      return [];
    }
  }
  
  /**
   * Busca todos os e-mails dos clientes aos quais o usuário tem acesso
   * @param {string} userId - ID do usuário
   * @returns {Array<string>} - Lista de todos os e-mails dos clientes do usuário
   */
  async getAllUserClientEmails(userId) {
    try {
      // Buscar cli_access do usuário
      const users = await executeUsersQuery(
        'SELECT cli_access FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return [];
      }
      
      const cliAccess = users[0].cli_access;
      if (!cliAccess) {
        return [];
      }
      
      const cliAccessData = typeof cliAccess === 'string' ? JSON.parse(cliAccess) : cliAccess;
      const cnpjList = Object.keys(cliAccessData);
      
      if (cnpjList.length === 0) {
        return [];
      }
      
      // Buscar e-mails de todos os CNPJs do usuário
      const placeholders = cnpjList.map(() => '?').join(',');
      const results = await executeCobrancasQuery(
        `SELECT email FROM clientes WHERE cnpj IN (${placeholders})`,
        cnpjList
      );
      
      const allEmails = new Set(); // Usar Set para evitar duplicatas
      
      for (const result of results) {
        const emailsString = result.email;
        if (emailsString && emailsString.trim() !== '') {
          const emails = emailsString.split(';')
            .map(email => email.trim())
            .filter(email => email !== '');
          
          emails.forEach(email => allEmails.add(email));
        }
      }
      
      return Array.from(allEmails);
    } catch (error) {
      console.error('Erro ao buscar todos os e-mails dos clientes do usuário:', error);
      return [];
    }
  }
  
  /**
   * Atualiza os e-mails de um cliente específico
   * @param {string} cnpj - CNPJ do cliente
   * @param {Array<string>} emails - Lista de e-mails para o cliente
   */
  async updateClientEmails(cnpj, emails) {
    try {
      const emailsString = emails.join(';');
      
      // Verificar se o cliente existe
      const existingClients = await executeCobrancasQuery(
        'SELECT id FROM clientes WHERE cnpj = ?',
        [cnpj]
      );
      
      if (existingClients.length === 0) {
        // Cliente não existe, criar um novo registro
        await executeCobrancasQuery(
          'INSERT INTO clientes (cnpj, email) VALUES (?, ?)',
          [cnpj, emailsString]
        );
      } else {
        // Cliente existe, atualizar os e-mails
        await executeCobrancasQuery(
          'UPDATE clientes SET email = ? WHERE cnpj = ?',
          [emailsString, cnpj]
        );
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao atualizar e-mails do cliente:', error);
      return false;
    }
  }
  
  /**
   * Adiciona um e-mail aos clientes aos quais o usuário tem acesso
   * @param {string} userId - ID do usuário
   * @param {string} email - E-mail a ser adicionado
   */
  async addEmailToUserClients(userId, email) {
    try {
      // Buscar cli_access do usuário
      const users = await executeUsersQuery(
        'SELECT cli_access FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return false;
      }
      
      const cliAccess = users[0].cli_access;
      if (!cliAccess) {
        return false;
      }
      
      const cliAccessData = typeof cliAccess === 'string' ? JSON.parse(cliAccess) : cliAccess;
      const cnpjList = Object.keys(cliAccessData);
      
      // Para cada CNPJ do usuário, adicionar o e-mail se não existir
      for (const cnpj of cnpjList) {
        const currentEmails = await this.getClientEmails(cnpj);
        
        // Verificar se o e-mail já existe
        if (!currentEmails.includes(email)) {
          const updatedEmails = [...currentEmails, email];
          await this.updateClientEmails(cnpj, updatedEmails);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao adicionar e-mail aos clientes do usuário:', error);
      return false;
    }
  }
  
  /**
   * Remove um e-mail dos clientes aos quais o usuário tem acesso
   * @param {string} userId - ID do usuário
   * @param {string} email - E-mail a ser removido
   */
  async removeEmailFromUserClients(userId, email) {
    try {
      // Buscar cli_access do usuário
      const users = await executeUsersQuery(
        'SELECT cli_access FROM users WHERE id = ?',
        [userId]
      );
      
      if (users.length === 0) {
        return false;
      }
      
      const cliAccess = users[0].cli_access;
      if (!cliAccess) {
        return false;
      }
      
      const cliAccessData = typeof cliAccess === 'string' ? JSON.parse(cliAccess) : cliAccess;
      const cnpjList = Object.keys(cliAccessData);
      
      // Para cada CNPJ do usuário, remover o e-mail se existir
      for (const cnpj of cnpjList) {
        const currentEmails = await this.getClientEmails(cnpj);
        
        // Verificar se o e-mail existe
        if (currentEmails.includes(email)) {
          const updatedEmails = currentEmails.filter(e => e !== email);
          await this.updateClientEmails(cnpj, updatedEmails);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao remover e-mail dos clientes do usuário:', error);
      return false;
    }
  }
  
  /**
   * Atualiza o e-mail principal do usuário nos clientes
   * Remove o e-mail antigo e adiciona o novo e-mail
   * @param {string} userId - ID do usuário
   * @param {string} oldEmail - E-mail anterior
   * @param {string} newEmail - Novo e-mail
   */
  async updateUserPrimaryEmail(userId, oldEmail, newEmail) {
    try {
      // Remover o e-mail antigo se existir
      if (oldEmail && oldEmail.trim() !== '') {
        await this.removeEmailFromUserClients(userId, oldEmail);
      }
      
      // Adicionar o novo e-mail se existir
      if (newEmail && newEmail.trim() !== '') {
        await this.addEmailToUserClients(userId, newEmail);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao atualizar e-mail principal do usuário:', error);
      return false;
    }
  }
  
  /**
   * Atualiza os e-mails em cópia do usuário nos clientes
   * @param {string} userId - ID do usuário
   * @param {Array<string>} oldEmails - E-mails anteriores
   * @param {Array<string>} newEmails - Novos e-mails
   */
  async updateUserCcEmails(userId, oldEmails, newEmails) {
    try {
      const oldEmailsSet = new Set(oldEmails || []);
      const newEmailsSet = new Set(newEmails || []);
      
      // E-mails para remover (existem em oldEmails mas não em newEmails)
      const emailsToRemove = [...oldEmailsSet].filter(email => !newEmailsSet.has(email));
      
      // E-mails para adicionar (existem em newEmails mas não em oldEmails)
      const emailsToAdd = [...newEmailsSet].filter(email => !oldEmailsSet.has(email));
      
      // Remover e-mails antigos
      for (const email of emailsToRemove) {
        await this.removeEmailFromUserClients(userId, email);
      }
      
      // Adicionar novos e-mails
      for (const email of emailsToAdd) {
        await this.addEmailToUserClients(userId, email);
      }
      
      return true;
    } catch (error) {
      console.error('Erro ao atualizar e-mails em cópia do usuário:', error);
      return false;
    }
  }
}

// Instância singleton
const clientEmailService = new ClientEmailService();

module.exports = clientEmailService;