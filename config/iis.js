// Configuração específica para IIS (Windows Server)
// Este arquivo contém as configurações otimizadas para ambiente IIS

module.exports = {
  // Configurações do banco de dados ODH Server
  database: {
    host: 'mercocamp.ip.odhserver.com',
    port: 33101,
    user: 'projetos',
    password: 'masterkey',
    databases: {
      dbusers: 'dbusers',
      dbcheckin: 'dbcheckin',
      dbmercocamp: 'dbmercocamp'
    }
  },
  
  // Configurações do servidor
  server: {
    port: process.env.PORT || 4000,
    environment: 'iis'
  },
  
  // Configurações JWT
  jwt: {
    secret: 'mercocamp_schedule_api_jwt_secret_key_2025_super_secure_iis',
    expiresIn: '7d'
  },
  
  // Configurações de rate limiting
  rateLimit: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 500 // máximo 500 requests por IP
  },
  
  // Configurações CORS - Mais permissivo para IIS
  cors: {
    allowedOrigins: [
      // Desenvolvimento local
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      // Produção
      'https://schedule-mercocamp-front-end2.vercel.app',
      'https://recebimento.mercocamptech.com.br',
      'http://recebimento.mercocamptech.com.br',
      'https://recebhomolog.mercocamptech.com.br',
      'http://recebhomolog.mercocamptech.com.br',
      // Variações com e sem porta
      'http://recebhomolog.mercocamptech.com.br:80',
      'http://recebhomolog.mercocamptech.com.br:443',
      'https://recebhomolog.mercocamptech.com.br:443',
      // Variações com trailing slash
      'http://recebhomolog.mercocamptech.com.br/',
      'https://recebhomolog.mercocamptech.com.br/',
      // Variáveis de ambiente
      process.env.FRONTEND_URL,
      process.env.ALLOWED_ORIGINS
    ].filter(Boolean)
  },
  
  // Configurações do Corpem WMS
  corpem: {
    baseURL: 'http://webcorpem.no-ip.info:37560/scripts/mh.dll/wc',
    cnpjWms: '27630772000244',
    token: '6cnc3',
    tokenHeader: 'TOKEN_CP'
  }
};
