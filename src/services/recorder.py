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
            # Screenshot para debug futuro (se implementado)
            
        logger.info("Bot dentro da reunião. Mantendo vivo...")
        
        # Loop de monitoramento
        while True:
            time.sleep(30)
            if "meet.google.com" not in driver.current_url:
                logger.info("URL mudou. Reunião parece ter acabado.")
                break
            # Aqui poderíamos checar se estamos sozinhos na sala, etc.

    except Exception as e:
        logger.error(f"ERRO FATAL NO PYTHON: {e}", exc_info=True)
    finally:
        if driver:
            logger.info("Fechando driver...")
            driver.quit()
        if os.path.exists(proxy_plugin):
            os.remove(proxy_plugin)

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
