const mysql = require('mysql2/promise');

// Configurações de banco de dados com melhor tratamento de conexão
const dbConfig = {
  host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
  port: process.env.DB_PORT || 33101,
  user: process.env.DB_USER || 'projetos',
  password: process.env.DB_PASSWORD || 'masterkey',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Configurações válidas para MySQL2 pools
  idleTimeout: 300000, // 5 minutos de timeout para conexões idle
  typeCast: function (field, next) {
    if (field.type === 'TINY' && field.length === 1) {
      return (field.string() === '1'); // cast tinyint como boolean
    }
    return next();
  }
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

const cobrancasPool = mysql.createPool({
  ...dbConfig,
  database: process.env.DB_COBRANCAS || 'dbcobrancas'
});

/**
 * Executa query no banco dbcheckin com retry automático
 */
async function executeCheckinQuery(query, params = [], retryCount = 0) {
  const maxRetries = 3;
  try {
    const [rows] = await checkinPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error(`❌ Erro na query do dbcheckin (tentativa ${retryCount + 1}):`, error);
    
    // Se é um erro de conexão e ainda temos tentativas, tentar novamente
    if (
      (error.code === 'ECONNRESET' || 
       error.code === 'PROTOCOL_CONNECTION_LOST' || 
       error.code === 'ENOTFOUND' ||
       error.code === 'ETIMEDOUT') && 
      retryCount < maxRetries
    ) {
      console.log(`🔄 Tentando reconectar ao dbcheckin (tentativa ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return executeCheckinQuery(query, params, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Executa query no banco dbmercocamp com retry automático
 */
async function executeMercocampQuery(query, params = [], retryCount = 0) {
  const maxRetries = 3;
  try {
    const [rows] = await mercocampPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error(`❌ Erro na query do dbmercocamp (tentativa ${retryCount + 1}):`, error);
    
    // Se é um erro de conexão e ainda temos tentativas, tentar novamente
    if (
      (error.code === 'ECONNRESET' || 
       error.code === 'PROTOCOL_CONNECTION_LOST' || 
       error.code === 'ENOTFOUND' ||
       error.code === 'ETIMEDOUT') && 
      retryCount < maxRetries
    ) {
      console.log(`🔄 Tentando reconectar ao dbmercocamp (tentativa ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return executeMercocampQuery(query, params, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Executa query no banco dbusers com retry automático
 */
async function executeUsersQuery(query, params = [], retryCount = 0) {
  const maxRetries = 3;
  try {
    const [rows] = await usersPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error(`❌ Erro na query do dbusers (tentativa ${retryCount + 1}):`, error);
    
    // Se é um erro de conexão e ainda temos tentativas, tentar novamente
    if (
      (error.code === 'ECONNRESET' || 
       error.code === 'PROTOCOL_CONNECTION_LOST' || 
       error.code === 'ENOTFOUND' ||
       error.code === 'ETIMEDOUT') && 
      retryCount < maxRetries
    ) {
      console.log(`🔄 Tentando reconectar ao dbusers (tentativa ${retryCount + 1}/${maxRetries})...`);
      // Aguardar um pouco antes de tentar novamente
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return executeUsersQuery(query, params, retryCount + 1);
    }
    
    throw error;
  }
}

/**
 * Executa query no banco dbcobrancas com retry automático
 */
async function executeCobrancasQuery(query, params = [], retryCount = 0) {
  const maxRetries = 3;
  try {
    const [rows] = await cobrancasPool.execute(query, params);
    return rows;
  } catch (error) {
    console.error(`❌ Erro na query do dbcobrancas (tentativa ${retryCount + 1}):`, error);
    
    // Se é um erro de conexão e ainda temos tentativas, tentar novamente
    if (
      (error.code === 'ECONNRESET' || 
       error.code === 'PROTOCOL_CONNECTION_LOST' || 
       error.code === 'ENOTFOUND' ||
       error.code === 'ETIMEDOUT') && 
      retryCount < maxRetries
    ) {
      console.log(`🔄 Tentando reconectar ao dbcobrancas (tentativa ${retryCount + 1}/${maxRetries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return executeCobrancasQuery(query, params, retryCount + 1);
    }
    
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
    
    // Testar dbcobrancas
    try {
      await cobrancasPool.execute('SELECT 1');
      console.log('✅ dbcobrancas: Conectado');
    } catch (error) {
      console.log('❌ dbcobrancas: Erro na conexão');
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
    await cobrancasPool.end();
    console.log('✅ Conexões fechadas');
  } catch (error) {
    console.error('❌ Erro ao fechar conexões:', error);
  }
}

module.exports = {
  executeCheckinQuery,
  executeMercocampQuery,
  executeUsersQuery,
  executeCobrancasQuery,
  testConnections,
  closeConnections,
  checkinPool,
  mercocampPool,
  usersPool,
  cobrancasPool
};
