# 🚀 Guia de Deploy do Backend na Vercel

Este guia explica como fazer o deploy do backend do Sistema de Agendamentos na plataforma Vercel.

## 📋 Pré-requisitos

1. Uma conta na [Vercel](https://vercel.com) (gratuita)
2. [Git](https://git-scm.com/) instalado
3. Código do backend pronto para deploy

## 🔧 Arquivos Necessários

Os seguintes arquivos foram configurados para o deploy na Vercel:

1. `vercel.json` - Configuração principal do deploy
2. `app.js` - Ponto de entrada da aplicação Express

## 🚀 Passos para Deploy

### 1. Prepare o Repositório

Certifique-se que o repositório contém:
- Todo o código do backend
- O arquivo `vercel.json` atualizado
- O arquivo `package.json` com todas as dependências

### 2. Crie as Variáveis de Ambiente na Vercel

Antes de fazer o deploy, você precisa configurar as variáveis de ambiente secretas na Vercel:

1. Acesse [vercel.com](https://vercel.com) e faça login
2. Crie um novo projeto ou acesse um existente
3. Vá em **Settings** → **Environment Variables**
4. Adicione as seguintes variáveis:
   - `JWT_SECRET` - Chave secreta para JWT
   - `DB_HOST` - Host do banco MySQL
   - `DB_PORT` - Porta do banco MySQL
   - `DB_USER` - Usuário do banco MySQL
   - `DB_PASSWORD` - Senha do banco MySQL

### 3. Faça o Deploy

#### Opção 1: Deploy via Vercel Dashboard

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório do GitHub/GitLab/Bitbucket
3. Configure as opções:
   - **Framework Preset:** Other
   - **Root Directory:** ./
   - **Build Command:** Deixe em branco
   - **Output Directory:** Deixe em branco
4. Clique em **Deploy**

#### Opção 2: Deploy via CLI da Vercel

1. Instale a Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. Faça login:
   ```bash
   vercel login
   ```

3. Execute o deploy da pasta do projeto:
   ```bash
   cd schedule-back-end
   vercel
   ```

4. Siga as instruções na tela

## ⚙️ Configuração do vercel.json

O arquivo `vercel.json` foi configurado para:

- Usar o arquivo `app.js` como ponto de entrada
- Configurar cabeçalhos CORS para permitir requisições cross-origin
- Definir limites de memória e duração para funções
- Configurar variáveis de ambiente

```json
{
  "version": 2,
  "name": "schedule-mercocamp-api",
  "builds": [
    {
      "src": "app.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/app.js",
      "methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      "headers": {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, Cache-Control, Pragma, X-Large-Header"
      }
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

## 🔗 Conectando Frontend e Backend

### Configuração do Frontend

Uma vez que o backend esteja hospedado na Vercel, configure o frontend para apontar para a URL gerada:

1. Edite o arquivo `config.js` do frontend:
   ```javascript
   window.API_CONFIG = {
     API_URL: 'https://seu-backend.vercel.app/api'
   };
   ```

2. Faça o build e deploy do frontend normalmente

## 🔍 Limitações e Considerações

1. **Funções Serverless:** A Vercel usa um modelo serverless, então o backend terá cold starts
2. **Limites da Versão Gratuita:**
   - Funções limitadas a 10 segundos de execução
   - 100GB de banda por mês
   - Sem persistência de arquivos
3. **Banco de Dados:**
   - O MySQL precisa ser hospedado em outro serviço
   - A Vercel não fornece bancos de dados
   - Certifique-se que o banco permite conexões do IP da Vercel

## 📝 Troubleshooting

### Erro: Function Invocation Failed

Causas possíveis:
- Timeout da função (mais de 10 segundos)
- Erro no código
- Variáveis de ambiente ausentes

Solução: Verifique os logs na dashboard da Vercel.

### Erro: CORS

Causa: Configuração CORS incorreta.

Solução: Verifique se os cabeçalhos CORS estão configurados corretamente no `vercel.json`.

### Erro: Cannot Connect to Database

Causa: Banco de dados inacessível.

Solução: Verifique se o banco de dados permite conexões externas do IP da Vercel.

## 🌐 URLs de Teste

Depois do deploy, teste a API com estas URLs:

- **Health Check:** `https://seu-backend.vercel.app/api/health`
- **Info:** `https://seu-backend.vercel.app/api/info`
- **Login:** `https://seu-backend.vercel.app/api/auth/login` (POST)

---

Lembre-se que a Vercel é mais adequada para APIs leves. Se seu backend tiver alta demanda ou operações intensivas, considere uma hospedagem tradicional como VPS ou serviços dedicados para Node.js.
