# Back-end Flask para Agenda Mercocamp

Este é um back-end em Python com Flask que implementa as mesmas rotas e funcionalidades do back-end Node.js original, sendo adaptado para implantação no IIS do Windows.

## Pré-requisitos

- Python 3.8 ou superior
- IIS instalado no Windows
- Módulo wfastcgi para IIS (para execução de aplicações Python no IIS)

## Instalação

### 1. Preparação do ambiente

1. Instale o Python 3.x no servidor Windows (recomendado adicionar ao PATH durante a instalação)
2. Abra o PowerShell como administrador e execute:

```powershell
# Instalar wfastcgi para integração com IIS
pip install wfastcgi
wfastcgi-enable

# Instalar as dependências do projeto
pip install -r requirements.txt
```

### 2. Configuração do IIS

1. Abra o IIS Manager (Gerenciador do IIS)
2. Crie um novo site ou aplicativo para a Agenda Mercocamp
3. Configure o caminho físico para apontar para a pasta onde estão os arquivos do projeto (app.py e a pasta dist do front-end)
4. Certifique-se de que o Application Pool está configurado para "No Managed Code"
5. Certifique-se de que o web.config está na raiz do site

### 3. Ajustar o web.config

Modifique o arquivo web.config para usar o caminho correto do Python e wfastcgi:

- Substitua `C:\Python310\python.exe` pelo caminho onde o Python está instalado
- Substitua `C:\Python310\Lib\site-packages\wfastcgi.py` pelo caminho correto do wfastcgi.py
- Ajuste `C:\inetpub\wwwroot\agenda-mercocamp` pelo caminho real do projeto

### 4. Configuração das variáveis de ambiente

As variáveis de ambiente estão definidas no web.config, mas você pode ajustá-las conforme necessário:

- `DB_HOST`: Hostname do banco de dados MySQL
- `DB_PORT`: Porta do banco de dados MySQL
- `DB_USER`: Usuário do banco de dados
- `DB_PASSWORD`: Senha do banco de dados
- `JWT_SECRET`: Chave secreta para assinatura dos tokens JWT (deve ser uma string segura)

### 5. Verificação da instalação

1. Reinicie o IIS após todas as configurações:

```powershell
iisreset
```

2. Acesse `http://seu-servidor/api/health` para verificar se o back-end está funcionando corretamente
3. Acesse `http://seu-servidor/` para verificar se o front-end está sendo servido corretamente

## Estrutura do Projeto

- `app.py`: Aplicação Flask principal com todas as rotas e lógica
- `web.config`: Configuração do IIS para a aplicação
- `requirements.txt`: Dependências Python do projeto
- `dist/`: Pasta contendo os arquivos do front-end (Vue.js compilado)

## Como funciona

- Requisições para `/api/*` são encaminhadas para a aplicação Flask
- Requisições para outros caminhos são servidas da pasta `dist/`

## Notas de Desenvolvimento

- Para fazer alterações na API, modifique o arquivo `app.py`
- Para testar localmente, execute `python app.py`
- A aplicação usa o mesmo banco de dados MySQL do projeto original, então nenhuma migração é necessária

## Troubleshooting

### Problema: 500 - Internal Server Error

1. Verifique os logs do IIS em `C:\inetpub\logs\LogFiles`
2. Verifique se o Python e wfastcgi estão instalados corretamente
3. Teste a conexão com o banco de dados usando o endpoint `/api/test-connectivity`

### Problema: 404 - Not Found para API

1. Verifique se as regras de rewrite no web.config estão corretas
2. Certifique-se de que a aplicação Flask está sendo executada corretamente

### Problema: API funciona, mas front-end não carrega

1. Verifique se os arquivos do front-end estão na pasta `dist`
2. Verifique se as rotas do front-end estão sendo corretamente redirecionadas pelo IIS
