# Soluções para Problemas de Build na Railway

## Problemas Comuns e Soluções

### 1. Problemas de Compatibilidade de Node.js

- **Problema**: Versões incompatíveis de Node.js ou NPM
- **Solução**: Adicionamos no package.json a especificação explícita de versões:
  ```json
  "engines": {
    "node": ">=20.0.0",
    "npm": ">=9.0.0"
  }
  ```

### 2. Problemas de Inicialização

- **Problema**: Comandos de inicialização incorretos
- **Solução**: 
  - Adicionamos um arquivo `Procfile` específico
  - Criamos o script `start:railway` no package.json
  - Atualizamos o `railway.json` para usar o script correto

### 3. Problemas de Ambiente

- **Problema**: Variáveis de ambiente não configuradas corretamente
- **Solução**: Use o dashboard da Railway para definir todas as variáveis necessárias:
  ```
  NODE_ENV=production
  PORT=3000
  DB_HOST=mercocamp.ip.odhserver.com
  DB_PORT=33101
  DB_USER=projetos
  DB_PASSWORD=masterkey
  DB_CHECKIN=dbcheckin
  DB_MERCOCAMP=dbmercocamp
  DB_USERS=dbusers
  JWT_SECRET=seu_jwt_secret_seguro
  ```

### 4. Configuração de Build Específica

Para garantir que a build funcione corretamente, configuramos:

1. Arquivo `.buildpacks` para usar o buildpack Node.js correto
2. Script de inicialização avançado `start-railway.js` com diagnósticos
3. Configuração `railway.json` otimizada

### 5. Solução para Problemas de Conectividade

Se o problema persistir após essas mudanças, o script `start-railway.js` fornecerá:

- Logs detalhados sobre o problema de conectividade
- Testes de conexão TCP específicos
- Informações sobre possíveis bloqueios de firewall

## Como Testar a Build Localmente

Para simular o ambiente Railway localmente:

```bash
# Instalar dependências
npm install

# Executar o script de inicialização Railway
npm run start:railway
```

Isso permitirá identificar se o problema está relacionado à build ou especificamente ao ambiente da Railway.

## Próximos Passos se Persistir

Se após estas mudanças o problema ainda persistir:

1. Tente usar um banco de dados hospedado publicamente para testar
2. Considere configurar um proxy MySQL intermediário
3. Use um banco de dados Railway integrado temporariamente

O problema provavelmente não está na build, mas nas configurações de rede/firewall entre Railway e o servidor MySQL.
