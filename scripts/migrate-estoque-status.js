const { executeCheckinQuery } = require('../config/database');

/**
 * Script para migrar o status 'Estoque' para 'Em estoque' nos registros existentes
 */
async function migrateEstoqueStatus() {
  try {
    console.log('🔄 Iniciando migração do status "Estoque" para "Em estoque"...');
    
    // Buscar todos os agendamentos com status 'Estoque'
    const schedulesWithEstoque = await executeCheckinQuery(
      'SELECT id, status FROM schedule_list WHERE status = ?',
      ['Estoque']
    );
    
    console.log(`📊 Encontrados ${schedulesWithEstoque.length} agendamento(s) com status "Estoque"`);
    
    if (schedulesWithEstoque.length === 0) {
      console.log('✅ Nenhum registro para migrar.');
      return;
    }
    
    // Atualizar todos os registros
    const result = await executeCheckinQuery(
      'UPDATE schedule_list SET status = ? WHERE status = ?',
      ['Em estoque', 'Estoque']
    );
    
    console.log(`✅ Migração concluída! ${result.affectedRows} registro(s) atualizado(s).`);
    console.log('   Status "Estoque" foi alterado para "Em estoque"');
    
    // Verificar se a migração foi bem-sucedida
    const remainingEstoque = await executeCheckinQuery(
      'SELECT COUNT(*) as count FROM schedule_list WHERE status = ?',
      ['Estoque']
    );
    
    if (remainingEstoque[0].count === 0) {
      console.log('🎉 Migração verificada: não há mais registros com status "Estoque"');
    } else {
      console.log(`⚠️ Ainda existem ${remainingEstoque[0].count} registros com status "Estoque"`);
    }
    
  } catch (error) {
    console.error('❌ Erro durante a migração:', error);
    throw error;
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  migrateEstoqueStatus()
    .then(() => {
      console.log('🏁 Script de migração finalizado.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Falha na migração:', error);
      process.exit(1);
    });
}

module.exports = { migrateEstoqueStatus };