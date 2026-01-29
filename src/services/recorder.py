import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys
import os
import zipfile

# Configurações do Proxy (DataImpulse)
PROXY_HOST = 'gw.dataimpulse.com'
PROXY_PORT = 823
PROXY_USER = '14e775730d7837f4aad0__cr.br'
PROXY_PASS = '8aebbfba273d7787'

def create_proxy_extension():
    """Cria uma extensão do Chrome para autenticação do proxy no Selenium"""
    manifest_json = """
    {
        "version": "1.0.0",
        "manifest_version": 2,
        "name": "Chrome Proxy",
        "permissions": [
            "proxy",
            "tabs",
            "unlimitedStorage",
            "storage",
            "<all_urls>",
            "webRequest",
            "webRequestBlocking"
        ],
        "background": {
            "scripts": ["background.js"]
        },
        "minimum_chrome_version":"22.0.0"
    }
    """

    background_js = """
    var config = {
            mode: "fixed_servers",
            rules: {
              singleProxy: {
                scheme: "http",
                host: "%s",
                port: parseInt(%s)
              },
              bypassList: ["localhost"]
            }
          };

    chrome.proxy.settings.set({value: config, scope: "regular"}, function() {});

    chrome.webRequest.onAuthRequired.addListener(
            function(details) {
                return {
                    authCredentials: {
                        username: "%s",
                        password: "%s"
                    }
                };
            },
            {urls: ["<all_urls>"]},
            ["blocking"]
    );
    """ % (PROXY_HOST, PROXY_PORT, PROXY_USER, PROXY_PASS)

    plugin_file = 'proxy_auth_plugin.zip'
    with zipfile.ZipFile(plugin_file, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)
    return plugin_file

def start_bot(meet_url):
    print(f"[Python Bot] Iniciando Evasão com Proxy Residencial Brasil...")
    
    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--use-fake-ui-for-media-stream')
    options.add_argument('--use-fake-device-for-media-stream')
    
    # Adiciona a extensão de proxy
    proxy_plugin = create_proxy_extension()
    options.add_argument(f'--load-extension={os.path.abspath(proxy_plugin)}')
    
    # Inicia o Chrome Indetectável
    driver = uc.Chrome(options=options, headless=False)
    
    try:
        print(f"[Python Bot] Navegando para Meet: {meet_url}")
        driver.get(meet_url)
        time.sleep(10) # Tempo para o proxy e página carregarem
        
        # Tenta colocar o nome
        try:
            print("[Python Bot] Procurando campo de nome...")
            wait = WebDriverWait(driver, 20)
            name_input = wait.until(EC.element_to_list_of_elements_located((By.CSS_SELECTOR, 'input[type="text"]')))[0]
            name_input.send_keys("Assistente Benemax")
            time.sleep(1)
            name_input.send_keys(u'\ue007') # Enter
        except:
            print("[Python Bot] Já logado ou campo de nome não visível.")

        # Tenta o botão de entrada (Polling)
        for i in range(10):
            try:
                btns = driver.find_elements(By.XPATH, "//span[contains(text(), 'Participar') or contains(text(), 'Join') or contains(text(), 'Pedir')]")
                if btns:
                    btns[0].click()
                    print("[Python Bot] ✅ Clique no botão de entrada!")
                    break
            except:
                pass
            time.sleep(2)

        print("[Python Bot] Bot rodando. Monitorando...")
        while True:
            # Verifica se ainda está na página
            if "meet.google.com" not in driver.current_url:
                print("[Python Bot] Reunião encerrada.")
                break
            time.sleep(10)

    except Exception as e:
        print(f"[Python Bot] ❌ Erro: {e}")
    finally:
        driver.quit()
        if os.path.exists(proxy_plugin):
            os.remove(proxy_plugin)

if __name__ == "__main__":
    meet_url = sys.argv[1] if len(sys.argv) > 1 else ""
    if meet_url:
        start_bot(meet_url)
    else:
        print("URL do Meet é necessária.")
