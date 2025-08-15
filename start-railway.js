// Script de inicialização para Railway
console.log('🚂 Inicializando aplicação na Railway...');

// Configurar variáveis de ambiente caso não estejam definidas
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.PORT = process.env.PORT || 3000;

// Configurações do banco de dados
const DB_CONFIG = {
  DB_HOST: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
  DB_PORT: process.env.DB_PORT || 33101,
  DB_USER: process.env.DB_USER || 'projetos',
  DB_PASSWORD: process.env.DB_PASSWORD || 'masterkey',
  DB_CHECKIN: process.env.DB_CHECKIN || 'dbcheckin',
  DB_MERCOCAMP: process.env.DB_MERCOCAMP || 'dbmercocamp',
  DB_USERS: process.env.DB_USERS || 'dbusers'
};

// Mostrar as configurações atuais (sem a senha)
console.log('\n🔧 Configurações carregadas:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('DB_HOST:', DB_CONFIG.DB_HOST);
console.log('DB_PORT:', DB_CONFIG.DB_PORT);
console.log('DB_USER:', DB_CONFIG.DB_USER);
console.log('DB_CHECKIN:', DB_CONFIG.DB_CHECKIN);
console.log('DB_MERCOCAMP:', DB_CONFIG.DB_MERCOCAMP);
console.log('DB_USERS:', DB_CONFIG.DB_USERS);

// Testar conectividade com o banco de dados antes de iniciar
console.log('\n🔍 Testando conectividade TCP com o banco de dados...');

const net = require('net');
const socket = new net.Socket();
const connectTimeout = 30000; // 30 segundos

socket.setTimeout(connectTimeout);

socket.on('connect', () => {
  console.log(`✅ Conectividade TCP estabelecida com ${DB_CONFIG.DB_HOST}:${DB_CONFIG.DB_PORT}`);
  socket.destroy();
  startApp();
});

socket.on('timeout', () => {
  console.log(`⚠️ Timeout ao conectar com ${DB_CONFIG.DB_HOST}:${DB_CONFIG.DB_PORT} após ${connectTimeout}ms`);
  console.log('⚠️ Possível bloqueio de firewall ou IP não permitido');
  console.log('⚠️ Continuando com inicialização da aplicação mesmo assim...');
  socket.destroy();
  startApp();
});

socket.on('error', (err) => {
  console.log(`⚠️ Erro ao conectar com ${DB_CONFIG.DB_HOST}:${DB_CONFIG.DB_PORT}: ${err.message}`);
  console.log('⚠️ Verificar configurações de rede e firewall');
  console.log('⚠️ Continuando com inicialização da aplicação mesmo assim...');
  socket.destroy();
  startApp();
});

// Tentar conexão TCP
console.log(`📡 Conectando a ${DB_CONFIG.DB_HOST}:${DB_CONFIG.DB_PORT}...`);
socket.connect(DB_CONFIG.DB_PORT, DB_CONFIG.DB_HOST);

// Função para iniciar a aplicação
function startApp() {
  console.log('\n🚀 Iniciando aplicação...');
  
  try {
    // Carregar e executar o app.js principal
    require('./app.js');
  } catch (error) {
    console.error('❌ Erro ao iniciar aplicação:', error);
    process.exit(1);
  }
}
