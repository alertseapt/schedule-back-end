# Correção de Problemas de Conexão com Banco de Dados na Railway

## Problema

A aplicação está iniciando corretamente na Railway, mas apresenta falhas na conexão com os bancos de dados:

```
❌ dbcheckin: Erro na conexão
❌ dbmercocamp: Erro na conexão
❌ dbusers: Erro na conexão
```

## Causa

Este problema ocorre porque o servidor MySQL (`mercocamp.ip.odhserver.com`) provavelmente tem restrições de firewall que permitem conexões apenas de IPs específicos. Os servidores da Railway possuem IPs diferentes que não estão na whitelist.

## Solução

### 1. Obtenha o IP da Railway

Acesse a aplicação já implantada na Railway e use o endpoint específico para descobrir o IP:

```
GET /api/railway-ip
```

Este endpoint retornará o IP externo da sua aplicação na Railway, que precisa ser liberado no firewall do MySQL.

### 2. Adicione o IP à whitelist do MySQL

Com o IP da Railway em mãos:

1. Contate o administrador do banco de dados MySQL
2. Solicite a inclusão deste IP na whitelist do firewall
3. O IP deve ser autorizado a acessar a porta MySQL (33101)

### 3. Variáveis de Ambiente na Railway

Certifique-se de que as seguintes variáveis de ambiente estão configuradas no projeto Railway:

```
NODE_ENV=production
DB_HOST=mercocamp.ip.odhserver.com
DB_PORT=33101
DB_USER=projetos
DB_PASSWORD=masterkey
DB_CHECKIN=dbcheckin
DB_MERCOCAMP=dbmercocamp
DB_USERS=dbusers
JWT_SECRET=seu_jwt_secret_aqui
FRONTEND_URL=https://seu-frontend-url
```

### 4. Reinicie a aplicação

Após configurar o firewall e as variáveis de ambiente, reinicie a aplicação na Railway.

## Verificação

Para verificar se a conexão foi estabelecida:

1. Acesse o endpoint de health check:
   ```
   GET /api/health
   ```

2. Verifique se o status do banco de dados mudou para "connected"

## Problemas Persistentes

Se os problemas persistirem:

1. Verifique os logs da aplicação na Railway
2. Confirme se o IP da Railway não mudou (eles podem usar IPs dinâmicos)
3. Verifique se as credenciais do banco de dados estão corretas
4. Teste se o banco de dados está acessível de outros locais
