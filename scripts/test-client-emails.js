const { executeCobrancasQuery } = require('../config/database');
const clientEmailService = require('../services/clientEmailService');

/**
 * Script para testar a funcionalidade de e-mails de clientes
 */
async function testClientEmails() {
  try {
    console.log('🧪 Iniciando teste de e-mails de clientes...');
    
    // 1. Verificar estrutura da tabela clientes
    console.log('\n📊 Verificando estrutura da tabela clientes...');
    const tableStructure = await executeCobrancasQuery('DESCRIBE clientes');
    console.log('Estrutura da tabela:', tableStructure);
    
    // 2. Verificar se existem dados na tabela
    console.log('\n📋 Verificando dados existentes...');
    const existingData = await executeCobrancasQuery('SELECT cnpj, email FROM clientes LIMIT 5');
    console.log('Dados existentes (primeiros 5):', existingData);
    
    // 3. Testar busca de e-mails com dados existentes
    console.log('\n🔍 Testando busca de e-mails com dados existentes...');
    const testCnpj = '52665923000166'; // Usar um CNPJ que existe
    const emails = await clientEmailService.getClientEmails(testCnpj);
    console.log(`E-mails encontrados para ${testCnpj}:`, emails);
    
    // 5. Testar com CNPJs que não existem
    console.log('\n❌ Testando CNPJ inexistente...');
    const noEmails = await clientEmailService.getClientEmails('99999999999999');
    console.log('E-mails para CNPJ inexistente:', noEmails);
    
    console.log('\n🎉 Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  } finally {
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  testClientEmails();
}

module.exports = { testClientEmails };