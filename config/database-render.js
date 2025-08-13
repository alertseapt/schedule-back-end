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

// Configuração otimizada para cloud deployment - múltiplas tentativas
const baseConfig = {
  host: dbConfig.host,
  port: dbConfig.port,
  user: dbConfig.user,
  password: dbConfig.password,
  waitForConnections: true,
  charset: 'utf8mb4',
  // Timeouts mais longos para cloud
  connectTimeout: 180000, // 3 minutos
  connectionLimit: 3, // Muito conservador
  queueLimit: 5,
  idleTimeout: 300000,
  maxIdle: 1,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
};

// Tentar múltiplas configurações
const configs = [
  // Config 1: Com SSL
  {
    ...baseConfig,
    ssl: { rejectUnauthorized: false }
  },
  // Config 2: Sem SSL (original)
  {
    ...baseConfig,
    ssl: false
  },
  // Config 3: Porta padrão MySQL
  {
    ...baseConfig,
    port: 3306,
    ssl: false
  }
];

let poolConfig = configs[0]; // Começar com SSL

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

// Função aprimorada para testar diferentes configurações automaticamente
const testConnections = async () => {
  console.log('🔄 Testando conexões MySQL com múltiplas configurações...');
  
  // Testar diferentes portas TCP primeiro
  const portsToTest = [dbConfig.port, 3306, 3307];
  let workingPort = null;
  
  for (const port of portsToTest) {
    try {
      console.log(`🔌 Testando TCP ${dbConfig.host}:${port}...`);
      await testTCPConnection(dbConfig.host, port, 30000);
      console.log(`✅ TCP conectividade estabelecida na porta ${port}`);
      workingPort = port;
      break;
    } catch (error) {
      console.error(`❌ Falha TCP porta ${port}: ${error.message}`);
    }
  }
  
  if (!workingPort) {
    console.error('❌ Nenhuma porta TCP acessível. Possível bloqueio de rede.');
    return false;
  }
  
  // Atualizar configurações com a porta que funciona
  configs.forEach(config => {
    config.port = workingPort;
  });
  
  // Tentar diferentes configurações MySQL
  for (let configIndex = 0; configIndex < configs.length; configIndex++) {
    const config = configs[configIndex];
    console.log(`🧪 Testando configuração ${configIndex + 1}/${configs.length} (porta: ${config.port}, SSL: ${config.ssl ? 'habilitado' : 'desabilitado'})...`);
    
    try {
      // Criar pool temporário para teste
      const testPool = mysql.createPool({
        ...config,
        database: 'dbusers' // Testar com um banco
      });
      
      const connection = await Promise.race([
        testPool.getConnection(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('TIMEOUT_CONFIG_TEST')), 60000)
        )
      ]);
      
      // Testar query básica
      await connection.execute('SELECT 1');
      connection.release();
      await testPool.end();
      
      console.log(`✅ Configuração ${configIndex + 1} funcionou! Recriando pools...`);
      
      // Recriar todos os pools com a configuração que funciona
      await recreatePools(config);
      
      console.log('🎉 Todas as conexões MySQL estabelecidas com sucesso!');
      return true;
      
    } catch (error) {
      console.error(`❌ Configuração ${configIndex + 1} falhou: ${error.message}`);
      try {
        await testPool.end();
      } catch (e) {}
    }
  }
  
  console.error('❌ Todas as configurações falharam. Problema de conectividade confirmado.');
  return false;
};

// Função para recriar pools com configuração que funciona
async function recreatePools(workingConfig) {
  console.log('🔄 Recriando pools com configuração funcional...');
  
  // Fechar pools existentes
  try {
    await dbusersPool.end();
    await dbcheckinPool.end();
    await dbmercocampPool.end();
  } catch (e) {
    console.log('Pools antigos já fechados ou inexistentes');
  }
  
  // Recriar com configuração funcional
  global.dbusersPool = mysql.createPool({ ...workingConfig, database: 'dbusers' });
  global.dbcheckinPool = mysql.createPool({ ...workingConfig, database: 'dbcheckin' });
  global.dbmercocampPool = mysql.createPool({ ...workingConfig, database: 'dbmercocamp' });
  
  console.log('✅ Pools recriados com sucesso!');
}

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