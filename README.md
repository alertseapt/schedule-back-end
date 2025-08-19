# Back-end Python para Agenda Mercocamp

Back-end em Python utilizando Flask que implementa as mesmas rotas e funcionalidades do projeto original Node.js, adaptado para implantação em Railway.

## Estrutura do Projeto

```
/                                   # Raiz do projeto
├── backend/                        # Pasta com o código do back-end Flask
│   ├── app.py                      # Aplicação Flask principal
│   ├── init_app.py                 # Módulo de inicialização comum
│   ├── load_env.py                 # Módulo para carregar variáveis de ambiente
│   ├── requirements.txt            # Dependências Python
│   ├── run.py                      # Script para executar localmente
│   ├── setup.py                    # Script para configuração inicial
│   └── check_iis.py                # Ferramenta para verificar IIS
├── wsgi.py                         # Ponto de entrada para servidores WSGI
├── backend_flask.py                # Script para iniciar o servidor Flask
├── requirements.txt                # Dependências Python (raiz)
├── Procfile                        # Configuração para Heroku/Railway
├── railway.json                    # Configuração específica para Railway
└── README.md                       # Este arquivo
```

## Pré-requisitos

- Python 3.8 ou superior
- Pip (gerenciador de pacotes Python)
- Banco de dados MySQL

## Instalação Local

1. Clone o repositório
   ```bash
   git clone https://github.com/alertseapt/back-end-py.git
   cd back-end-py
   ```

2. Instale as dependências
   ```bash
   pip install -r requirements.txt
   ```

3. Configure as variáveis de ambiente
   ```bash
   # Crie um arquivo .env na raiz do projeto com as seguintes variáveis
   DB_HOST=seu_host_mysql
   DB_PORT=33101
   DB_USER=seu_usuario
   DB_PASSWORD=sua_senha
   DB_USERS=dbusers
   DB_CHECKIN=dbcheckin
   DB_MERCOCAMP=dbmercocamp
   JWT_SECRET=seu_segredo_jwt
   ```

4. Execute o servidor
   ```bash
   python backend_flask.py
   ```

## Deploy no Railway

1. Conecte seu repositório GitHub ao Railway
2. Configure as mesmas variáveis de ambiente mencionadas acima no Railway
3. O Railway detectará automaticamente o projeto Python e fará o deploy

## API Endpoints

- `/api/auth/login` - Login de usuário
- `/api/auth/register` - Registro de usuário
- `/api/users` - Gerenciamento de usuários
- `/api/products` - Gerenciamento de produtos
- `/api/schedules` - Gerenciamento de agendamentos
- `/api/health` - Status da API

## Tecnologias Utilizadas

- Flask - Framework web
- PyMySQL - Conexão com MySQL
- JWT - Autenticação
- Gunicorn - Servidor WSGI para produção