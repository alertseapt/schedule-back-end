# 🚀 Guia de Deploy na Vercel - Backend Schedule Mercocamp

## 📋 Pré-requisitos

1. Conta na [Vercel](https://vercel.com)
2. [Git](https://git-scm.com/) instalado
3. Repositório no GitHub/GitLab/Bitbucket

## 🔧 Preparação do Projeto

### 1. Verificar Arquivos Essenciais

Certifique-se de que os seguintes arquivos existem:
- ✅ `vercel.json` - Configuração da Vercel
- ✅ `api/index.js` - Entry point serverless
- ✅ `app.js` - Aplicação Express
- ✅ `package.json` - Dependências
- ✅ `env.example` - Template de variáveis
- ✅ `.gitignore` - Ignorar arquivos sensíveis

### 2. Estrutura do Projeto

```
schedule-back-end/
├── api/
│   └── index.js        # Entry point para Vercel
├── config/             # Configurações do banco
├── middleware/         # Middlewares Express
├── routes/            # Rotas da API
├── services/          # Serviços
├── app.js             # Aplicação principal
├── vercel.json        # Config Vercel
├── package.json       # Dependências
├── env.example        # Template de variáveis
└── .gitignore         # Arquivos ignorados
```

## 📦 Deploy na Vercel

### Método 1: Deploy via GitHub (Recomendado)

1. **Fazer commit e push do código:**
```bash
git add .
git commit -m "Preparar backend para deploy na Vercel"
git push origin main
```

2. **Conectar na Vercel:**
   - Acesse [vercel.com/new](https://vercel.com/new)
   - Clique em "Import Git Repository"
   - Autorize acesso ao seu GitHub
   - Selecione o repositório `agenda-mercocamp`
   - Selecione a pasta `schedule-back-end` como Root Directory

3. **Configurar o projeto:**
   - **Framework Preset:** Other
   - **Root Directory:** `schedule-back-end`
   - **Build Command:** (deixe vazio ou `npm install`)
   - **Output Directory:** (deixe vazio)
   - **Install Command:** `npm install`

### Método 2: Deploy via CLI

1. **Instalar Vercel CLI:**
```bash
npm i -g vercel
```

2. **Login na Vercel:**
```bash
vercel login
```

3. **Deploy:**
```bash
cd schedule-back-end
vercel
```

4. **Seguir os prompts:**
   - Set up and deploy? `Y`
   - Which scope? (selecione sua conta)
   - Link to existing project? `N`
   - Project name? `schedule-mercocamp-backend`
   - Directory? `./`
   - Want to override settings? `N`

## 🔐 Configurar Variáveis de Ambiente

### Via Dashboard da Vercel:

1. Acesse seu projeto em [vercel.com/dashboard](https://vercel.com/dashboard)
2. Vá em **Settings** → **Environment Variables**
3. Adicione cada variável do arquivo `env.example`:

```env
NODE_ENV=production
PORT=4000
JWT_SECRET=mercocamp_schedule_api_jwt_secret_key_2025_super_secure_production
JWT_EXPIRE=7d

# Banco de Dados
DB_HOST=mercocamp.ip.odhserver.com
DB_PORT=33101
DB_USER=projetos
DB_PASSWORD=masterkey
DB_NAME_USERS=dbusers
DB_NAME_CHECKIN=dbcheckin
DB_NAME_MERCOCAMP=dbmercocamp

# Email SMTP
SMTP_SERVER=smtp.hostinger.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=no-reply@mercocamptech.com.br
SMTP_PASSWORD=Mercocamp.2025
SMTP_SENDER_NAME=Sistema de Agendamentos
SMTP_SENDER_EMAIL=no-reply@mercocamptech.com.br

# Corpem WMS
CORPEM_BASE_URL=http://webcorpem.no-ip.info:37560/scripts/mh.dll/wc
CORPEM_CNPJ_WMS=27630772000244
CORPEM_TOKEN=6cnc3
CORPEM_TOKEN_HEADER=TOKEN_CP

# Frontend URL
FRONTEND_URL=https://recebimento.mercocamptech.com.br
ALLOWED_ORIGINS=https://recebimento.mercocamptech.com.br,https://schedule-mercocamp-front-end2.vercel.app
```

4. Clique em **Save** para cada variável

### Via CLI:

```bash
vercel env add JWT_SECRET production
# Cole o valor e pressione Enter
# Repita para cada variável
```

## 🔄 Redeploy Após Configurar Variáveis

1. No dashboard da Vercel
2. Vá em **Deployments**
3. Clique nos 3 pontos do último deploy
4. Selecione **Redeploy**

## 🌐 URLs Geradas

Após o deploy, você terá:
- **URL de Produção:** `https://seu-projeto.vercel.app`
- **URL de Preview:** `https://seu-projeto-git-branch.vercel.app`

## 📝 Atualizar o Frontend

Atualize a URL da API no frontend para apontar para a URL da Vercel:

```javascript
// No arquivo de configuração do frontend
const API_URL = 'https://schedule-mercocamp-backend.vercel.app/api';
```

## ✅ Testar a API

1. **Health Check:**
```bash
curl https://seu-projeto.vercel.app/api/health
```

2. **Login:**
```bash
curl -X POST https://seu-projeto.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"user":"dev@test.com","password":"dev"}'
```

## 🐛 Troubleshooting

### Erro: "Function Timeout"
- Aumente o `maxDuration` no `vercel.json` (máximo 30s no plano free)

### Erro: "CORS Policy"
- Verifique se a URL do frontend está em `ALLOWED_ORIGINS`
- Certifique-se de que o `vercel.json` tem headers CORS configurados

### Erro: "Database Connection Failed"
- Verifique se o IP da Vercel está liberado no firewall do MySQL
- Confirme as credenciais do banco nas variáveis de ambiente

### Erro: "JWT Secret Missing"
- Certifique-se de configurar `JWT_SECRET` nas variáveis de ambiente
- Faça redeploy após adicionar variáveis

## 🔍 Logs e Monitoramento

1. **Ver logs em tempo real:**
   - Dashboard → Functions → View Logs

2. **Ver métricas:**
   - Dashboard → Analytics

## 🚨 Importante

- **Nunca** commite o arquivo `.env` real
- Use senhas fortes para `JWT_SECRET` em produção
- Configure limites de rate limiting apropriados
- Monitore uso de banda e execuções
- Configure alertas para erros

## 📞 Suporte

Para problemas específicos:
- [Documentação Vercel](https://vercel.com/docs)
- [Vercel Support](https://vercel.com/support)
- [Status Vercel](https://www.vercel-status.com/)

---

**Última atualização:** Janeiro 2025
