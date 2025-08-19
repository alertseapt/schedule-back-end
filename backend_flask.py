"""
Script principal para iniciar o servidor Flask na raiz do projeto
Serve como ponto de entrada para o back-end Python
"""
import os
from backend.init_app import get_app

if __name__ == '__main__':
    # Importar a aplicação Flask usando o módulo de inicialização
    app = get_app()
    
    # Obter porta das variáveis de ambiente ou usar 4000 como padrão
    port = int(os.environ.get('PORT', 4000))
    
    print("""
============================================================
🚀 INICIANDO SERVIDOR BACKEND FLASK
============================================================

A API estará disponível em:
✅ http://localhost:{0}/api

Para testar se a API está funcionando, acesse:
🏥 http://localhost:{0}/api/health

Para parar o servidor, pressione CTRL+C
""".format(port))
    
    # Iniciar o servidor Flask
    app.run(host='0.0.0.0', port=port, threaded=True)
