"""
Script para configuração inicial da aplicação
"""
import os
import shutil
import getpass
import secrets
import sys

def setup_env():
    """Configurar arquivo .env a partir do env.example"""
    if os.path.exists('.env'):
        print("⚠️ Arquivo .env já existe. Deseja sobrescrevê-lo? (s/n): ", end="")
        choice = input().strip().lower()
        if choice != 's':
            print("❌ Operação cancelada.")
            return
    
    if not os.path.exists('env.example'):
        print("❌ Arquivo env.example não encontrado.")
        return
    
    # Ler o arquivo de exemplo
    with open('env.example', 'r', encoding='utf-8') as f:
        env_content = f.read()
    
    # Gerar um segredo JWT aleatório
    jwt_secret = secrets.token_hex(32)
    env_content = env_content.replace('seu_segredo_jwt_super_secreto_aqui', jwt_secret)
    
    # Configurar banco de dados
    print("\n==== Configuração do Banco de Dados ====")
    print("Deseja usar a configuração padrão do banco de dados? (s/n): ", end="")
    custom_db = input().strip().lower() != 's'
    
    if custom_db:
        host = input("Host do banco de dados [mercocamp.ip.odhserver.com]: ").strip() or "mercocamp.ip.odhserver.com"
        port = input("Porta [33101]: ").strip() or "33101"
        user = input("Usuário [projetos]: ").strip() or "projetos"
        password = getpass.getpass("Senha [masterkey]: ") or "masterkey"
        
        env_content = env_content.replace('mercocamp.ip.odhserver.com', host)
        env_content = env_content.replace('33101', port)
        env_content = env_content.replace('projetos', user)
        env_content = env_content.replace('masterkey', password)
    
    # Salvar o novo arquivo .env
    with open('.env', 'w', encoding='utf-8') as f:
        f.write(env_content)
    
    print("\n✅ Arquivo .env criado com sucesso!")

def setup_virtualenv():
    """Criar e configurar ambiente virtual Python"""
    if os.path.exists('venv'):
        print("⚠️ Ambiente virtual já existe. Deseja recriá-lo? (s/n): ", end="")
        choice = input().strip().lower()
        if choice != 's':
            print("❌ Operação cancelada.")
            return
        
        # Remover ambiente virtual existente
        try:
            shutil.rmtree('venv')
        except Exception as e:
            print(f"❌ Erro ao remover ambiente virtual: {e}")
            return
    
    # Criar novo ambiente virtual
    import subprocess
    try:
        print("\n🔄 Criando ambiente virtual...")
        subprocess.run([sys.executable, '-m', 'venv', 'venv'], check=True)
        
        # Instalar dependências
        print("\n🔄 Instalando dependências...")
        if os.name == 'nt':  # Windows
            pip = os.path.join('venv', 'Scripts', 'pip')
        else:  # Linux/Mac
            pip = os.path.join('venv', 'bin', 'pip')
        
        subprocess.run([pip, 'install', '-r', 'requirements.txt'], check=True)
        print("\n✅ Ambiente virtual configurado com sucesso!")
        
        # Instruções para ativar o ambiente
        print("\n==== Instruções para ativar o ambiente virtual ====")
        if os.name == 'nt':
            print("Execute: venv\\Scripts\\activate")
        else:
            print("Execute: source venv/bin/activate")
        
    except Exception as e:
        print(f"❌ Erro ao configurar ambiente virtual: {e}")

def main():
    """Função principal"""
    print("\n==== SETUP DA APLICAÇÃO FLASK PARA AGENDA MERCOCAMP ====\n")
    
    # Configurar .env
    print("\n==== 1. Configuração de Variáveis de Ambiente ====")
    setup_env()
    
    # Configurar ambiente virtual
    print("\n==== 2. Configuração do Ambiente Virtual Python ====")
    setup_virtualenv()
    
    print("\n==== SETUP CONCLUÍDO! ====")
    print("\nPara iniciar a aplicação:")
    print("1. Ative o ambiente virtual")
    if os.name == 'nt':
        print("   venv\\Scripts\\activate")
        print("2. Execute: start.bat")
    else:
        print("   source venv/bin/activate")
        print("2. Execute: python run.py")
    
    print("\nOu simplesmente execute o arquivo start.bat (Windows)")

if __name__ == "__main__":
    main()
