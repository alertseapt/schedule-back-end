// Configuração de produção para o Railway/ODH Server
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
      'https://recebhomolog.mercocamptech.com.br'
    ]
  },
  
  // Configurações do Corpem WMS
  corpem: {
    baseURL: 'http://webcorpem.no-ip.info:800/scripts/mh.dll/wc',
    cnpjWms: '27630772000244',
    token: '6cnc3',
    tokenHeader: 'TOKEN_CP'
  }
}; 