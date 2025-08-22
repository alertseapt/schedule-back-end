const emailService = require('../services/emailService');
const clientEmailService = require('../services/clientEmailService');

/**
 * Script para testar o envio de e-mail em todas as alterações de status
 */
async function testAllStatusEmails() {
  try {
    const targetCnpj = '10584607000110';
    
    console.log('🔍 Testando envio de e-mail para TODAS as alterações de status...\n');
    
    // Dados básicos do agendamento de teste
    const baseScheduleData = {
      id: 88888,
      client: targetCnpj,
      client_cnpj: targetCnpj,
      supplier: 'Fornecedor Teste',
      date: '2025-08-23',
      time: '10:00',
      info: 'Teste completo de status',
      client_info: {
        cnpj: targetCnpj,
        name: `Cliente ${targetCnpj}`,
        number: targetCnpj,
        source: 'test'
      }
    };

    // Lista de status para testar
    const statusTests = [
      {
        scenario: 'Criação de agendamento',
        oldStatus: null,
        newStatus: 'Solicitado',
        comment: 'Agendamento criado no sistema'
      },
      {
        scenario: 'Alteração para Contestado',
        oldStatus: 'Solicitado',
        newStatus: 'Contestado',
        comment: 'Cliente contestou o agendamento'
      },
      {
        scenario: 'Alteração para Agendado',
        oldStatus: 'Contestado',
        newStatus: 'Agendado',
        comment: 'Agendamento confirmado e data definida'
      },
      {
        scenario: 'Alteração para Conferência',
        oldStatus: 'Agendado',
        newStatus: 'Conferência',
        comment: 'Entrada em processo de conferência'
      },
      {
        scenario: 'Alteração para Em estoque',
        oldStatus: 'Conferência',
        newStatus: 'Em estoque',
        comment: 'Mercadoria conferida e armazenada'
      },
      {
        scenario: 'Alteração para Faturado',
        oldStatus: 'Em estoque',
        newStatus: 'Faturado',
        comment: 'Agendamento faturado com sucesso'
      }
    ];

    console.log('📧 Verificando e-mails disponíveis para o CNPJ...');
    const clientEmails = await clientEmailService.getClientEmails(targetCnpj);
    console.log('E-mails encontrados:', clientEmails);
    
    if (clientEmails.length === 0) {
      console.log('⚠️ Nenhum e-mail encontrado. Teste abortado.');
      return;
    }

    console.log('\n🔄 Testando todos os cenários de alteração de status...\n');

    for (let i = 0; i < statusTests.length; i++) {
      const test = statusTests[i];
      
      console.log(`\n=== 📝 Cenário ${i + 1}: ${test.scenario} ===`);
      console.log(`${test.oldStatus || 'CRIAÇÃO'} → ${test.newStatus}`);
      
      const userId = 1; // ID fictício para teste
      
      const result = await emailService.sendStatusChangeNotification(
        userId,
        baseScheduleData,
        test.oldStatus,
        test.newStatus,
        'Usuário Teste',
        test.comment
      );
      
      console.log('✅ Resultado:', {
        success: result.success,
        recipients: result.recipients,
        messageId: result.messageId ? 'Gerado' : undefined,
        reason: result.reason,
        error: result.error
      });
      
      if (result.success) {
        console.log('🎉 E-mail enviado com sucesso!');
        console.log('📧 Destinatários:', result.recipients);
      } else {
        console.log('❌ Falha no envio:', result.reason || result.error);
      }
      
      // Pequena pausa entre os testes
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n✅ Teste de todos os status concluído!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testAllStatusEmails();
}

module.exports = { testAllStatusEmails };