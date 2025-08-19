"""
Módulo para carregar variáveis de ambiente do arquivo .env
Usado como auxiliar para app.py
"""
import os
from dotenv import load_dotenv

def load_environment():
    """Carrega variáveis de ambiente do arquivo .env se existir"""
    # Tenta carregar do arquivo .env na raiz do projeto
    if os.path.exists('.env'):
        load_dotenv()
        print("✅ Variáveis de ambiente carregadas do arquivo .env na raiz")
    else:
        # Tentar localizar o arquivo .env na pasta superior (raiz do projeto)
        parent_env = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
        if os.path.exists(parent_env):
            load_dotenv(parent_env)
            print(f"✅ Variáveis de ambiente carregadas do arquivo {parent_env}")
        else:
            print("⚠️ Arquivo .env não encontrado. Usando configurações padrão.")

# Carregar variáveis de ambiente ao importar este módulo
load_environment()
