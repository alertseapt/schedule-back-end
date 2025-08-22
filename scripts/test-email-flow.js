const emailService = require('../services/emailService');
const clientEmailService = require('../services/clientEmailService');

/**
 * Script para testar o fluxo completo de envio de e-mail na criação de agendamentos
 * especificamente para o CNPJ problemático
 */
async function testEmailFlow() {
  try {
    // Testar múltiplos CNPJs
    const testCnpjs = ['10584607000110', '52665923000166', '34258545000386'];
    
    console.log('🔍 Testando fluxo completo de e-mail para múltiplos CNPJs...\n');
    
    for (const targetCnpj of testCnpjs) {
      console.log(`\n=== 🔍 Testando CNPJ: ${targetCnpj} ===`);
      
      // 1. Testar clientEmailService diretamente
      console.log('📧 Buscando e-mails na tabela clientes...');
      const clientEmails = await clientEmailService.getClientEmails(targetCnpj);
      console.log('E-mails encontrados:', clientEmails);
      
      if (clientEmails.length === 0) {
        console.log('⚠️ Nenhum e-mail encontrado para este CNPJ');
        continue;
      }
      
      // 2. Simular dados de agendamento como seriam criados
      const mockScheduleData = {
        id: 99900 + testCnpjs.indexOf(targetCnpj),
        client: targetCnpj,
        client_cnpj: targetCnpj,
        supplier: 'Fornecedor Teste',
        date: '2025-08-23',
        time: '10:00',
        info: 'Teste de e-mail',
        client_info: {
          cnpj: targetCnpj,
          name: `Cliente ${targetCnpj}`,
          number: targetCnpj,
          source: 'test'
        }
      };
      
      // 3. Simular envio de e-mail de criação (ID de usuário fictício)
      console.log('📤 Testando envio de e-mail de criação...');
      const userId = 1; // ID fictício para teste
      
      const result = await emailService.sendStatusChangeNotification(
        userId,
        mockScheduleData,
        null, // oldStatus = null para criação
        'Solicitado',
        'Usuário Teste',
        'Agendamento criado via script de teste'
      );
      
      console.log('✅ Resultado:', result);
      
      if (result.success) {
        console.log('🎉 E-mail enviado com sucesso!');
        console.log('📧 Destinatários:', result.recipients);
        console.log('📨 Message ID:', result.messageId);
      } else {
        console.log('❌ Falha no envio:', result.reason || result.error);
      }
    }
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    console.log('\n✅ Teste concluído!');
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testEmailFlow();
}

module.exports = { testEmailFlow };