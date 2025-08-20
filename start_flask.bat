@echo off
echo ============================================================
echo INICIANDO BACK-END PYTHON FLASK (SERVIDOR PRINCIPAL)
echo ============================================================

echo 1. Verificando ambiente Python...

python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Python nao encontrado! Instale Python 3.8+
    pause
    exit /b 1
)

echo 2. Verificando dependencias...
python -c "import flask" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias...
    pip install -r backend/requirements.txt
)

echo 3. Iniciando servidor Flask...
python backend_flask.py
pause
