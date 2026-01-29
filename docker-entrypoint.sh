#!/bin/bash
# docker-entrypoint.sh - O "Ignicionador" do Ecossistema Benemax

echo "🚀 [System] Iniciando Ecossistema Unificado..."

# 1. Iniciar Display Virtual (Para o Chrome não crashar)
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99
sleep 2

# 2. Iniciar PulseAudio (Para captura de som do Meet)
pulseaudio -D --exit-idle-time=-1
sleep 1

# 3. Iniciar Microserviços Vexa (Via Python)
echo "📡 [Vexa] Ligando Motores (Gateway & Managers)..."

# Instalamos o Vexa localmente se não estiver
pip install -e ./libs/shared-models > /dev/null 2>&1

# Rodamos as APIs em background
nohup uvicorn services.admin-api.app.main:app --host 0.0.0.0 --port 8001 > /app/logs/admin-api.log 2>&1 &
nohup uvicorn services.bot-manager.app.main:app --host 0.0.0.0 --port 8080 > /app/logs/bot-manager.log 2>&1 &
nohup uvicorn services.api-gateway.main:app --host 0.0.0.0 --port 8000 > /app/logs/api-gateway.log 2>&1 &

echo "✅ [Vexa] APIs em segundo plano."

# 4. Iniciar o Orquestrador Node.js (Seu Bot)
echo "🤖 [App] Bot Orquestrador iniciando..."
exec node src/index.js
