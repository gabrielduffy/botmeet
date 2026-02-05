#!/bin/bash
# docker-entrypoint.sh - O "Ignicionador" do Ecossistema Benemax

echo "🚀 [System] Iniciando Ecossistema Unificado..."

# Ativar o ambiente virtual Python se ele existir
if [ -f "/opt/vexa-env/bin/activate" ]; then
    source /opt/vexa-env/bin/activate
    export PATH="/opt/vexa-env/bin:$PATH"
fi

# 1. Iniciar Display Virtual (Para o Chrome não crashar)
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99
sleep 2

# 2. Iniciar PulseAudio (Para captura de som do Meet)
pulseaudio -D --exit-idle-time=-1
sleep 1

# --- MODO WORKER ---
# Se MEETING_URL for passada, somos um worker dedicado
if [ ! -z "$MEETING_URL" ]; then
    echo "🎥 [Worker] Modo Worker Detectado!"
    echo "🎥 [Worker] Target: $MEETING_URL"
    
    # Limpar locks antigos do Xvfb se existirem (worker efêmero)
    rm -f /tmp/.X99-lock
    
    # Instalar dependências se necessário (rápido)
    pip install "pydantic[email]" email-validator > /dev/null 2>&1
    
    echo "🎥 [Worker] Running recorder.py..."
    exec python3 src/services/recorder.py "$MEETING_URL"
fi
# -------------------

# 3. Inicia as APIs diretamente no console para você ver o erro real no Easypanel
echo "🚀 Iniciando Microserviços..."

# Usamos caminhos absolutos para garantir estabilidade
export PYTHONPATH=$PYTHONPATH:/app/services/bot-manager:/app/services/admin-api

echo ">>> Ligando Admin API (Porta 8001)..."
/opt/vexa-env/bin/python3 -m uvicorn app.main:app --app-dir /app/services/admin-api --host 0.0.0.0 --port 8001 &

echo ">>> Ligando Bot Manager (Porta 8080)..."
/opt/vexa-env/bin/python3 -m uvicorn app.main:app --app-dir /app/services/bot-manager --host 0.0.0.0 --port 8080 &

echo ">>> Ligando API Gateway (Porta 8000)..."
/opt/vexa-env/bin/python3 -m uvicorn services.api-gateway.main:app --host 0.0.0.0 --port 8000 &

echo "✅ Todos os motores iniciados. Aguardando Node.js..."
sleep 2

# 4. Iniciar o Orquestrador Node.js (Seu Bot)
echo "🤖 [App] Bot Orquestrador iniciando..."
exec node src/index.js
