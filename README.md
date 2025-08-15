# 🚀 Schedule Mercocamp Back-end

## 📋 Visão Geral
Sistema de agendamentos para a Mercocamp, desenvolvido em Node.js com integração a banco de dados MySQL e serviços de e-mail.

## 🎯 Funcionalidades Principais
- ✅ Sistema de autenticação e autorização
- ✅ Gestão de agendamentos
- ✅ Integração com banco de dados MySQL
- ✅ Sistema de notificações por e-mail
- ✅ Integração com Corpem WMS
- ✅ Verificação automática de DP (Documento de Portaria)
- ✅ Gestão de produtos e clientes
- ✅ API RESTful completa

## 📁 Estrutura do Projeto

```
📁 Back-end/
├── 📄 app.js                    # Servidor principal
├── 📄 package.json              # Dependências do projeto
├── 📄 .env                      # Variáveis de ambiente
├── 📁 config/                   # Configurações
│   ├── 📄 database.js           # Configuração de banco de dados
│   └── 📄 production.js         # Configuração para produção
├── 📁 routes/                   # Rotas da API
│   ├── 📄 auth.js               # Autenticação
│   ├── 📄 schedules.js          # Agendamentos
│   ├── 📄 users.js              # Usuários
│   ├── 📄 products.js           # Produtos
│   ├── 📄 clients.js            # Clientes
│   ├── 📄 corpem.js             # Integração Corpem
│   └── 📄 ...                   # Outras rotas
├── 📁 services/                  # Serviços de negócio
│   ├── 📄 emailService.js       # Serviço de e-mail
│   ├── 📄 productService.js     # Serviço de produtos
│   ├── 📄 corpemIntegration.js  # Integração Corpem
│   └── 📄 ...                   # Outros serviços
├── 📁 middleware/                # Middlewares
│   ├── 📄 auth.js               # Autenticação JWT
│   └── 📄 validation.js         # Validação de dados
└── 📁 sql/                      # Scripts SQL
    ├── 📄 products_table.sql    # Estrutura da tabela de produtos
    └── 📄 ...                   # Outros scripts
```

## 🛠️ Pré-requisitos

### Software Necessário
- ✅ Node.js (versão 16 ou superior)
- ✅ npm ou yarn
- ✅ MySQL Server
- ✅ Acesso ao banco de dados

### Variáveis de Ambiente
Crie um arquivo `.env` na raiz do projeto:

```env
# Configurações do Servidor
NODE_ENV=development
PORT=4000

# Configurações do Banco de Dados
DB_HOST=mercocamp.ip.odhserver.com
DB_PORT=33101
DB_USER=projetos
DB_PASSWORD=masterkey
DB_CHECKIN=dbcheckin
DB_MERCOCAMP=dbmercocamp
DB_USERS=dbusers

# Configurações JWT
JWT_SECRET=seu_jwt_secret_aqui
JWT_EXPIRES_IN=7d

# Configurações de E-mail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=seu_email@gmail.com
EMAIL_PASS=sua_senha_de_app

# Configurações de CORS
FRONTEND_URL=https://seu-front-end-url.com
```

## 🚀 Instalação e Configuração

### 1. Instalar Dependências
```bash
npm install
```

### 2. Configurar Banco de Dados
Certifique-se de que o banco de dados MySQL está acessível e as tabelas necessárias foram criadas.

### 3. Iniciar o Servidor
```bash
# Desenvolvimento
npm start

# Produção
NODE_ENV=production npm start
```

## 🔧 Configurações de Ambiente

### Desenvolvimento
- Usa configurações padrão
- CORS configurado para localhost
- Logs detalhados

### Produção (Railway)
- CORS restrito a origens específicas
- Configurações de segurança otimizadas
- Logs otimizados
- Variáveis de ambiente configuradas na plataforma Railway

## 🧪 Testando

### Health Check
```bash
curl http://localhost:4000/api/health
```

### Teste de Banco de Dados
```bash
curl http://localhost:4000/api/database-test/connectivity
```

### Teste de E-mail
```bash
curl -X POST http://localhost:4000/api/email-test/simple \
  -H "Content-Type: application/json" \
  -d '{"recipients": "teste@exemplo.com"}'
```

## 🔒 Segurança

- Autenticação JWT obrigatória para todas as rotas
- Validação de dados com Joi
- Rate limiting configurado
- Headers de segurança com Helmet
- CORS configurado por ambiente

## 📊 Monitoramento

- Health check endpoint `/api/health`
- Logs detalhados no console
- Métricas de performance
- Monitoramento de conexões de banco

## 🚨 Solução de Problemas

### Erro de CORS
- Verifique se o back-end está rodando com o ambiente correto
- Confirme que a origem está em `allowedOrigins` ou configurada como `FRONTEND_URL` nas variáveis de ambiente

### Erro de Conexão com Banco
- Verifique se as credenciais estão corretas
- Confirme se o banco está acessível
- Teste conectividade com `/api/database-test/connectivity`
- Para a Railway, verifique se o IP está autorizado no firewall do banco de dados usando `/api/railway-ip`

## 📞 Suporte

### Comandos de Diagnóstico
```bash
# Status geral
curl http://localhost:4000/api/health

# Teste de banco
curl http://localhost:4000/api/database-test/connectivity

# Teste de e-mail
curl -X POST http://localhost:4000/api/email-test/simple \
  -H "Content-Type: application/json" \
  -d '{"recipients": "teste@exemplo.com"}'
```

### Logs Importantes
- Console do servidor Node.js
- Logs do banco de dados
- Logs de e-mail

## 🔄 Deploy na Railway

### 1. Crie um Projeto na Railway
- Acesse [railway.app](https://railway.app)
- Crie uma nova conta ou faça login
- Crie um novo projeto

### 2. Configure o Deploy
- Conecte ao repositório Git ou faça upload do código
- Configure as variáveis de ambiente necessárias
- A Railway detectará automaticamente o projeto Node.js

### 3. Variáveis de Ambiente Essenciais
- `NODE_ENV`: production
- `PORT`: Definido automaticamente pela Railway
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_CHECKIN`, `DB_MERCOCAMP`, `DB_USERS`
- `JWT_SECRET`, `JWT_EXPIRES_IN`
- `FRONTEND_URL`: URL do seu front-end

### 4. Configuração do Banco de Dados
- Obtenha o IP da Railway usando o endpoint `/api/railway-ip`
- Adicione este IP à whitelist do seu banco de dados MySQL

### 5. Verifique o Deploy
- Acesse a URL fornecida pela Railway
- Verifique o endpoint de health check: `/api/health`

---

**Desenvolvido para Mercocamp** - Sistema de Agendamentos