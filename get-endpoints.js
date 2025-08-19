/**
 * Script para exibir todos os endpoints disponíveis no servidor
 * Execute com: node get-endpoints.js
 */

// Importar dependências
const os = require('os');

// Cores para console
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  red: '\x1b[31m'
};

// Obter a porta do arquivo .env ou usar padrão
let port = 4000;
try {
  const fs = require('fs');
  const dotenv = require('dotenv');
  const envFile = fs.existsSync('./.env') ? './.env' : './.env.example';
  
  if (fs.existsSync(envFile)) {
    const envConfig = dotenv.parse(fs.readFileSync(envFile));
    port = envConfig.PORT || port;
  }
} catch (error) {
  console.log(`${colors.yellow}⚠️ Não foi possível ler arquivo .env. Usando porta padrão: ${port}${colors.reset}`);
}

// Obter interfaces de rede
const networkInterfaces = os.networkInterfaces();
const ipAddresses = [];

// Filtrar apenas IPs IPv4 e não-loopback
Object.keys(networkInterfaces).forEach((ifname) => {
  networkInterfaces[ifname].forEach((iface) => {
    if (iface.family === 'IPv4' && !iface.internal) {
      ipAddresses.push(iface.address);
    }
  });
});

// Exibir cabeçalho
console.log('\n============================================================');
console.log(`${colors.bright}${colors.cyan}🔍 ENDPOINTS DISPONÍVEIS DO SERVIDOR BACKEND${colors.reset}`);
console.log('============================================================\n');

// Exibir porta
console.log(`${colors.bright}📡 Porta:${colors.reset} ${port}`);

// Mostrar endpoints
console.log(`\n${colors.bright}${colors.green}📍 ENDPOINTS DA API:${colors.reset}`);
if (ipAddresses.length > 0) {
  console.log(`\n${colors.bright}${colors.yellow}Na rede local:${colors.reset}`);
  ipAddresses.forEach(ip => {
    console.log(`   ${colors.green}✅${colors.reset} http://${ip}:${port}/api`);
  });
}

console.log(`\n${colors.bright}${colors.yellow}No próprio servidor:${colors.reset}`);
console.log(`   ${colors.green}✅${colors.reset} http://localhost:${port}/api`);
console.log(`   ${colors.green}✅${colors.reset} http://127.0.0.1:${port}/api`);

// Mostrar endpoints comuns
console.log(`\n${colors.bright}${colors.blue}🔍 ENDPOINTS COMUNS:${colors.reset}`);
console.log(`   ${colors.green}🏥${colors.reset} Health Check: http://localhost:${port}/api/health`);
console.log(`   ${colors.green}📚${colors.reset} Documentação: http://localhost:${port}/api/info`);
console.log(`   ${colors.green}🔑${colors.reset} Login: http://localhost:${port}/api/auth/login`);
console.log(`   ${colors.green}👥${colors.reset} Usuários: http://localhost:${port}/api/users`);
console.log(`   ${colors.green}📅${colors.reset} Agendamentos: http://localhost:${port}/api/schedules`);

console.log('\n============================================================');
console.log(`${colors.bright}${colors.yellow}ℹ️ Use estas URLs para configurar o frontend:${colors.reset}`);
if (ipAddresses.length > 0) {
  console.log(`\n${colors.bright}config.js:${colors.reset}`);
  console.log(`window.API_CONFIG = {`);
  console.log(`  API_URL: 'http://${ipAddresses[0]}:${port}/api'`);
  console.log(`};`);
}
console.log('============================================================\n');

// Verificar se o servidor está rodando
const http = require('http');
const testPort = (port) => {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: port,
      path: '/api/health',
      timeout: 1000
    }, (res) => {
      resolve(true);
    }).on('error', () => {
      resolve(false);
    });
    
    req.on('timeout', () => {
      req.abort();
      resolve(false);
    });
  });
};

// Testar se o servidor está rodando
testPort(port).then((isRunning) => {
  if (isRunning) {
    console.log(`${colors.bright}${colors.green}✅ SERVIDOR ESTÁ RODANDO${colors.reset}`);
  } else {
    console.log(`${colors.bright}${colors.red}❌ SERVIDOR NÃO ESTÁ RODANDO${colors.reset}`);
    console.log(`${colors.yellow}ℹ️ Inicie o servidor com: npm start${colors.reset}`);
  }
});
