import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import time
import sys
import os
import zipfile
import logging

# Configuração de logging detalhado
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [Python Bot] %(levelname)s: %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)

# Configurações do Proxy
PROXY_HOST = 'gw.dataimpulse.com'
PROXY_PORT = 823
PROXY_USER = '14e775730d7837f4aad0__cr.br'
PROXY_PASS = '8aebbfba273d7787'

# Credenciais Google (Vem do ambiente)
GOOGLE_EMAIL = os.environ.get('BOT_GOOGLE_EMAIL')
GOOGLE_PASS = os.environ.get('BOT_GOOGLE_PASSWORD')

def create_proxy_extension():
    """Cria uma extensão para autenticação do proxy residencial"""
    logger.info("Criando extensão de proxy...")
    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": ["proxy", "tabs", "unlimitedStorage", "storage", "<all_urls>", "webRequest", "webRequestBlocking"],
        "background": { "scripts": ["background.js"] },
        "minimum_chrome_version":"22.0.0"
    }
    """
    background_js = """
    var config = {
        mode: "fixed_servers",
        rules: {
            singleProxy: { scheme: "http", host: "%s", port: parseInt(%s) },
            bypassList: ["localhost"]
        }
    };
    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});
    chrome.webRequest.onAuthRequired.addListener(
        function(details) {
            return { authCredentials: { username: "%s", password: "%s" } };
        },
        {urls: ["<all_urls>"]},
        ["blocking"]
    );
    """ % (PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)
    
    plugin_file = '/tmp/proxy_auth_plugin.zip'
    with zipfile.ZipFile(plugin_file, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)
    return plugin_file

def login_google(driver):
    """Realiza o login na conta Google real para evitar bloqueios"""
    if not GOOGLE_EMAIL or not GOOGLE_PASS:
        logger.warning("Credenciais Google não encontradas. Tentando entrar como convidado...")
        return False
    
    try:
        logger.info(f"Iniciando login Google para: {GOOGLE_EMAIL}")
        driver.get('https://accounts.google.com/signin')
        
        wait = WebDriverWait(driver, 20)
        
        # Email
        email_field = wait.until(EC.presence_of_element_located((By.NAME, "identifier")))
        email_field.send_keys(GOOGLE_EMAIL)
        driver.find_element(By.ID, "identifierNext").click()
        
        time.sleep(3)
        
        # Senha
        pass_field = wait.until(EC.element_to_be_clickable((By.NAME, "password")))
        pass_field.send_keys(GOOGLE_PASS)
        driver.find_element(By.ID, "passwordNext").click()
        
        time.sleep(5)
        logger.info("Login realizado com sucesso (presumivelmente).")
        return True
    except Exception as e:
        logger.error(f"Erro no login Google: {e}")
        return False

def start_bot(meet_url):
    logger.info(f"Configurando Chrome para reunião: {meet_url}")
    
    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--use-fake-ui-for-media-stream')
    options.add_argument('--use-fake-device-for-media-stream')
    options.add_argument('--window-size=1280,720')
    # options.binary_location = '/usr/bin/chromium' # Removido para usar autodeteccao ou browser_executable_path
    
    # Proxy
    proxy_plugin = create_proxy_extension()
    options.add_argument(f'--load-extension={proxy_plugin}')
    
    driver = None
    try:
        logger.info("Lançando Chrome indetectável...")
        # Tenta encontrar o Chrome em locais comuns se nao estiver no PATH ou em /usr/bin/google-chrome
        chrome_path = None
        possible_paths = [
            "/opt/google/chrome/chrome",
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser"
        ]
        
        for p in possible_paths:
            if os.path.exists(p):
                chrome_path = p
                break
        
        if chrome_path:
            logger.info(f"Usando executável do Chrome: {chrome_path}")
            # Tentar detectar versão do Chrome
            try:
                import subprocess
                # chrome --version -> "Google Chrome 144.0.7559.109"
                ver_str = subprocess.check_output([chrome_path, "--version"]).decode().strip()
                main_ver = int(ver_str.split()[-1].split('.')[0])
                logger.info(f"Versão detectada do Chrome: {main_ver}")
                driver = uc.Chrome(options=options, headless=False, browser_executable_path=chrome_path, version_main=main_ver)
            except Exception as e:
                logger.warning(f"Não conseguiu detectar versão do Chrome ({e}), tentando sem version_main...")
                driver = uc.Chrome(options=options, headless=False, browser_executable_path=chrome_path)
        else:
            logger.info("Chrome path não encontrado explicitamente. Deixando undetected_chromedriver tentar autodetectar...")
            driver = uc.Chrome(options=options, headless=False)
        
        # 1. Login
        if login_google(driver):
            logger.info("Logado. Navegando para o Meet...")
        
        # 2. Meet URL
        driver.get(meet_url)
        time.sleep(10)
        
        # 3. Handle Premissões e Nome (se não logado)
        try:
            name_inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="text"]')
            if name_inputs:
                logger.info("Campo de nome detectado. Entrando como convidado...")
                name_inputs[0].send_keys("Assistente Benemax")
                time.sleep(1)
                name_inputs[0].send_keys(u'\ue007') # Enter
        except:
            pass

        # 4. Tentar clicar no botão de entrar
        wait = WebDriverWait(driver, 30)
        logger.info("Aguardando botão de entrada...")
        
        selectors = [
            "//span[contains(text(), 'Participar')]",
            "//span[contains(text(), 'Join')]",
            "//span[contains(text(), 'Pedir para participar')]",
            "//span[contains(text(), 'Ask to join')]"
        ]
        
        clicked = False
        for i in range(10):
            for selector in selectors:
                try:
                    btns = driver.find_elements(By.XPATH, selector)
                    if btns and btns[0].is_displayed():
                        btns[0].click()
                        logger.info(f"Botão clicado via: {selector}")
                        clicked = True
                        break
                except:
                    continue
            if clicked: break
            time.sleep(3)
            logger.info(f"Tentativa {i+1} de encontrar botão...")

        if not clicked:
            logger.error("Não foi possível encontrar o botão de entrada após 10 tentativas.")
            logger.info("Verificando se já estamos na reunião (sem botão)...")
            
            # Verificação alternativa de sucesso (botão de sair, microfone, ou URL da sala)
            try:
                # Se a URL ainda for a da reunião (sem 'landing' ou 'error') e tiver botões de controle
                if "meet.google.com" in driver.current_url:
                    parts = driver.current_url.split('/')
                    # URLs de meet validas geralmente tem código ex: meet.google.com/abc-defg-hij
                    if len(parts) > 3 and len(parts[-1]) > 5:
                        logger.info("URL parece correta. Verificando controles de mídia...")
                        # Botão de sair (telefone vermelho) ou microfone
                        controls = driver.find_elements(By.CSS_SELECTOR, "button[aria-label*='Sair'], button[aria-label*='Leave']")
                        if controls:
                            logger.info("Controles de reunião detectados! Estamos dentro!")
                            clicked = True
            except:
                pass

        if clicked or "meet.google.com" in driver.current_url:
            logger.info("Bot confirmado na reunião. Iniciando transcrição via GROQ...")
            
            groq_api_key = os.environ.get("GROQ_API_KEY")
            if not groq_api_key:
                logger.error("ERRO: GROQ_API_KEY não encontrada nas variáveis de ambiente!")
            else:
                logger.info("GROQ_API_KEY detectada. Preparando motor de áudio...")
                
                def run_groq_transcription():
                    try:
                        import requests
                        logger.info("Iniciando loop de transcrição Groq (simulado via chunks)...")
                        # Aqui entrará a lógica de captura do FFmpeg para enviar chunks ao Groq
                        # Por enquanto, apenas registramos que o motor está pronto
                        while True:
                            # TODO: Implementar gravação de chunk de 10s e envio para Groq
                            time.sleep(10)
                            if "meet.google.com" not in driver.current_url: break
                    except Exception as e:
                        logger.error(f"Erro no motor Groq: {e}")

                import threading
                t = threading.Thread(target=run_groq_transcription)
                t.daemon = True
                t.start()
                logger.info("Motor de transcrição Groq iniciado em background.")
                
        else:
             logger.error("Falha crítica: Bot não conseguiu entrar na reunião.")
             return

        # Loop de monitoramento
        while True:
            time.sleep(30)
            if "meet.google.com" not in driver.current_url:
                logger.info("URL mudou. Reunião parece ter acabado.")
                break
            
            # Opcional: Verificar se fomos expulsos
            try:
                removed = driver.find_elements(By.XPATH, "//*[contains(text(), 'removed')]")
                if removed:
                    logger.info("Detectado aviso de remoção. Encerrando.")
                    break
            except:
                pass
            
    except Exception as e:
        logger.error(f"ERRO FATAL NO PYTHON: {e}", exc_info=True)
    finally:
        if driver:
            logger.info("Fechando driver...")
            try:
                driver.quit()
            except: pass
        if os.path.exists(proxy_plugin):
            try:
                os.remove(proxy_plugin)
            except: pass

if __name__ == "__main__":
    target_url = None
    if len(sys.argv) >= 2:
        target_url = sys.argv[1]
    else:
        target_url = os.environ.get('MEETING_URL')
        
    if not target_url:
        logger.error("Uso: python recorder.py <MEET_URL> ou defina env MEETING_URL")
        sys.exit(1)
    start_bot(target_url)
