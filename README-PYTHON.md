# Back-end em Python Flask para Agenda Mercocamp

Este é um back-end em Python com Flask que implementa as mesmas rotas e funcionalidades do back-end Node.js original, sendo adaptado para implantação no IIS do Windows.

## Estrutura do Projeto

```
/                                   # Raiz do projeto
├── backend/                        # Pasta com o código do back-end Flask
│   ├── app.py                      # Aplicação Flask principal
│   ├── init_app.py                 # Módulo de inicialização comum
│   ├── load_env.py                 # Módulo para carregar variáveis de ambiente
│   ├── requirements.txt            # Dependências Python
│   ├── run.py                      # Script para executar localmente durante desenvolvimento
│   ├── setup.py                    # Script para configuração inicial do projeto
│   ├── check_iis.py                # Ferramenta para verificar configurações do IIS
│   ├── env.example                 # Modelo para arquivo .env
│   └── README-FLASK.md             # Documentação detalhada do back-end
├── backend_flask.py                # Script principal para iniciar o servidor Flask
├── wsgi.py                         # Arquivo WSGI para implantação em servidores web
├── start_flask.bat                 # Script batch para iniciar o servidor
├── web.config                      # Configuração para IIS
└── README-PYTHON.md                # Este arquivo
```

## Pré-requisitos

- Python 3.8 ou superior
- IIS instalado no Windows (para produção)
- Módulo wfastcgi para IIS (para produção)

## Desenvolvimento Local

1. **Instalação das Dependências:**

   ```bash
   pip install -r backend/requirements.txt
   ```

2. **Configuração das Variáveis de Ambiente:**

   Crie um arquivo `.env` na raiz do projeto baseado no modelo `backend/env.example`.

3. **Iniciando o Servidor:**

   No Windows, execute:
   ```
   start_flask.bat
   ```

   Ou diretamente com Python:
   ```bash
   python backend_flask.py
   ```

4. **Acesso à API:**

   A API estará disponível em `http://localhost:4000/api`

## Implantação no IIS

### 1. Preparação do Ambiente

1. Instale o Python 3.x no servidor Windows
2. Instale o módulo wfastcgi:
   ```
   pip install wfastcgi
   wfastcgi-enable
   ```
3. Instale as dependências do projeto:
   ```
   pip install -r backend/requirements.txt
   ```

### 2. Configuração do IIS

1. Crie um novo site no IIS apontando para a pasta raiz do projeto
2. Configure o Application Pool para "No Managed Code"
3. Verifique se o web.config está configurado corretamente:
   - Ajuste o caminho do Python em `scriptProcessor`
   - Ajuste o `PYTHONPATH` para o caminho da sua pasta do projeto
   - Configure as variáveis de ambiente como necessário

### 3. Verificação

1. Verifique a configuração com a ferramenta de diagnóstico:
   ```
   python backend\check_iis.py
   ```

2. Acesse `http://seu-servidor/api/health` para verificar se o back-end está funcionando

## Características Principais

- Autenticação JWT com os mesmos padrões do back-end Node.js
- Mesmas rotas e formatos de resposta da API original
- Integração com os mesmos bancos de dados MySQL
- Configuração para servir o front-end estático junto com a API
- Suporte para implantação no IIS junto com front-end Vue.js

## Notas de Integração com Front-end

1. Após compilar o front-end Vue.js com `npm run build`, copie o conteúdo da pasta `dist` para a raiz do projeto, no mesmo nível dos arquivos do back-end.

2. O web.config está configurado para:
   - Servir a API em `/api/*`
   - Servir os arquivos estáticos do front-end para outras rotas

3. Isso permite que o front-end e o back-end compartilhem o mesmo IP, como solicitado.

## Referências

Para instruções mais detalhadas, consulte:
- `backend/README-FLASK.md` - Documentação detalhada do back-end Flask
- `backend/FLASK-SUMMARY.md` - Resumo da implementação
