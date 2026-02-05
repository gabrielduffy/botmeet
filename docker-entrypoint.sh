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

# 3. Iniciar Microserviços Vexa (Via Python)
echo "📡 [Vexa] Ligando Motores (Gateway & Managers)..."

# Instalar dependências críticas se não estiverem no venv
pip install -e ./libs/shared-models
pip install "pydantic[email]" email-validator psutil

# Variáveis para comunicação interna (Unificada) - RESPEITA AS ENVS DO PAINEL
export ADMIN_API_URL=${ADMIN_API_URL:-http://localhost:8001}
export BOT_MANAGER_URL=${BOT_MANAGER_URL:-http://localhost:8080}
export TRANSCRIPTION_COLLECTOR_URL=${TRANSCRIPTION_COLLECTOR_URL:-http://localhost:8002}
export MCP_URL=${MCP_URL:-http://localhost:8004}
export VEXA_API_URL=${VEXA_API_URL:-http://localhost:8000}
export DB_HOST=${DB_HOST:-sortebem_postgresbot}
export REDIS_URL=${REDIS_URL:-redis://sortebem_redisbot:6379/0}
export PYTHONPATH=$PYTHONPATH:/app/services/bot-manager:/app/services/admin-api

# Hack para DNS interno (api-gateway -> localhost)
echo "127.0.0.1 api-gateway" >> /etc/hosts

# Rodamos as APIs em background (Usando caminhos absolutos do venv)
echo "🚀 Iniciando Admin API na porta 8001..."
/opt/vexa-env/bin/python3 -m uvicorn app.main:app --app-dir /app/services/admin-api --host 0.0.0.0 --port 8001 > /app/logs/admin-api.log 2>&1 &

echo "🚀 Iniciando Bot Manager na porta 8080..."
/opt/vexa-env/bin/python3 -m uvicorn app.main:app --app-dir /app/services/bot-manager --host 0.0.0.0 --port 8080 > /app/logs/bot-manager.log 2>&1 &

echo "🚀 Iniciando API Gateway na porta 8000..."
/opt/vexa-env/bin/python3 -m uvicorn services.api-gateway.main:app --host 0.0.0.0 --port 8000 > /app/logs/api-gateway.log 2>&1 &

echo "✅ [Vexa] APIs configuradas e em execução."

# 4. Iniciar o Orquestrador Node.js (Seu Bot)
echo "🤖 [App] Bot Orquestrador iniciando..."
exec node src/index.js
