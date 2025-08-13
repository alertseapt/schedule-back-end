# 🚀 Guia de Deploy - Render.com

## 📋 Configuração do Render

### Passo 1: Criar conta no Render
1. Acesse: https://render.com
2. Crie conta gratuita (pode usar GitHub)

### Passo 2: Conectar Repositório
1. No dashboard Render, clique **"New +"**
2. Selecione **"Web Service"**
3. Conecte sua conta GitHub
4. Selecione o repositório: `schedule-mercocamp-back-end`
5. Branch: `master`

### Passo 3: Configurar o Serviço
```yaml
Name: mercocamp-schedule-api
Environment: Node
Region: Oregon (US West) ou Frankfurt (Europe)
Branch: master
Root Directory: Back-end
Build Command: npm install
Start Command: npm start
Plan: Free
```

### Passo 4: Configurar Variáveis de Ambiente

No painel do Render, na seção **Environment**, adicione:

#### 🗄️ Banco de Dados
```
DB_HOST=mercocamp.ip.odhserver.com
DB_PORT=33101
DB_USER=projetos
DB_PASSWORD=masterkey
```

#### ⚙️ Aplicação
```
NODE_ENV=production
PORT=4000
JWT_SECRET=mercocamp_schedule_api_jwt_secret_key_2025_super_secure_render_production
JWT_EXPIRE=7d
RATE_LIMIT_WINDOW_MS=300000
RATE_LIMIT_MAX_REQUESTS=500
FRONTEND_URL=https://recebhomolog.mercocamptech.com.br
LOG_LEVEL=info
```

#### 📧 SMTP
```
SMTP_SERVER=smtp.hostinger.com
SMTP_PORT=587
SMTP_USE_TLS=true
SMTP_USER=no-reply@mercocamptech.com.br
SMTP_PASSWORD=Mercocamp.2025
SMTP_SENDER_NAME=Sistema de Agendamentos
SMTP_SENDER_EMAIL=no-reply@mercocamptech.com.br
```

#### 🏭 Corpem WMS
```
CORPEM_BASE_URL=http://webcorpem.no-ip.info:37560/scripts/mh.dll/wc
CORPEM_CNPJ_WMS=27630772000244
CORPEM_TOKEN=6cnc3
CORPEM_TOKEN_HEADER=TOKEN_CP
```

## 🔧 Deploy Automático

### Opção 1: Via render.yaml (Recomendado)
1. O arquivo `render.yaml` já está configurado
2. No Render Dashboard, em **Settings** → **Build & Deploy**
3. Marque **"Auto-Deploy"**: `Yes`
4. A cada push no `master`, será feito deploy automático

### Opção 2: Deploy Manual
1. No dashboard do serviço, clique **"Manual Deploy"**
2. Selecione **"Deploy latest commit"**

## 🧪 Testando o Deploy

### 1. Verificar Logs
- No painel Render, vá em **Logs**
- Procure por:
```
🚀 Servidor iniciado com sucesso!
✅ dbusers: Conectado
✅ dbcheckin: Conectado
✅ dbmercocamp: Conectado
```

### 2. Health Check
```bash
curl https://sua-app.onrender.com/api/health
```

**Resposta esperada:**
```json
{
  "status": "ok",
  "timestamp": "2025-01-13T...",
  "database": {
    "status": "connected",
    "dbusers": "connected",
    "dbcheckin": "connected", 
    "dbmercocamp": "connected"
  },
  "environment": "production"
}
```

### 3. Teste de Conectividade
```bash
curl https://sua-app.onrender.com/api/test-connectivity
```

## 🌐 Configurar Domínio Personalizado (Opcional)

### 1. No painel Render
1. Vá em **Settings** → **Custom Domains**
2. Adicione: `api.mercocamptech.com.br`
3. Configure DNS do domínio:
   - Tipo: `CNAME`
   - Nome: `api`
   - Valor: `sua-app.onrender.com`

### 2. SSL Automático
- O Render configura SSL automaticamente
- Certificado Let's Encrypt gratuito

## 🔍 Troubleshooting

### ❌ Erro: "Application failed to respond"
**Causa**: Servidor não iniciou corretamente
**Solução**: 
1. Verificar logs no painel Render
2. Confirmar variáveis de ambiente
3. Verificar se `npm start` funciona localmente

### ❌ Erro: "Database connection timeout"
**Causa**: Render não consegue acessar o MySQL
**Solução**: 
1. Verificar se o servidor MySQL aceita conexões externas
2. Confirmar credenciais nas variáveis de ambiente
3. Testar conectividade: `/api/test-connectivity`

### ❌ Build falha
**Causa**: Dependências ou script de build
**Solução**:
1. Confirmar que `npm install` roda localmente
2. Verificar versão do Node.js (>= 20.0.0)
3. Limpar cache: **Settings** → **Clear build cache**

## 📊 Monitoramento

### Métricas Gratuitas no Render:
- ✅ CPU e Memória
- ✅ Requests por minuto
- ✅ Response time
- ✅ Logs em tempo real

### Health Checks Automáticos:
- URL: `https://sua-app.onrender.com/api/health`
- Frequência: A cada 5 minutos
- Restart automático se falhar

## 🔐 Segurança

### Configurações Automáticas:
- ✅ HTTPS forçado
- ✅ Headers de segurança
- ✅ DDoS protection
- ✅ Firewall gerenciado

### Variáveis de Ambiente:
- ✅ Criptografadas
- ✅ Não aparecem nos logs
- ✅ Acessíveis apenas pela aplicação

## 💰 Limites do Plano Gratuito

- ✅ **750 horas/mês** (suficiente para uso contínuo)
- ✅ **100GB bandwidth/mês**
- ✅ **Sleep após 15 min inatividade** (acordar automático)
- ✅ **512MB RAM**
- ✅ **0.1 CPU**

## 🚀 URL Final

Após deploy bem-sucedido:
```
https://sua-app.onrender.com/api/health
```

---

## ✅ Checklist Final

- [ ] Conta Render criada
- [ ] Repositório conectado  
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy realizado com sucesso
- [ ] Health check funcionando
- [ ] Teste de conectividade passou
- [ ] Logs mostram conexões MySQL OK
- [ ] Frontend configurado para nova URL

🎉 **Deploy concluído com sucesso no Render!**