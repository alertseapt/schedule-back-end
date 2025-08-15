const mysql = require('mysql2/promise');

// Configurações de banco de dados
const dbConfig = {
  host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
  port: process.env.DB_PORT || 33101,
  user: process.env.DB_USER || 'projetos',
  password: process.env.DB_PASSWORD || 'masterkey',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Pools de conexão para cada banco
const checkinPool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_CHECKIN || 'dbcheckin'
});

const mercocampPool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_MERCOCAMP || 'dbmercocamp'
});

const usersPool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_USERS || 'dbusers'
});

/**
 * Executa query no banco dbcheckin
 */
async function executeCheckinQuery(query, params = []) {
  try {
    const [rows] = await checkinPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Erro na query do dbcheckin:', error);
    throw error;
  }
}

/**
 * Executa query no banco dbmercocamp
 */
async function executeMercocampQuery(query, params = []) {
  try {
    const [rows] = await mercocampPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Erro na query do dbmercocamp:', error);
    throw error;
  }
}

/**
 * Executa query no banco dbusers
 */
async function executeUsersQuery(query, params = []) {
  try {
    const [rows] = await usersPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error('❌ Erro na query do dbusers:', error);
    throw error;
  }
}

/**
 * Testa as conexões com todos os bancos
 * 
 * @returns {boolean} - true se todas as conexões estiverem funcionando
 */
async function testConnections() {
  try {
    console.log('🔍 Testando conexões com bancos de dados...');
    
    let allConnectionsHealthy = true;
    
    // Testar dbcheckin
    try {
      await checkinPool.execute('SELECT 1');
      console.log('✅ dbcheckin: Conectado');
    } catch (error) {
      console.log('❌ dbcheckin: Erro na conexão');
      allConnectionsHealthy = false;
    }
    
    // Testar dbmercocamp
    try {
      await mercocampPool.execute('SELECT 1');
      console.log('✅ dbmercocamp: Conectado');
    } catch (error) {
      console.log('❌ dbmercocamp: Erro na conexão');
      allConnectionsHealthy = false;
    }
    
    // Testar dbusers
    try {
      await usersPool.execute('SELECT 1');
      console.log('✅ dbusers: Conectado');
    } catch (error) {
      console.log('❌ dbusers: Erro na conexão');
      allConnectionsHealthy = false;
    }
    
    console.log('🔍 Teste de conexões concluído');
    
    if (allConnectionsHealthy) {
      console.log('✅ Todas as conexões estão funcionando');
      return true;
    } else {
      console.log('⚠️ Algumas conexões falharam');
      return false;
    }
    
  } catch (error) {
    console.error('❌ Erro ao testar conexões:', error);
    return false;
  }
}

/**
 * Fecha todas as conexões
 */
async function closeConnections() {
  try {
    await checkinPool.end();
    await mercocampPool.end();
    await usersPool.end();
    console.log('✅ Conexões fechadas');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões:', error);
  }
}

module.exports = {
  executeCheckinQuery,
  executeMercocampQuery,
  executeUsersQuery,
  testConnections,
  closeConnections,
  checkinPool,
  mercocampPool,
  usersPool
};
