const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco MySQL (único tipo suportado)
const dbConfig = {
  host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
  port: parseInt(process.env.DB_PORT) || 33101,
  user: process.env.DB_USER || 'projetos',
  password: process.env.DB_PASSWORD || 'masterkey'
};

console.log('🔧 Configuração MySQL para Render:');
console.log(`   Host: ${dbConfig.host}:${dbConfig.port}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   Password: ***`);

// Configuração otimizada para cloud deployment (apenas opções válidas MySQL2)
const poolConfig = {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  waitForConnections: true,
  charset: 'utf8mb4',
  // Timeouts válidos para MySQL2
  connectTimeout: 120000, // 2 minutos para estabelecer conexão
  // Configurações de pool
  connectionLimit: 5, // Reduzido para evitar saturação
  queueLimit: 10,
  idleTimeout: 300000, // 5 minutos idle
  maxIdle: 2,
  enableKeepAlive: true,
  keepAliveInitialDelay: 30000,
  // Tentar SSL primeiro, fallback para não-SSL
  ssl: {
    rejectUnauthorized: false // Aceita certificados auto-assinados
  }
};

// Pools de conexão MySQL para cada banco
const dbusersPool = mysql.createPool({
  ...poolConfig,
  database: 'dbusers'
});

const dbcheckinPool = mysql.createPool({
  ...poolConfig,
  database: 'dbcheckin'
});

const dbmercocampPool = mysql.createPool({
  ...poolConfig,
  database: 'dbmercocamp'
});

// Funções para executar queries em cada banco específico
const executeUsersQuery = async (query, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await dbusersPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error(`❌ Erro dbusers (tentativa ${attempt}/${retries}): ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
};

const executeCheckinQuery = async (query, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await dbcheckinPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error(`❌ Erro dbcheckin (tentativa ${attempt}/${retries}): ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
};

const executeMercocampQuery = async (query, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const [rows] = await dbmercocampPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error(`❌ Erro dbmercocamp (tentativa ${attempt}/${retries}): ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
};

// Função para testar conectividade básica via TCP
const testTCPConnection = async (host, port, timeout = 30000) => {
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TCP timeout para ${host}:${port} após ${timeout}ms`));
    }, timeout);
    
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    });
    
    socket.connect(port, host);
  });
};

// Função aprimorada para testar todas as conexões com retry inteligente
const testConnections = async (maxRetries = 3) => {
  console.log('🔄 Testando conexões MySQL com retry inteligente...');
  
  // Primeiro, testar conectividade TCP básica
  try {
    console.log('🔌 Testando conectividade TCP básica...');
    await testTCPConnection(dbConfig.host, dbConfig.port, 30000);
    console.log('✅ Conectividade TCP estabelecida');
  } catch (error) {
    console.error('❌ Falha na conectividade TCP:', error.message);
    console.error('⚠️  Possível bloqueio de firewall ou IP não permitido');
    return false;
  }
  
  // Testar conexões MySQL com retry exponencial
  const databases = [
    { name: 'dbusers', pool: dbusersPool },
    { name: 'dbcheckin', pool: dbcheckinPool },
    { name: 'dbmercocamp', pool: dbmercocampPool }
  ];
  
  for (const db of databases) {
    let lastError = null;
    let connected = false;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📊 Testando ${db.name} (tentativa ${attempt}/${maxRetries})...`);
        
        const connection = await Promise.race([
          db.pool.getConnection(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`TIMEOUT_${db.name.toUpperCase()}`)), 120000)
          )
        ]);
        
        // Testar com query simples
        await connection.execute('SELECT 1');
        connection.release();
        
        console.log(`✅ ${db.name}: Conectado`);
        connected = true;
        break;
        
      } catch (error) {
        lastError = error;
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Backoff exponencial, máx 10s
        console.error(`❌ ${db.name} (tentativa ${attempt}): ${error.message}`);
        
        if (attempt < maxRetries) {
          console.log(`⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    if (!connected) {
      console.error(`❌ Falha definitiva em ${db.name} após ${maxRetries} tentativas`);
      console.error('   Último erro:', lastError.message);
      return false;
    }
  }
  
  console.log('🎉 Todas as conexões MySQL estabelecidas com sucesso!');
  return true;
};

module.exports = {
  // Pools de conexão
  dbusersPool,
  dbcheckinPool,
  dbmercocampPool,
  
  // Funções de teste
  testConnections,
  
  // Funções para execução de queries
  executeUsersQuery,
  executeCheckinQuery,
  executeMercocampQuery,
  
  // Alias para compatibilidade com código existente
  pool: dbcheckinPool,
  testConnection: testConnections,
  executeQuery: executeCheckinQuery
};