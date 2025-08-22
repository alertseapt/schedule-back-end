const { executeCobrancasQuery } = require('../config/database');
const clientEmailService = require('../services/clientEmailService');

/**
 * Script para debugar um cliente específico
 */
async function debugSpecificClient() {
  try {
    const targetCnpj = '10584607000110';
    
    console.log('🔍 Investigando cliente CNPJ:', targetCnpj);
    
    // 1. Buscar diretamente na tabela clientes
    console.log('\n📋 Buscando diretamente na tabela clientes...');
    const directQuery = await executeCobrancasQuery(
      'SELECT cnpj, email FROM clientes WHERE cnpj = ?',
      [targetCnpj]
    );
    console.log('Resultado direto:', directQuery);
    
    // 2. Buscar com LIKE para ver se há variações
    console.log('\n🔍 Buscando com LIKE para variações...');
    const likeQuery = await executeCobrancasQuery(
      'SELECT cnpj, email FROM clientes WHERE cnpj LIKE ?',
      [`%${targetCnpj}%`]
    );
    console.log('Resultados similares:', likeQuery);
    
    // 3. Testar com clientEmailService
    console.log('\n📧 Testando com clientEmailService...');
    const emails = await clientEmailService.getClientEmails(targetCnpj);
    console.log('E-mails retornados pelo service:', emails);
    
    // 4. Verificar se existe com CNPJ limpo (apenas números)
    const cleanCnpj = targetCnpj.replace(/[^\d]/g, '');
    console.log('\n🧹 Testando com CNPJ limpo:', cleanCnpj);
    const cleanQuery = await executeCobrancasQuery(
      'SELECT cnpj, email FROM clientes WHERE REPLACE(REPLACE(REPLACE(cnpj, ".", ""), "/", ""), "-", "") = ?',
      [cleanCnpj]
    );
    console.log('Resultado com CNPJ limpo:', cleanQuery);
    
    // 5. Listar alguns CNPJs para comparar formato
    console.log('\n📊 Amostra de formatos de CNPJ na tabela...');
    const sampleQuery = await executeCobrancasQuery(
      'SELECT cnpj FROM clientes LIMIT 10'
    );
    console.log('Formatos de CNPJ encontrados:', sampleQuery.map(r => r.cnpj));
    
    console.log('\n✅ Investigação concluída!');
    
  } catch (error) {
    console.error('❌ Erro durante a investigação:', error);
  } finally {
    process.exit(0);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  debugSpecificClient();
}

module.exports = { debugSpecificClient };