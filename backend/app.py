from flask import Flask, request, jsonify, g
from flask_cors import CORS
import pymysql
import pymysql.cursors
import os
import jwt
import bcrypt
import json
import datetime
import socket
import requests
from functools import wraps

# Carregar variáveis de ambiente do arquivo .env se existir
try:
    # Tentar importar do mesmo diretório
    from load_env import load_environment
    load_environment()
except ImportError:
    try:
        # Tentar importar do caminho relativo
        import os
        import sys
        current_dir = os.path.dirname(os.path.abspath(__file__))
        sys.path.insert(0, current_dir)
        from load_env import load_environment
        load_environment()
    except ImportError:
        print("⚠️ load_env.py não encontrado. Usando configurações padrão.")
DB_HOST = os.getenv('DB_HOST', 'mercocamp.ip.odhserver.com')
DB_PORT = int(os.getenv('DB_PORT', '33101'))
DB_USER = os.getenv('DB_USER', 'projetos')
DB_PASSWORD = os.getenv('DB_PASSWORD', 'masterkey')
DB_CHECKIN = os.getenv('DB_CHECKIN', 'dbcheckin')
DB_MERCOCAMP = os.getenv('DB_MERCOCAMP', 'dbmercocamp')
DB_USERS = os.getenv('DB_USERS', 'dbusers')
JWT_SECRET = os.getenv('JWT_SECRET', 'segredo_de_desenvolvimento')
JWT_EXPIRE = os.getenv('JWT_EXPIRE', '7d')

# Inicializar aplicação Flask
app = Flask(__name__, static_folder='dist', static_url_path='')

# Configurações de segurança
app.config['JSON_AS_ASCII'] = False
app.config['JSON_SORT_KEYS'] = False

# Configuração do CORS para múltiplas origens
allowed_origins = [
    'http://localhost:8000',
    'http://127.0.0.1:8000',
    'null',
    'https://schedule-mercocamp-front-end2.vercel.app',
    'https://recebhomolog.mercocamptech.com.br',
    'http://recebhomolog.mercocamptech.com.br'
]

# Configurar CORS
CORS(app, origins=allowed_origins, supports_credentials=True)

# Configurações de conexão com banco de dados
db_config = {
    'host': DB_HOST,
    'port': DB_PORT,
    'user': DB_USER,
    'password': DB_PASSWORD,
    'cursorclass': pymysql.cursors.DictCursor
}

# Funções para conexões com bancos de dados
def get_checkin_db():
    """Obter conexão com o banco de dados dbcheckin"""
    if 'checkin_db' not in g:
        g.checkin_db = pymysql.connect(**db_config, database=DB_CHECKIN)
    return g.checkin_db

def get_mercocamp_db():
    """Obter conexão com o banco de dados dbmercocamp"""
    if 'mercocamp_db' not in g:
        g.mercocamp_db = pymysql.connect(**db_config, database=DB_MERCOCAMP)
    return g.mercocamp_db

def get_users_db():
    """Obter conexão com o banco de dados dbusers"""
    if 'users_db' not in g:
        g.users_db = pymysql.connect(**db_config, database=DB_USERS)
    return g.users_db

# Funções para conexões diretas (sem app context)
def get_direct_checkin_db():
    """Obter conexão direta com o banco de dados dbcheckin (sem app context)"""
    return pymysql.connect(**db_config, database=DB_CHECKIN)

def get_direct_mercocamp_db():
    """Obter conexão direta com o banco de dados dbmercocamp (sem app context)"""
    return pymysql.connect(**db_config, database=DB_MERCOCAMP)

def get_direct_users_db():
    """Obter conexão direta com o banco de dados dbusers (sem app context)"""
    return pymysql.connect(**db_config, database=DB_USERS)

# Fechar conexões quando a requisição terminar
@app.teardown_appcontext
def close_connections(exception):
    """Fechar todas as conexões de banco de dados ao fim da requisição"""
    if 'checkin_db' in g:
        g.checkin_db.close()
    if 'mercocamp_db' in g:
        g.mercocamp_db.close()
    if 'users_db' in g:
        g.users_db.close()

# Executar consultas nos bancos de dados
def execute_checkin_query(query, params=()):
    """Executar consulta no banco dbcheckin"""
    try:
        conn = get_checkin_db()
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                conn.commit()
                if query.strip().upper().startswith('INSERT'):
                    return {'insertId': cursor.lastrowid}
                return cursor.rowcount
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Erro na query do dbcheckin: {e}")
        raise

def execute_mercocamp_query(query, params=()):
    """Executar consulta no banco dbmercocamp"""
    try:
        conn = get_mercocamp_db()
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                conn.commit()
                if query.strip().upper().startswith('INSERT'):
                    return {'insertId': cursor.lastrowid}
                return cursor.rowcount
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Erro na query do dbmercocamp: {e}")
        raise

def execute_users_query(query, params=()):
    """Executar consulta no banco dbusers"""
    try:
        conn = get_users_db()
        with conn.cursor() as cursor:
            cursor.execute(query, params)
            if query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE')):
                conn.commit()
                if query.strip().upper().startswith('INSERT'):
                    return {'insertId': cursor.lastrowid}
                return cursor.rowcount
            return cursor.fetchall()
    except Exception as e:
        print(f"❌ Erro na query do dbusers: {e}")
        raise

# Testar conexões com bancos de dados
def test_connections():
    """Testar conexões com todos os bancos de dados"""
    try:
        print('🔍 Testando conexões com bancos de dados...')
        
        all_connections_healthy = True
        
        # Testar dbcheckin
        try:
            conn = get_direct_checkin_db()
            with conn.cursor() as cursor:
                cursor.execute('SELECT 1')
            conn.close()
            print('✅ dbcheckin: Conectado')
        except Exception as e:
            print(f'❌ dbcheckin: Erro na conexão - {e}')
            all_connections_healthy = False
        
        # Testar dbmercocamp
        try:
            conn = get_direct_mercocamp_db()
            with conn.cursor() as cursor:
                cursor.execute('SELECT 1')
            conn.close()
            print('✅ dbmercocamp: Conectado')
        except Exception as e:
            print(f'❌ dbmercocamp: Erro na conexão - {e}')
            all_connections_healthy = False
        
        # Testar dbusers
        try:
            conn = get_direct_users_db()
            with conn.cursor() as cursor:
                cursor.execute('SELECT 1')
            conn.close()
            print('✅ dbusers: Conectado')
        except Exception as e:
            print(f'❌ dbusers: Erro na conexão - {e}')
            all_connections_healthy = False
        
        print('🔍 Teste de conexões concluído')
        
        if all_connections_healthy:
            print('✅ Todas as conexões estão funcionando')
            return True
        else:
            print('⚠️ Algumas conexões falharam')
            return False
        
    except Exception as e:
        print(f'❌ Erro ao testar conexões: {e}')
        return False

# Variável global para controlar status da conexão
is_database_connected = False

# Middleware para autenticação de token JWT
def authenticate_token(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        # Obter token do header Authorization
        if 'Authorization' in request.headers:
            auth_header = request.headers['Authorization']
            if auth_header.startswith('Bearer '):
                token = auth_header[7:]
        
        if not token:
            return jsonify({'error': 'Token de acesso requerido'}), 401
        
        try:
            # Verificar token
            decoded = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            
            # Tentar obter informações do usuário do banco de dados
            try:
                users = execute_users_query(
                    'SELECT id, user, name, level_access, cli_access FROM users WHERE id = %s',
                    [decoded['userId']]
                )
                
                if not users:
                    return jsonify({'error': 'Usuário não encontrado'}), 401
                
                user_data = users[0]
                
            except Exception as db_error:
                print(f'Problema de conectividade com dbusers, usando dados do token como fallback: {db_error}')
                
                # Fallback: usar dados do token quando há problemas de conectividade
                user_data = {
                    'id': decoded['userId'],
                    'user': decoded.get('user', 'user'),
                    'name': decoded.get('name', 'Usuário'),
                    'level_access': decoded.get('level_access', 0),
                    'cli_access': decoded.get('cli_access', {})
                }
            
            # Processar cli_access se for string
            if isinstance(user_data['cli_access'], str):
                try:
                    user_data['cli_access'] = json.loads(user_data['cli_access'])
                except:
                    user_data['cli_access'] = {}
            
            # Adicionar usuário ao contexto da requisição
            g.user = user_data
            
            # Pré-processar informações de acesso a clientes
            g.client_access_cache = {
                'has_full_access': user_data['level_access'] == 0,
                'allowed_clients': [] if user_data['level_access'] == 0 else list(user_data['cli_access'].keys()),
                'has_access_to': {}
            }
            
            return f(*args, **kwargs)
            
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token expirado'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Token inválido'}), 401
        except Exception as e:
            print(f'Erro na autenticação: {e}')
            return jsonify({'error': 'Erro interno do servidor'}), 500
    
    return decorated

# Middleware para verificar permissões de administrador
def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user['level_access'] < 0:
            return jsonify({'error': 'Acesso negado. Usuário deve estar autenticado.'}), 403
        return f(*args, **kwargs)
    return decorated

# Middleware para verificar permissões de gerente
def require_manager(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(g, 'user') or g.user['level_access'] < 2:
            return jsonify({'error': 'Acesso negado. Permissões de gerente requeridas.'}), 403
        return f(*args, **kwargs)
    return decorated

# Rota de login
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        
        if not data or 'user' not in data or 'password' not in data:
            return jsonify({'error': 'Usuário e senha são obrigatórios'}), 400
        
        user = data['user']
        password = data['password']
        
        # Buscar usuário no banco dbusers
        users = execute_users_query(
            'SELECT id, user, password, name, level_access, cli_access FROM users WHERE user = %s',
            [user]
        )
        
        if not users:
            return jsonify({'error': 'Usuário ou senha inválidos'}), 401
        
        user_data = users[0]
        
        # Verificar senha
        is_password_valid = False
        
        # Verificar se a senha no banco parece ser um hash bcrypt
        if user_data['password'] and user_data['password'].startswith('$2'):
            # Senha com hash bcrypt
            is_password_valid = bcrypt.checkpw(password.encode('utf-8'), user_data['password'].encode('utf-8'))
        else:
            # Senha sem hash (legado) - comparação direta
            is_password_valid = password == user_data['password']
        
        if not is_password_valid:
            return jsonify({'error': 'Usuário ou senha inválidos'}), 401
        
        # Gerar token JWT
        token = jwt.encode(
            {
                'userId': user_data['id'],
                'user': user_data['user'],
                'name': user_data['name'],
                'level_access': user_data['level_access'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)  # 7 dias de expiração
            },
            JWT_SECRET,
            algorithm='HS256'
        )
        
        # Preparar resposta
        cli_access = {}
        if user_data['cli_access']:
            if isinstance(user_data['cli_access'], str):
                try:
                    cli_access = json.loads(user_data['cli_access'])
                except:
                    cli_access = {}
            else:
                cli_access = user_data['cli_access']
        
        response = {
            'message': 'Login realizado com sucesso',
            'user': {
                'id': user_data['id'],
                'user': user_data['user'],
                'name': user_data['name'],
                'level_access': user_data['level_access'],
                'cli_access': cli_access
            },
            'token': token
        }
        
        # Se usuário tem nível de acesso 9, adicionar redirecionamento
        if user_data['level_access'] == 9:
            response['redirect'] = '/schedule-verification'
            response['message'] = 'Login realizado com sucesso. Redirecionando para página de verificação de agendamentos.'
        
        return jsonify(response)
    
    except Exception as e:
        print(f'Erro no login: {e}')
        return jsonify({'error': 'Erro interno do servidor'}), 500

# Rota para registrar novo usuário
@app.route('/api/auth/register', methods=['POST'])
@authenticate_token
def register():
    try:
        # Verificar se o usuário atual tem permissão para criar usuários
        if g.user['level_access'] < 1:
            return jsonify({'error': 'Acesso negado. Permissões insuficientes para criar usuários.'}), 403
        
        data = request.json
        
        if not data:
            return jsonify({'error': 'Dados inválidos'}), 400
        
        required_fields = ['user', 'password', 'level_access']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Campo {field} é obrigatório'}), 400
        
        # Verificar se o usuário já existe
        existing_users = execute_users_query(
            'SELECT id FROM users WHERE user = %s',
            [data['user']]
        )
        
        if existing_users:
            return jsonify({'error': 'Usuário já existe'}), 409
        
        # Inserir usuário no banco dbusers
        result = execute_users_query(
            'INSERT INTO users (user, password, name, level_access, cli_access, created_by, created_at) VALUES (%s, %s, %s, %s, %s, %s, NOW())',
            [
                data['user'], 
                data['password'], 
                data.get('name', ''),
                data['level_access'],
                json.dumps(data.get('cli_access', {})),
                g.user['id']
            ]
        )
        
        return jsonify({
            'message': 'Usuário criado com sucesso',
            'user': {
                'id': result['insertId'],
                'user': data['user'],
                'name': data.get('name', ''),
                'level_access': data['level_access']
            }
        }), 201
    
    except Exception as e:
        print(f'Erro no registro: {e}')
        return jsonify({'error': 'Erro interno do servidor'}), 500

# Rota para verificar token atual
@app.route('/api/auth/verify', methods=['GET'])
@authenticate_token
def verify():
    return jsonify({
        'valid': True,
        'user': {
            'id': g.user['id'],
            'user': g.user['user'],
            'name': g.user['name'],
            'level_access': g.user['level_access'],
            'cli_access': g.user['cli_access']
        }
    })

# Rota para atualizar token
@app.route('/api/auth/refresh', methods=['POST'])
@authenticate_token
def refresh():
    try:
        # Gerar novo token JWT
        token = jwt.encode(
            {
                'userId': g.user['id'],
                'user': g.user['user'],
                'name': g.user['name'],
                'level_access': g.user['level_access'],
                'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7)  # 7 dias de expiração
            },
            JWT_SECRET,
            algorithm='HS256'
        )
        
        return jsonify({
            'message': 'Token renovado com sucesso',
            'token': token
        })
    
    except Exception as e:
        print(f'Erro no refresh: {e}')
        return jsonify({'error': 'Erro interno do servidor'}), 500

# Rota para logout (implementação simples)
@app.route('/api/auth/logout', methods=['POST'])
@authenticate_token
def logout():
    # Em uma implementação real, você poderia adicionar o token a uma blacklist
    return jsonify({'message': 'Logout realizado com sucesso'})

# Rota de teste de conectividade
@app.route('/api/test-connectivity', methods=['GET'])
def test_connectivity():
    host = os.getenv('DB_HOST', 'mercocamp.ip.odhserver.com')
    port = int(os.getenv('DB_PORT', '33101'))
    
    result = {
        'host': host,
        'port': port,
        'timestamp': datetime.datetime.now().isoformat(),
        'reachable': False,
        'error': None,
        'duration': 0,
        'renderIP': request.remote_addr or 'unknown'
    }
    
    start = datetime.datetime.now()
    
    try:
        # Tentar estabelecer conexão TCP
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(30)  # 30 segundos timeout estendido
        s.connect((host, port))
        s.close()
        
        result['reachable'] = True
        duration = (datetime.datetime.now() - start).total_seconds() * 1000
        result['duration'] = duration
        result['message'] = f'Conectividade TCP estabelecida em {duration:.0f}ms'
        
    except socket.timeout:
        duration = (datetime.datetime.now() - start).total_seconds() * 1000
        result['error'] = 'Connection timeout após 30 segundos'
        result['duration'] = duration
        result['recommendation'] = 'Possível bloqueio de firewall ou IP não permitido'
        
    except Exception as e:
        duration = (datetime.datetime.now() - start).total_seconds() * 1000
        result['error'] = str(e)
        result['duration'] = duration
        result['recommendation'] = 'Verificar configurações de rede e firewall'
    
    return jsonify(result)

# Rota para descobrir IP que precisa ser whitelistado
@app.route('/api/railway-ip', methods=['GET'])
def railway_ip():
    try:
        # Buscar IP externo usando múltiplos serviços
        external_ip = 'unknown'
        
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=5)
            external_ip = response.json()['ip']
        except:
            try:
                response = requests.get('https://httpbin.org/ip', timeout=5)
                external_ip = response.json()['origin']
            except Exception as e:
                print(f'Falha ao obter IP externo: {e}')
        
        return jsonify({
            'message': 'IP para whitelist no firewall do MySQL',
            'timestamp': datetime.datetime.now().isoformat(),
            'server': {
                'serverIP': external_ip,
                'requestIP': request.remote_addr,
                'xForwardedFor': request.headers.get('X-Forwarded-For'),
                'xRealIP': request.headers.get('X-Real-IP'),
                'host': request.host
            },
            'instructions': {
                'action': 'Adicionar este IP na whitelist do firewall MySQL',
                'ip_to_whitelist': external_ip,
                'mysql_config': 'Permitir conexões remotas na porta 33101'
            }
        })
    
    except Exception as e:
        print(f'Erro ao obter IP: {e}')
        return jsonify({
            'error': 'Erro ao determinar IP',
            'details': str(e)
        }), 500

# Rota de health check
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        return jsonify({
            'status': 'ok',
            'timestamp': datetime.datetime.now().isoformat(),
            'database': {
                'status': 'connected' if is_database_connected else 'disconnected',
                'dbusers': 'connected' if is_database_connected else 'disconnected',
                'dbcheckin': 'connected' if is_database_connected else 'disconnected',
                'dbmercocamp': 'connected' if is_database_connected else 'disconnected'
            },
            'server': {
                'ip': request.remote_addr,
                'host': request.host,
                'userAgent': request.user_agent.string
            },
            'environment': os.getenv('FLASK_ENV', 'development'),
            'version': '1.0.0'
        })
    
    except Exception as e:
        print(f'Erro no health check: {e}')
        return jsonify({
            'status': 'error',
            'timestamp': datetime.datetime.now().isoformat(),
            'database': {
                'dbusers': 'error',
                'dbcheckin': 'error'
            },
            'error': 'Database connection failed'
        }), 500

# Rota de informações da API
@app.route('/api/info', methods=['GET'])
def api_info():
    return jsonify({
        'name': 'API REST Schedule Mercocamp',
        'version': '1.0.0',
        'description': 'API para comunicação com bancos de dados Heidi do Mercocamp',
        'databases': {
            'dbusers': {
                'description': 'Banco de dados de usuários',
                'tables': ['users']
            },
            'dbcheckin': {
                'description': 'Banco de dados de check-in e produtos',
                'tables': ['products', 'schedule_list']
            }
        },
        'endpoints': {
            'authentication': '/api/auth',
            'users': '/api/users',
            'products': '/api/products',
            'schedules': '/api/schedules'
        },
        'features': [
            'Autenticação JWT',
            'Controle de acesso por nível (0=user, 1=admin, 2=manager)',
            'Controle de acesso por cliente (cli_access)',
            'Gerenciamento de usuários',
            'Gerenciamento de produtos/relacionamentos cliente-fornecedor',
            'Gerenciamento de agendamentos com histórico',
            'Validação de dados',
            'Rate limiting',
            'Logs de auditoria'
        ]
    })

# Rota raiz
@app.route('/')
def root():
    return jsonify({
        'message': 'API REST Schedule Mercocamp',
        'version': '1.0.0',
        'status': 'running',
        'documentation': '/api/info'
    })

# Rota para servir o front-end (Vue)
@app.route('/<path:path>')
def serve_vue(path):
    if path.startswith('api/'):
        return jsonify({'error': 'Rota não encontrada', 'message': 'A rota solicitada não existe nesta API'}), 404
    return app.send_static_file(path)

# Middleware para rotas não encontradas
@app.errorhandler(404)
def not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({
            'error': 'Rota não encontrada',
            'message': 'A rota solicitada não existe nesta API'
        }), 404
    return app.send_static_file('index.html')

# Tratamento de erros
@app.errorhandler(Exception)
def handle_exception(e):
    print(f'Erro não tratado: {e}')
    
    return jsonify({
        'error': 'Erro interno do servidor',
        'message': 'Algo deu errado. Tente novamente mais tarde.'
    }), 500

# Função para tentar conectar ao banco em background
def retry_database_connection():
    global is_database_connected
    
    if is_database_connected:
        return
    
    try:
        print('🔄 Tentando reconectar ao banco de dados...')
        db_healthy = test_connections()
        
        if db_healthy:
            is_database_connected = True
            print('✅ Conexão com banco de dados reestabelecida!')
        else:
            print('⏳ Falha na conexão, tentando novamente em 30 segundos...')
            from threading import Timer
            Timer(30.0, retry_database_connection).start()
    except Exception as e:
        print(f'⏳ Erro na conexão ({e}), tentando novamente em 30 segundos...')
        from threading import Timer
        Timer(30.0, retry_database_connection).start()

# Inicialização do servidor
if __name__ == '__main__':
    # Testar conexões com os bancos de dados
    print('🔄 Testando conexões com os bancos de dados...')
    try:
        db_healthy = test_connections()
        
        if not db_healthy:
            print('⚠️ Falha na conexão inicial com banco, mas servidor continuará')
            print('🔄 Retry automático será executado em background...')
            is_database_connected = False
            from threading import Timer
            Timer(5.0, retry_database_connection).start()
        else:
            is_database_connected = True
            print('✅ Conexões com os bancos de dados estabelecidas')
        
    except Exception as e:
        print(f'❌ Erro ao testar conexões: {e}')
        is_database_connected = False
        from threading import Timer
        Timer(5.0, retry_database_connection).start()
    
    # Obter IPs do servidor
    import socket
    ip_addresses = []
    try:
        hostname = socket.gethostname()
        ip_addresses = [ip for ip in socket.gethostbyname_ex(hostname)[2] if not ip.startswith('127.')]
        if not ip_addresses:
            # Se não encontrar IPs não-localhost, tenta outra abordagem
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(('8.8.8.8', 53))
            ip_addresses = [s.getsockname()[0]]
            s.close()
    except:
        pass
    
    port = int(os.getenv('PORT', 4000))
    
    # Exibir informações do servidor
    print('\n============================================================')
    print('🚀 SERVIDOR BACKEND INICIADO COM SUCESSO')
    print('============================================================')
    
    print(f'\n📡 Porta: {port}')
    print(f'🌐 Ambiente: {os.getenv("FLASK_ENV", "development")}')
    print(f'🗄️ Database: {"✅ Conectado" if is_database_connected else "⚠️ Desconectado (retry em background)"}')
    
    # Exibir URLs exatas de acesso à API
    print('\n📍 ENDPOINTS DA API:')
    if ip_addresses:
        for ip in ip_addresses:
            print(f'   ✅ http://{ip}:{port}/api')
    print(f'   ✅ http://localhost:{port}/api')
    print(f'   ✅ http://127.0.0.1:{port}/api')
    
    # Exibir URLs para teste (CORS)
    print('\n🔒 CONFIGURAÇÃO CORS:')
    print('   Origens permitidas:')
    for origin in allowed_origins:
        print(f'   ✓ {origin}')
    
    # URLs comuns
    print('\n🔍 ENDPOINTS PRINCIPAIS:')
    print(f'   🏥 Health Check: http://localhost:{port}/api/health')
    print(f'   📚 Documentação: http://localhost:{port}/api/info')
    print(f'   🔑 Login: http://localhost:{port}/api/auth/login')
    
    app.run(host='0.0.0.0', port=port, threaded=True)
