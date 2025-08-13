# 🔍 INVESTIGAÇÃO: Conectividade do Banco de Dados

## 📊 Status Atual
- **Host**: `mercocamp.ip.odhserver.com`
- **IP**: `209.14.143.48` (DNS resolvendo)
- **Porta**: `33101`
- **Usuário**: `projetos`
- **Senha**: `masterkey`

## ❌ Problema Identificado
**ETIMEDOUT** consistente = Servidor/porta inacessível

## 🔍 Possíveis Causas

### 1. **Servidor MySQL Não Executando**
- Serviço MySQL pode estar parado no host remoto
- Necessário verificar: `systemctl status mysql` no servidor

### 2. **Configuração de Firewall**
- Porta 33101 pode estar bloqueada para conexões externas
- IPs do Render.com não estão na whitelist do firewall

### 3. **Configuração MySQL**
```sql
-- Verificar se permite conexões remotas:
SHOW VARIABLES LIKE 'bind_address';  -- Deve ser 0.0.0.0, não 127.0.0.1

-- Verificar privilégios do usuário:
SELECT User, Host FROM mysql.user WHERE User = 'projetos';
```

### 4. **Porta Incorreta**
- Porta padrão MySQL: 3306
- Porta configurada: 33101 (não padrão)
- Pode ter sido alterada ou estar incorreta

### 5. **Host/IP Incorreto**
- O subdomínio `*.ip.odhserver.com` pode não existir mais
- Provedor pode ter alterado a configuração

## ✅ Ações Necessárias

### 1. **Verificar o Servidor**
- Acessar o painel do provedor (ODH Server?)
- Verificar se o MySQL está executando
- Confirmar porta e configurações de rede

### 2. **Testar Portas Alternativas**
```bash
# Testar porta padrão MySQL:
telnet mercocamp.ip.odhserver.com 3306

# Testar outras portas comuns:
telnet mercocamp.ip.odhserver.com 3307
telnet mercocamp.ip.odhserver.com 33060
```

### 3. **Verificar DNS/IP**
- Confirmar se o subdomínio ainda é válido
- Testar IP direto: `209.14.143.48`
- Verificar se há mudanças nas configurações DNS

### 4. **Configurar Firewall**
- Adicionar IPs do Render.com na whitelist
- Verificar regras de entrada na porta 33101

## 🎯 Próximos Passos
1. **Você tem acesso ao painel do servidor/provedor?**
2. **Pode verificar se o MySQL está executando?**
3. **Existe documentação das configurações originais?**
4. **Há outros ambientes (local/staging) que funcionam?**