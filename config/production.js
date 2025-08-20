// Configuração de produção para o Railway
// Este arquivo contém as configurações hardcoded para produção

module.exports = {
  // Configurações do banco de dados ODH Server
  database: {
    host: 'mercocamp.ip.odhserver.com',
    port: 33101,
    user: 'projetos',
    password: 'masterkey', // Senha do banco de dados - CONFIRMADA
    databases: {
      dbusers: 'dbusers',
      dbcheckin: 'dbcheckin',
      dbmercocamp: 'dbmercocamp'
    }
  },
  
  // Configurações do servidor
  server: {
    port: process.env.PORT || 4000,
    environment: 'production'
    // Railway gerencia automaticamente o binding do host
  },
  
  // Configurações JWT
  jwt: {
    secret: 'mercocamp_schedule_api_jwt_secret_key_2025_super_secure_production',
    expiresIn: '7d'
  },
  
  // Configurações de rate limiting
  rateLimit: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 500 // máximo 500 requests por IP
  },
  
  // Configurações CORS
  cors: {
    allowedOrigins: [
      'https://schedule-mercocamp-front-end2.vercel.app',
      'https://recebimento.mercocamptech.com.br',
      'http://recebimento.mercocamptech.com.br',  // HTTP version
      'http://recebimento.mercocamptech.com.br:80',
      'http://recebimento.mercocamptech.com.br:443',
      'http://recebimento.mercocamptech.com.br/',  // Com trailing slash
      'https://recebimento.mercocamptech.com.br/',  // HTTPS com trailing slash
      // Adicionar outros domínios front-end conforme necessário
      process.env.FRONTEND_URL,
      process.env.ALLOWED_ORIGINS
    ].filter(Boolean)
  },
  
  // Configurações do Corpem WMS
  corpem: {
    baseURL: 'http://webcorpem.no-ip.info:800/scripts/mh.dll/wc',
    cnpjWms: '27630772000244',
    token: '6cnc3',
    tokenHeader: 'TOKEN_CP'
  }
}; 