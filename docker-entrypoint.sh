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

# 3. Inicia as APIs diretamente no console
echo "📡 [Vexa] Ligando Motores (Modo Unificado)..."

export PYTHONPATH="/app:/app/services/bot-manager:/app/services/admin-api:/app/services/api-gateway:$PYTHONPATH"

echo ">>> 🚀 Admin API (8001)..."
(cd /app/services/admin-api && /opt/vexa-env/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8001) &

echo ">>> 🚀 Bot Manager (8080)..."
(cd /app/services/bot-manager && /opt/vexa-env/bin/python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8080) &

echo ">>> 🚀 API Gateway (8000)..."
(cd /app/services/api-gateway && /opt/vexa-env/bin/python3 -m uvicorn main:app --host 0.0.0.0 --port 8000) &

# Verificar se os processos estão rodando
sleep 5
echo "📊 [Status] Verificando processos Python:"
ps aux | grep uvicorn

# 4. Iniciar o Orquestrador Node.js (Porta 3000)
echo "🤖 [App] Iniciando Gateway Node.js na porta 3000..."
cd /app && exec node src/index.js
