"""
Arquivo WSGI para implantação em servidores como IIS, Apache, etc.
"""
from backend.init_app import get_app

# Importar a aplicação Flask usando o módulo de inicialização
application = get_app()

# Esta variável application é usada por servidores WSGI
if __name__ == '__main__':
    application.run()
