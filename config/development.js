// Configuração de desenvolvimento
// Este arquivo contém as configurações para ambiente de desenvolvimento

module.exports = {
  // Configurações do banco de dados
  database: {
    host: process.env.DB_HOST || 'mercocamp.ip.odhserver.com',
    port: process.env.DB_PORT || 33101,
    user: process.env.DB_USER || 'projetos',
    password: process.env.DB_PASSWORD || 'masterkey',
    databases: {
      dbusers: process.env.DB_NAME_USERS || 'dbusers',
      dbcheckin: process.env.DB_NAME_CHECKIN || 'dbcheckin',
      dbmercocamp: process.env.DB_NAME_MERCOCAMP || 'dbmercocamp'
    }
  },
  
  // Configurações do servidor
  server: {
    port: process.env.PORT || 4000,
    environment: 'development'
  },
  
  // Configurações JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev_jwt_secret_key_2025',
    expiresIn: process.env.JWT_EXPIRE || '7d'
  },
  
  // Configurações de rate limiting
  rateLimit: {
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 1000 // máximo 1000 requests por IP (mais permissivo para desenvolvimento)
  },
  
  // Configurações CORS
  cors: {
    allowedOrigins: [
      // Desenvolvimento local
      'http://localhost:8000',
      'http://127.0.0.1:8000',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:4000',
      'http://127.0.0.1:4000',
      // Produção (para testes)
      'https://schedule-mercocamp-front-end2.vercel.app',
      'https://recebimento.mercocamptech.com.br',
      'http://recebimento.mercocamptech.com.br',
      'https://recebhomolog.mercocamptech.com.br',
      'http://recebhomolog.mercocamptech.com.br',
      // Variações com e sem porta
      'http://recebhomolog.mercocamptech.com.br:80',
      'http://recebhomolog.mercocamptech.com.br:443',
      'https://recebhomolog.mercocamptech.com.br:443',
      // Variáveis de ambiente
      process.env.FRONTEND_URL,
      process.env.ALLOWED_ORIGINS
    ].filter(Boolean)
  },
  
  // Configurações do Corpem WMS
  corpem: {
    baseURL: process.env.CORPEM_BASE_URL || 'http://webcorpem.no-ip.info:800/scripts/mh.dll/wc',
    cnpjWms: process.env.CORPEM_CNPJ_WMS || '27630772000244',
    token: process.env.CORPEM_TOKEN || '6cnc3',
    tokenHeader: process.env.CORPEM_TOKEN_HEADER || 'TOKEN_CP'
  }
};
