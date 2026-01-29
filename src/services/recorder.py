import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys
import os
import zipfile

print("[Python Bot] >>> SCRIPT INICIADO <<<")

# Configurações do Proxy
PROXY_HOST = 'gw.dataimpulse.com'
PROXY_PORT = 823
PROXY_USER = '14e775730d7837f4aad0__cr.br'
PROXY_PASS = '8aebbfba273d7787'

def create_proxy_extension():
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
    plugin_file = 'proxy_auth_plugin.zip'
    with zipfile.ZipFile(plugin_file, 'w') as zp:
        zp.writestr("manifest.json", manifest_json)
        zp.writestr("background.js", background_js)
    return plugin_file

def start_bot(meet_url):
    print(f"[Python Bot] Configurando Chrome para: {meet_url}")
    options = uc.ChromeOptions()
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--use-fake-ui-for-media-stream')
    options.add_argument('--use-fake-device-for-media-stream')
    options.add_argument('--window-size=1280,720')
    
    proxy_plugin = create_proxy_extension()
    options.add_argument(f'--load-extension={os.path.abspath(proxy_plugin)}')
    
    try:
        driver = uc.Chrome(options=options, headless=False)
        print(f"[Python Bot] Navegando...")
        driver.get(meet_url)
        time.sleep(10)
        
        # Tenta colocar o nome
        try:
            print("[Python Bot] Tentando identificar campo de nome...")
            # Usando seletor mais genérico e robusto
            inputs = driver.find_elements(By.CSS_SELECTOR, 'input[type="text"]')
            if inputs:
                inputs[0].send_keys("Assistente Benemax")
                time.sleep(1)
                inputs[0].send_keys(u'\ue007') # Enter
                print("[Python Bot] Nome enviado.")
        except Exception as e:
            print(f"[Python Bot] Erro ao inserir nome: {e}")

        # Polling para entrar
        for i in range(15):
            print(f"[Python Bot] Tentativa {i+1} de clicar no botão...")
            try:
                # Procura botões por texto ignore case
                btns = driver.find_elements(By.XPATH, "//button[contains(., 'Participar') or contains(., 'Join') or contains(., 'Pedir')]")
                if not btns:
                    btns = driver.find_elements(By.XPATH, "//div[@role='button' and (contains(., 'Participar') or contains(., 'Join') or contains(., 'Pedir'))]")
                
                if btns:
                    btns[0].click()
                    print("[Python Bot] ✅ BOTÃO CLICADO!")
                    break
            except:
                pass
            time.sleep(2)

        print("[Python Bot] Monitorando fim da reunião...")
        while True:
            time.sleep(10)
            if "meet.google.com" not in driver.current_url:
                break
    except Exception as e:
        print(f"[Python Bot] ❌ CRASH: {e}")
    finally:
        if 'driver' in locals(): driver.quit()
        if os.path.exists(proxy_plugin): os.remove(proxy_plugin)

if __name__ == "__main__":
    url = sys.argv[1] if len(sys.argv) > 1 else ""
    if url: start_bot(url)
    else: print("Erro: URL vazia.")
