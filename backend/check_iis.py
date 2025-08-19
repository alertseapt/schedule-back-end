"""
Script para verificar a integração do Flask com IIS
"""
import os
import sys
import subprocess
import ctypes

def is_admin():
    """Verificar se o script está sendo executado como administrador (apenas Windows)"""
    try:
        return os.name == 'nt' and ctypes.windll.shell32.IsUserAnAdmin() != 0
    except:
        return False

def check_python():
    """Verificar instalação do Python"""
    print("\n🔍 Verificando instalação do Python...")
    try:
        python_version = subprocess.check_output([sys.executable, '-V'], 
                                              stderr=subprocess.STDOUT, 
                                              universal_newlines=True).strip()
        print(f"✅ {python_version} encontrado")
        return True
    except:
        print("❌ Python não encontrado no PATH")
        return False

def check_wfastcgi():
    """Verificar instalação do wfastcgi"""
    print("\n🔍 Verificando instalação do wfastcgi...")
    try:
        # Verifica se o módulo está instalado
        import importlib
        wfastcgi_spec = importlib.util.find_spec("wfastcgi")
        if wfastcgi_spec is None:
            print("❌ Módulo wfastcgi não está instalado")
            print("   Execute: pip install wfastcgi")
            return False
        
        # Encontrar o caminho do arquivo wfastcgi.py
        wfastcgi_path = os.path.join(os.path.dirname(wfastcgi_spec.origin), "wfastcgi.py")
        if os.path.exists(wfastcgi_path):
            print(f"✅ wfastcgi encontrado em: {wfastcgi_path}")
            return True
        else:
            print("❌ Arquivo wfastcgi.py não encontrado")
            return False
    except Exception as e:
        print(f"❌ Erro ao verificar wfastcgi: {e}")
        return False

def check_iis():
    """Verificar instalação do IIS (somente Windows)"""
    if os.name != 'nt':
        print("\n⚠️ Verificação do IIS disponível apenas no Windows")
        return False
    
    print("\n🔍 Verificando instalação do IIS...")
    try:
        # Verificar se o serviço do IIS está em execução
        output = subprocess.check_output(["sc", "query", "W3SVC"], 
                                       stderr=subprocess.STDOUT, 
                                       universal_newlines=True)
        
        if "RUNNING" in output:
            print("✅ Serviço IIS (World Wide Web Publishing) está em execução")
            return True
        else:
            print("❌ Serviço IIS não está em execução")
            print("   Execute: net start W3SVC")
            return False
    except:
        print("❌ IIS não parece estar instalado")
        print("   Execute: dism /online /enable-feature /featurename:IIS-WebServerRole")
        return False

def check_fastcgi_config():
    """Verificar configuração do FastCGI no IIS"""
    if os.name != 'nt':
        print("\n⚠️ Verificação do FastCGI disponível apenas no Windows")
        return False
    
    if not is_admin():
        print("\n⚠️ Esta verificação requer privilégios de administrador")
        print("   Execute este script como administrador para verificar a configuração do FastCGI")
        return False
    
    print("\n🔍 Verificando configuração do FastCGI no IIS...")
    try:
        # Tenta executar o comando appcmd para listar as configurações de FastCGI
        appcmd_path = r"%systemroot%\system32\inetsrv\appcmd.exe"
        output = subprocess.check_output(f"{appcmd_path} list config -section:system.webServer/fastCgi", 
                                       stderr=subprocess.STDOUT, 
                                       shell=True,
                                       universal_newlines=True)
        
        if "python" in output.lower():
            print("✅ Configuração FastCGI para Python encontrada no IIS")
            print(f"   {output.strip()}")
            return True
        else:
            print("❌ Configuração FastCGI para Python não encontrada no IIS")
            print("   Execute: wfastcgi-enable")
            return False
    except Exception as e:
        print(f"❌ Erro ao verificar configuração FastCGI: {e}")
        print("   Execute: wfastcgi-enable")
        return False

def check_web_config():
    """Verificar se o web.config existe e tem conteúdo válido"""
    print("\n🔍 Verificando arquivo web.config...")
    if not os.path.exists('web.config'):
        print("❌ Arquivo web.config não encontrado")
        return False
    
    try:
        with open('web.config', 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Verificações básicas do conteúdo
        checks = {
            'FastCgiModule': 'FastCgiModule' in content,
            'scriptProcessor': 'scriptProcessor' in content,
            'WSGI_HANDLER': 'WSGI_HANDLER' in content,
            'environmentVariables': 'environmentVariables' in content,
            'rewrite rules': '<rewrite>' in content
        }
        
        all_checks_passed = all(checks.values())
        
        if all_checks_passed:
            print("✅ Arquivo web.config parece estar configurado corretamente")
        else:
            print("⚠️ Arquivo web.config pode precisar de ajustes:")
            for check, result in checks.items():
                print(f"   {'✅' if result else '❌'} {check}")
        
        return all_checks_passed
    except Exception as e:
        print(f"❌ Erro ao verificar web.config: {e}")
        return False

def main():
    """Função principal"""
    print("\n===== VERIFICAÇÃO DE CONFIGURAÇÃO FLASK + IIS =====")
    
    # Verificar componentes
    python_ok = check_python()
    wfastcgi_ok = check_wfastcgi()
    iis_ok = check_iis()
    fastcgi_ok = check_fastcgi_config()
    web_config_ok = check_web_config()
    
    # Resumo
    print("\n===== RESUMO DA VERIFICAÇÃO =====")
    print(f"Python: {'✅' if python_ok else '❌'}")
    print(f"wfastcgi: {'✅' if wfastcgi_ok else '❌'}")
    print(f"IIS: {'✅' if iis_ok else '❌'}")
    print(f"Configuração FastCGI: {'✅' if fastcgi_ok else '❌'}")
    print(f"web.config: {'✅' if web_config_ok else '❌'}")
    
    # Verificar se todos os componentes estão OK
    all_ok = python_ok and wfastcgi_ok and iis_ok and fastcgi_ok and web_config_ok
    
    if all_ok:
        print("\n✅ Todos os componentes necessários estão configurados corretamente!")
        print("   A aplicação Flask deve funcionar no IIS.")
    else:
        print("\n⚠️ Alguns componentes precisam ser configurados. Siga as instruções acima.")
    
    print("\nPara instruções detalhadas, consulte o arquivo README-FLASK.md")

if __name__ == "__main__":
    main()
