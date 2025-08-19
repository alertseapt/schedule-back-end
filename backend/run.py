"""
Script para iniciar a aplicação Flask localmente para testes
Uso específico dentro da pasta backend durante o desenvolvimento
"""
from init_app import get_app

if __name__ == '__main__':
    # Importar a aplicação Flask usando o módulo de inicialização
    app = get_app()
    
    port = 4000
    
    print("""
============================================================
🚀 INICIANDO SERVIDOR FLASK DE DESENVOLVIMENTO (INTERNO)
============================================================

A API estará disponível em:
✅ http://localhost:4000/api

Para testar se a API está funcionando, acesse:
🏥 http://localhost:4000/api/health

Para parar o servidor, pressione CTRL+C
""")
    app.run(host='0.0.0.0', port=port, debug=True)
