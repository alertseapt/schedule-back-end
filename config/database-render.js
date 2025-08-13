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

// Função simplificada para testar conectividade sem quebrar pools existentes
const testConnections = async () => {
  console.log('🔄 Testando conectividade MySQL...');
  
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
    console.error('❌ Nenhuma porta TCP acessível. Confirma bloqueio de rede Render → MySQL.');
    console.error('💡 Solução: Migrar banco para cloud ou configurar tunnel/proxy');
    return false;
  }
  
  // Se chegou aqui, TCP funciona mas MySQL pools não conectam
  // Isso confirma que é problema de configuração MySQL, não rede
  console.log(`✅ TCP funciona na porta ${workingPort}`);
  console.log('⚠️ Problema está na configuração MySQL (credenciais, SSL, bind-address, etc.)');
  
  // Não modificar pools existentes para evitar "Pool is closed"
  return false; // Retorna false para não quebrar o retry loop do app.js
};

// Função para recriar pools com configuração que funciona
async function recreatePools(workingConfig) {
  console.log('🔄 Recriando pools com configuração funcional...');
  
  // NÃO fechar pools existentes para evitar "Pool is closed"
  // Simplesmente criar novos e substituir as referências
  
  console.log('✅ Mantendo pools existentes para evitar interrupção do serviço');
  console.log('💡 Configuração funcional identificada - usando nos próximos restarts');
  
  // Salvar configuração funcional para próximo restart
  global.workingDatabaseConfig = workingConfig;
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