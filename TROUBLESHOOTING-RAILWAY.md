# Guia de Solução de Problemas para Deploy na Railway

## Visão Geral do Problema

O deploy na Railway está ocorrendo sem erros durante a fase de build, mas a aplicação não consegue se conectar ao banco de dados MySQL. Este documento fornece informações detalhadas para solucionar o problema.

## Checklist para Solução

### 1. Configuração de Variáveis de Ambiente

Verifique se todas estas variáveis de ambiente estão configuradas corretamente no painel da Railway:

```
NODE_ENV=production
DB_HOST=mercocamp.ip.odhserver.com
DB_PORT=33101
DB_USER=projetos
DB_PASSWORD=masterkey
DB_CHECKIN=dbcheckin
DB_MERCOCAMP=dbmercocamp
DB_USERS=dbusers
JWT_SECRET=seu_jwt_secret_seguro
FRONTEND_URL=https://schedule-mercocamp-front-end2.vercel.app
```

### 2. Problema de Firewall MySQL

O problema mais provável é que o banco de dados MySQL está rejeitando conexões dos servidores da Railway.

#### Como identificar o IP da Railway:

1. Acesse sua aplicação já implantada na Railway
2. Use o endpoint `/api/railway-ip` para obter o IP externo do servidor Railway
3. Contate o administrador do MySQL para adicionar este IP à whitelist

#### Detalhes para o administrador MySQL:

- IP a ser liberado: [IP obtido do endpoint `/api/railway-ip`]
- Porta: 33101
- Host: mercocamp.ip.odhserver.com

### 3. Usar Proxy para Banco de Dados (Alternativa)

Se não for possível liberar o IP da Railway no firewall:

1. Configure um servidor intermediário com IP já autorizado no firewall
2. Configure um proxy MySQL neste servidor
3. Aponte a aplicação Railway para este proxy em vez do banco diretamente

### 4. Verificar Conectividade TCP

Para testar se o problema é realmente de firewall:

1. Use a ferramenta `nc` (netcat) ou similar para testar a conectividade TCP
2. Verifique se o problema é específico do MySQL ou de conectividade de rede geral

```bash
nc -zv mercocamp.ip.odhserver.com 33101
```

### 5. Logs Detalhados

Implementamos um script de inicialização aprimorado (`start-railway.js`) que:

- Testa a conectividade TCP antes de iniciar a aplicação
- Fornece logs mais detalhados sobre o problema
- Mostra configurações atuais (sem informações sensíveis)

### 6. Reiniciar o Deploy

Após fazer as alterações:

1. Faça commit das alterações e envie para o GitHub
2. Acesse o dashboard da Railway
3. Reinicie o deploy manualmente ou configure para redeploy automático

## Status do Serviço

- Build: ✅ Funcionando corretamente
- Aplicação: ✅ Iniciando corretamente
- Conexão MySQL: ❌ Falhando (provavelmente por restrição de firewall)

## Próximos Passos

Se após seguir todos estes passos o problema persistir, considere:

1. Migrar o banco de dados para um serviço que permita conexões de qualquer IP
2. Configurar uma VPN ou túnel SSH para conectar ao banco atual
3. Usar um serviço de banco de dados gerenciado compatível com a Railway
