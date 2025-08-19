"""
Módulo de inicialização comum para a aplicação Flask
Este arquivo serve como um ponto único para importar a aplicação Flask
"""
import os
import sys

def init_paths():
    """Inicializa os caminhos para importação dos módulos"""
    # Obter o caminho absoluto da pasta backend
    current_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Adicionar o diretório atual ao path se já não estiver lá
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Se estamos sendo importados de fora da pasta backend
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.insert(0, parent_dir)

def get_app():
    """Retorna a instância da aplicação Flask"""
    # Inicializar caminhos
    init_paths()
    
    # Importar a aplicação Flask
    try:
        from app import app
        return app
    except ImportError as e:
        print(f"Erro ao importar a aplicação Flask: {e}")
        # Tente um caminho alternativo
        try:
            from backend.app import app
            return app
        except ImportError as e:
            print(f"Erro ao importar a aplicação Flask do caminho alternativo: {e}")
            raise ImportError("Não foi possível importar a aplicação Flask. Verifique a estrutura do projeto.")

# Inicializar caminhos automaticamente quando este módulo é importado
init_paths()
