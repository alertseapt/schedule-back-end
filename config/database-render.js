const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração do banco MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
  port: parseInt(process.env.DB_PORT) || 33101,
  user: process.env.DB_USER || 'projetos',
  password: process.env.DB_PASSWORD || 'masterkey'
};

console.log('🔧 Configuração MySQL detalhada:');
console.log(`   Host: ${dbConfig.host}`);
console.log(`   Port: ${dbConfig.port}`);
console.log(`   User: ${dbConfig.user}`);
console.log(`   Password: ${dbConfig.password ? '***(' + dbConfig.password.length + ' chars)' : 'UNDEFINED'}`);
console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

// Função para teste TCP detalhado
const testTCPConnection = async (host, port, timeout = 30000) => {
  console.log(`🔌 Iniciando teste TCP para ${host}:${port} (timeout: ${timeout}ms)`);
  
  return new Promise((resolve, reject) => {
    const net = require('net');
    const socket = new net.Socket();
    const startTime = Date.now();
    
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        try {
          socket.destroy();
        } catch (e) {}
      }
    };
    
    const timer = setTimeout(() => {
      const duration = Date.now() - startTime;
      console.log(`❌ TCP timeout após ${duration}ms para ${host}:${port}`);
      cleanup();
      reject(new Error(`TCP timeout para ${host}:${port} após ${timeout}ms`));
    }, timeout);
    
    socket.on('connect', () => {
      const duration = Date.now() - startTime;
      console.log(`✅ TCP conectado em ${duration}ms para ${host}:${port}`);
      clearTimeout(timer);
      cleanup();
      resolve(true);
    });
    
    socket.on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`❌ TCP erro após ${duration}ms para ${host}:${port}: ${err.message}`);
      clearTimeout(timer);
      cleanup();
      reject(err);
    });
    
    socket.on('timeout', () => {
      const duration = Date.now() - startTime;
      console.log(`❌ TCP socket timeout após ${duration}ms para ${host}:${port}`);
      clearTimeout(timer);
      cleanup();
      reject(new Error(`Socket timeout para ${host}:${port}`));
    });
    
    console.log(`🔄 Tentando conectar TCP ${host}:${port}...`);
    socket.setTimeout(timeout);
    socket.connect(port, host);
  });
};

// Função para teste MySQL detalhado
const testMySQLConnection = async (config, databaseName) => {
  console.log(`🗄️ Testando conexão MySQL para database: ${databaseName}`);
  console.log(`   Config: ${config.user}@${config.host}:${config.port}/${databaseName}`);
  
  let connection = null;
  const startTime = Date.now();
  
  try {
    // Criar conexão individual (não pool)
    console.log(`🔄 Criando conexão MySQL...`);
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: databaseName,
      connectTimeout: 60000,
      ssl: false,
      charset: 'utf8mb4'
    });
    
    const connectDuration = Date.now() - startTime;
    console.log(`✅ Conexão MySQL estabelecida em ${connectDuration}ms`);
    
    // Testar query básica
    console.log(`🔄 Executando query de teste...`);
    const queryStart = Date.now();
    const [rows] = await connection.execute('SELECT 1 as test');
    const queryDuration = Date.now() - queryStart;
    
    console.log(`✅ Query executada em ${queryDuration}ms`);
    console.log(`   Resultado: ${JSON.stringify(rows[0])}`);
    
    const totalDuration = Date.now() - startTime;
    console.log(`🎉 Teste MySQL completo em ${totalDuration}ms para ${databaseName}`);
    
    return { success: true, duration: totalDuration };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    console.log(`❌ Erro MySQL após ${duration}ms para ${databaseName}:`);
    console.log(`   Tipo: ${error.constructor.name}`);
    console.log(`   Code: ${error.code || 'N/A'}`);
    console.log(`   Errno: ${error.errno || 'N/A'}`);
    console.log(`   SQLState: ${error.sqlState || 'N/A'}`);
    console.log(`   Message: ${error.message}`);
    
    return { success: false, error, duration };
    
  } finally {
    if (connection) {
      try {
        console.log(`🔄 Fechando conexão de teste...`);
        await connection.end();
        console.log(`✅ Conexão de teste fechada`);
      } catch (e) {
        console.log(`⚠️ Erro ao fechar conexão: ${e.message}`);
      }
    }
  }
};

// Configuração dos pools (criados após testes)
let dbusersPool = null;
let dbcheckinPool = null;
let dbmercocampPool = null;

// Função para criar pools após validação
const createPools = () => {
  console.log('🏗️ Criando pools de conexão MySQL...');
  
  const poolConfig = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    waitForConnections: true,
    charset: 'utf8mb4',
    connectTimeout: 120000,
    connectionLimit: 5,
    queueLimit: 10,
    idleTimeout: 300000,
    maxIdle: 2,
    enableKeepAlive: true,
    keepAliveInitialDelay: 30000,
    ssl: false
  };
  
  dbusersPool = mysql.createPool({ ...poolConfig, database: 'dbusers' });
  dbcheckinPool = mysql.createPool({ ...poolConfig, database: 'dbcheckin' });
  dbmercocampPool = mysql.createPool({ ...poolConfig, database: 'dbmercocamp' });
  
  console.log('✅ Pools criados: dbusers, dbcheckin, dbmercocamp');
};

// Função principal de teste
const testConnections = async () => {
  console.log('🚀 ========== INICIANDO DIAGNÓSTICO COMPLETO ==========');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Fase 1: Teste TCP
    console.log('\n📡 FASE 1: Teste de Conectividade TCP');
    console.log('==========================================');
    
    const portsToTest = [dbConfig.port, 3306, 3307];
    let workingPort = null;
    
    for (const port of portsToTest) {
      try {
        await testTCPConnection(dbConfig.host, port, 30000);
        workingPort = port;
        console.log(`🎯 Porta funcional encontrada: ${port}`);
        break;
      } catch (error) {
        console.log(`❌ Porta ${port} inacessível: ${error.message}`);
      }
    }
    
    if (!workingPort) {
      console.log('\n❌ DIAGNÓSTICO: Bloqueio de rede total');
      console.log('💡 SOLUÇÃO: Verificar firewall ou migrar para banco em nuvem');
      return false;
    }
    
    // Atualizar configuração com porta que funciona
    if (workingPort !== dbConfig.port) {
      console.log(`🔄 Atualizando porta de ${dbConfig.port} para ${workingPort}`);
      dbConfig.port = workingPort;
    }
    
    // Fase 2: Teste MySQL
    console.log('\n🗄️ FASE 2: Teste de Autenticação MySQL');
    console.log('==========================================');
    
    const databases = ['dbusers', 'dbcheckin', 'dbmercocamp'];
    const results = {};
    
    for (const db of databases) {
      console.log(`\n🔍 Testando banco: ${db}`);
      results[db] = await testMySQLConnection(dbConfig, db);
    }
    
    // Análise dos resultados
    console.log('\n📊 ANÁLISE DOS RESULTADOS');
    console.log('==========================');
    
    const successful = Object.values(results).filter(r => r.success).length;
    const total = databases.length;
    
    console.log(`✅ Sucessos: ${successful}/${total}`);
    
    if (successful === total) {
      console.log('🎉 DIAGNÓSTICO: Todos os bancos acessíveis!');
      console.log('🏗️ Criando pools de produção...');
      createPools();
      return true;
    } else if (successful > 0) {
      console.log('⚠️ DIAGNÓSTICO: Conectividade parcial');
      console.log('💡 SOLUÇÃO: Verificar permissões específicas por banco');
      createPools(); // Criar pools mesmo com falhas parciais
      return false;
    } else {
      console.log('❌ DIAGNÓSTICO: Falha total de autenticação MySQL');
      console.log('💡 SOLUÇÃO: Verificar credenciais, bind-address ou SSL requirements');
      return false;
    }
    
  } catch (error) {
    console.log(`\n💥 ERRO CRÍTICO NO DIAGNÓSTICO: ${error.message}`);
    console.log(`Stack: ${error.stack}`);
    return false;
    
  } finally {
    console.log('\n🏁 ========== DIAGNÓSTICO FINALIZADO ==========\n');
  }
};

// Inicializar pools na importação
createPools();

// Funções de execução com retry
const executeUsersQuery = async (query, params = [], retries = 3) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (!dbusersPool) {
        throw new Error('Pool dbusers não inicializado');
      }
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
      if (!dbcheckinPool) {
        throw new Error('Pool dbcheckin não inicializado');
      }
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
      if (!dbmercocampPool) {
        throw new Error('Pool dbmercocamp não inicializado');
      }
      const [rows] = await dbmercocampPool.execute(query, params);
      return rows;
    } catch (error) {
      console.error(`❌ Erro dbmercocamp (tentativa ${attempt}/${retries}): ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
};

module.exports = {
  // Pools de conexão
  get dbusersPool() { return dbusersPool; },
  get dbcheckinPool() { return dbcheckinPool; },
  get dbmercocampPool() { return dbmercocampPool; },
  
  // Funções de teste
  testConnections,
  
  // Funções para execução de queries
  executeUsersQuery,
  executeCheckinQuery,
  executeMercocampQuery,
  
  // Alias para compatibilidade
  get pool() { return dbcheckinPool; },
  testConnection: testConnections,
  executeQuery: executeCheckinQuery
};