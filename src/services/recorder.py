import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import sys
import os
import subprocess

# Configurações do Meeting
MEET_URL = sys.argv[1] if len(sys.argv) > 1 else ""
EVENT_ID = sys.argv[2] if len(sys.argv) > 2 else "test"
PROXY = os.getenv("RESIDENTIAL_PROXY") # Formato: http://user:pass@host:port

def start_bot():
    print(f"[Python Bot] Iniciando para URL: {MEET_URL}")
    
    options = uc.ChromeOptions()
    
    # Simulação de Desktop Real
    options.add_argument('--no-sandbox')
    options.add_argument('--window-size=1280,720')
    options.add_argument('--use-fake-ui-for-media-stream')
    options.add_argument('--use-fake-device-for-media-stream')
    
    # Se tiver proxy, aplica
    if PROXY:
        print("[Python Bot] Usando Proxy Residencial...")
        options.add_argument(f'--proxy-server={PROXY}')

    # Inicia o motor indetectável
    driver = uc.Chrome(options=options, headless=False) # Headless=False é melhor para bypass
    
    try:
        driver.get(MEET_URL)
        time.sleep(5)
        
        # Aqui entra a lógica de clicar no botão "Pedir para participar" ou "Participar agora"
        # O UC esconde o "_cdc" do driver, então o Google não vê automação básica
        
        print("[Python Bot] Tentando entrar na sala...")
        
        # Tenta encontrar o campo de nome se não estiver logado
        try:
            name_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, 'input[aria-label*="nome"]'))
            )
            name_input.send_keys("Assistente Benemax")
            name_input.send_keys(u'\ue007') # Enter
            time.sleep(2)
        except:
            print("[Python Bot] Campo de nome não encontrado ou já logado.")

        # Tenta o botão de Participar
        join_btn_selectors = [
            "//span[contains(text(), 'Participar')]",
            "//span[contains(text(), 'Join')]",
            "//span[contains(text(), 'Pedir')]"
        ]
        
        for selector in join_btn_selectors:
            try:
                btn = driver.find_element(By.XPATH, selector)
                btn.click()
                print(f"[Python Bot] Botão clicado: {selector}")
                break
            except:
                continue

        print("[Python Bot] Dentro da sala (teoricamente). Mantendo vivo...")
        
        # Aqui o bot fica vivo enquanto o processo pai precisar
        while True:
            time.sleep(10)
            # Verifica se ainda está na sala (pode olhar o count de participantes)
            
    except Exception as e:
        print(f"[Python Bot] Erro: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    if not MEET_URL:
        print("URL do Meet é obrigatória.")
    else:
        start_bot()
