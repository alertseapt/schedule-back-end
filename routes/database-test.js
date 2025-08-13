const express = require('express');
const router = express.Router();

/**
 * Rota para testar conectividade detalhada com o banco de dados
 * GET /api/database-test/connectivity
 */
router.get('/connectivity', async (req, res) => {
  try {
    console.log('🔍 Iniciando teste detalhado de conectividade...');
    
    const results = {
      timestamp: new Date().toISOString(),
      server: {
        host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
        port: parseInt(process.env.DB_PORT || '33101'),
        user: process.env.DB_USER || 'projetos'
      },
      tests: {}
    };

    // Teste 1: Conectividade TCP básica
    console.log('🔌 Testando conectividade TCP...');
    const tcpResult = await testTCPConnection(results.server.host, results.server.port);
    results.tests.tcp = tcpResult;

    // Teste 2: DNS Resolution
    console.log('🌐 Testando resolução DNS...');
    const dnsResult = await testDNSResolution(results.server.host);
    results.tests.dns = dnsResult;

    // Teste 3: MySQL Connection com diferentes timeouts
    console.log('🗄️ Testando conexão MySQL...');
    const mysqlResult = await testMySQLConnection(results.server);
    results.tests.mysql = mysqlResult;

    // Teste 4: Trace route simplificado
    console.log('🛣️ Testando rota de rede...');
    const routeResult = await testNetworkRoute(results.server.host);
    results.tests.route = routeResult;

    results.summary = {
      overall: results.tests.tcp.success && results.tests.mysql.success ? 'SUCCESS' : 'FAILED',
      recommendations: generateRecommendations(results.tests)
    };

    res.json(results);

  } catch (error) {
    console.error('❌ Erro no teste de conectividade:', error);
    res.status(500).json({
      error: 'Erro no teste de conectividade',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Função para testar conectividade TCP
async function testTCPConnection(host, port, timeout = 30000) {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    const start = Date.now();
    
    const timer = setTimeout(() => {
      socket.destroy();
      resolve({
        success: false,
        error: `TCP timeout após ${timeout}ms`,
        duration: Date.now() - start
      });
    }, timeout);
    
    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({
        success: true,
        duration: Date.now() - start,
        message: 'Conectividade TCP estabelecida'
      });
    });
    
    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({
        success: false,
        error: err.message,
        duration: Date.now() - start
      });
    });
    
    socket.connect(port, host);
  });
}

// Função para testar resolução DNS
async function testDNSResolution(hostname) {
  return new Promise((resolve) => {
    const dns = require('dns');
    const start = Date.now();
    
    dns.resolve4(hostname, (err, addresses) => {
      const duration = Date.now() - start;
      
      if (err) {
        resolve({
          success: false,
          error: err.message,
          duration
        });
      } else {
        resolve({
          success: true,
          addresses: addresses,
          duration,
          message: `Resolvido para: ${addresses.join(', ')}`
        });
      }
    });
  });
}

// Função para testar conexão MySQL
async function testMySQLConnection(serverConfig) {
  const mysql = require('mysql2/promise');
  const start = Date.now();
  
  try {
    const connection = await mysql.createConnection({
      host: serverConfig.host,
      port: serverConfig.port,
      user: serverConfig.user,
      password: process.env.DB_PASSWORD || 'masterkey',
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000
    });
    
    await connection.execute('SELECT 1 as test');
    await connection.end();
    
    return {
      success: true,
      duration: Date.now() - start,
      message: 'Conexão MySQL estabelecida com sucesso'
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.code,
      errno: error.errno,
      duration: Date.now() - start
    };
  }
}

// Função para testar rota de rede (simplificado)
async function testNetworkRoute(host) {
  return new Promise((resolve) => {
    const { exec } = require('child_process');
    
    // No Render, traceroute pode não estar disponível, então fazemos um teste simples
    exec(`ping -c 3 ${host}`, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message,
          available: false
        });
      } else {
        resolve({
          success: true,
          output: stdout,
          available: true
        });
      }
    });
  });
}

// Função para gerar recomendações baseadas nos testes
function generateRecommendations(tests) {
  const recommendations = [];
  
  if (!tests.dns.success) {
    recommendations.push('❌ DNS: Problema na resolução do hostname. Verifique se o domínio está correto.');
  }
  
  if (!tests.tcp.success) {
    recommendations.push('❌ TCP: Porta inacessível. Possível bloqueio de firewall ou IP não permitido.');
    recommendations.push('💡 Configurar firewall para permitir IPs do Render.com');
    recommendations.push('💡 Verificar se a porta 33101 está aberta para conexões externas');
  }
  
  if (tests.tcp.success && !tests.mysql.success) {
    recommendations.push('❌ MySQL: Falha na autenticação ou configuração MySQL.');
    recommendations.push('💡 Verificar credenciais de acesso');
    recommendations.push('💡 Verificar configuração bind-address no MySQL');
    recommendations.push('💡 Verificar privilégios do usuário "projetos"');
  }
  
  if (tests.tcp.success && tests.mysql.success) {
    recommendations.push('✅ Conectividade OK. Se ainda há problemas, pode ser intermitente.');
  }
  
  return recommendations;
}

module.exports = router;