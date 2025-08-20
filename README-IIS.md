# Guia de Implantação no IIS

Este guia fornece instruções detalhadas para implantar o back-end Flask junto com o front-end Vue.js no IIS do Windows.

## Pré-requisitos

1. **Windows Server** com IIS instalado
2. **Python 3.8+** instalado e adicionado ao PATH
3. **wfastcgi** instalado para integração Python-IIS
4. **Módulo de URL Rewrite** para IIS instalado

## Instalação dos Pré-requisitos

### 1. Instalar Python

1. Baixe o instalador Python 3.x da [página oficial](https://www.python.org/downloads/windows/)
2. Execute o instalador e marque a opção "Add Python to PATH"
3. Verifique a instalação: `python --version`

### 2. Instalar Módulos do IIS

1. Abra o **Server Manager** -> **Manage** -> **Add Roles and Features**
2. Selecione **Role-based or feature-based installation**
3. Em **Server Roles**, expanda **Web Server (IIS)** e verifique se os seguintes componentes estão selecionados:
   - **Web Server** -> **Application Development** -> **CGI**

4. Instale o módulo URL Rewrite:
   - Baixe o instalador do [site oficial da Microsoft](https://www.iis.net/downloads/microsoft/url-rewrite)
   - Execute o instalador

### 3. Instalar wfastcgi

1. Abra o PowerShell como administrador
2. Execute:
   ```
   pip install wfastcgi
   wfastcgi-enable
   ```
3. Anote o caminho do wfastcgi.py exibido (geralmente em `C:\Python3X\Lib\site-packages\wfastcgi.py`)

## Configuração do Projeto

### 1. Preparar os Arquivos

1. Copie todo o projeto para uma pasta em seu servidor, por exemplo:
   `C:\inetpub\wwwroot\agenda-mercocamp`

2. Verifique a estrutura de diretórios:
   ```
   agenda-mercocamp\
     ├── backend\           # Código-fonte do back-end Flask
     ├── dist\              # Arquivos estáticos do front-end Vue.js
     ├── wsgi.py            # Ponto de entrada para o IIS
     └── web.config         # Configuração do IIS
   ```

### 2. Instalar Dependências Python

1. Abra o PowerShell como administrador
2. Navegue até a pasta do projeto:
   ```
   cd C:\inetpub\wwwroot\agenda-mercocamp
   ```
3. Instale as dependências:
   ```
   pip install -r backend\requirements.txt
   ```

### 3. Editar o web.config

Ajuste o arquivo `web.config` na raiz do projeto com os caminhos corretos:

1. Corrija o caminho do Python em `scriptProcessor`:
   ```xml
   scriptProcessor="C:\Python38\python.exe|C:\Python38\Lib\site-packages\wfastcgi.py"
   ```

2. Ajuste o `PYTHONPATH` para apontar para a pasta do projeto:
   ```xml
   <environmentVariable name="PYTHONPATH" value="C:\inetpub\wwwroot\agenda-mercocamp" />
   ```

3. Configure as variáveis de ambiente para banco de dados e JWT:
   ```xml
   <environmentVariable name="DB_HOST" value="seu-servidor-mysql" />
   <environmentVariable name="JWT_SECRET" value="sua-chave-secreta" />
   ```

## Configuração do IIS

### 1. Criar Site no IIS

1. Abra o IIS Manager
2. Clique com o botão direito em **Sites** -> **Add Website**
3. Configure:
   - **Site name**: `Agenda-Mercocamp`
   - **Physical path**: `C:\inetpub\wwwroot\agenda-mercocamp`
   - **Binding**: Escolha a porta (ex: 80) ou configure um hostname

### 2. Configurar Application Pool

1. Clique com o botão direito no Application Pool do site e selecione **Basic Settings**
2. Configure:
   - **.NET CLR version**: `No Managed Code`
   - **Managed pipeline mode**: `Integrated`

### 3. Configurar Permissões

1. Dê permissões de leitura/escrita para o usuário do Application Pool (`IIS AppPool\<nome-do-pool>`) na pasta do projeto

## Verificação

### 1. Diagnosticar Problemas

1. Execute a ferramenta de diagnóstico para verificar a configuração:
   ```
   cd C:\inetpub\wwwroot\agenda-mercocamp
   python backend\check_iis.py
   ```

2. Verifique os logs do IIS em:
   ```
   C:\inetpub\logs\LogFiles\W3SVC1\
   ```

### 2. Testar a API

1. Acesse o endpoint de health check: `http://seu-servidor/api/health`
2. Verifique se a resposta é um JSON com status "ok"

### 3. Testar o Front-end

1. Acesse `http://seu-servidor/` no navegador
2. O front-end Vue.js deve ser carregado corretamente

## Solução de Problemas

### Erro 500 - Internal Server Error

1. Verifique os logs do IIS
2. Execute o aplicativo Python diretamente para ver erros:
   ```
   cd C:\inetpub\wwwroot\agenda-mercocamp
   python wsgi.py
   ```

### Erro 404 - Not Found

1. Verifique se o módulo URL Rewrite está instalado
2. Confirme se o web.config está correto
3. Teste caminhos específicos para identificar o problema:
   - `/api/health` - Deve retornar um JSON
   - `/` - Deve carregar o front-end

### Problemas de Permissão

1. Dê permissões adequadas à pasta:
   ```
   icacls "C:\inetpub\wwwroot\agenda-mercocamp" /grant "IIS AppPool\<nome-do-pool>":(OI)(CI)(F)
   ```

## Referências

- [Hospedando Flask no IIS](https://medium.com/@bilalbayasut/deploying-python-web-app-flask-in-windows-server-iis-using-fastcgi-6c1873ae0ad8)
- [wfastcgi no GitHub](https://github.com/microsoft/PTVS/tree/master/Python/Product/WFastCgi)
- [Usando URL Rewrite com IIS](https://learn.microsoft.com/pt-br/iis/extensions/url-rewrite-module/creating-rewrite-rules-for-the-url-rewrite-module)
