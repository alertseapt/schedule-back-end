"""
Script de inicialização específico para Railway
"""
import os
import sys
import logging

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Verificar o ambiente
logger.info("Iniciando aplicação no Railway")
logger.info(f"Python version: {sys.version}")
logger.info(f"Python path: {sys.executable}")
logger.info(f"Current directory: {os.getcwd()}")
logger.info(f"Files in current directory: {os.listdir('.')}")

# Variáveis de ambiente
logger.info(f"PORT: {os.environ.get('PORT', 'not set')}")

# Adicionar pasta backend ao path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
if os.path.exists(backend_dir):
    sys.path.append(backend_dir)
    logger.info(f"Backend directory added to path: {backend_dir}")
else:
    logger.error(f"Backend directory not found: {backend_dir}")

try:
    # Importar aplicação
    from backend.init_app import get_app
    application = get_app()
    logger.info("Application imported successfully")
    
    # Iniciar a aplicação
    port = int(os.environ.get('PORT', 4000))
    logger.info(f"Starting application on port {port}")
    application.run(host='0.0.0.0', port=port)
    
except Exception as e:
    logger.error(f"Error starting application: {e}")
    raise
