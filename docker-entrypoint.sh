#!/bin/bash

# Iniciar Xvfb (display virtual para o Chrome)
echo "[Entrypoint] Iniciando Xvfb..."
Xvfb :99 -screen 0 1920x1080x24 -ac &
sleep 2

# Iniciar PulseAudio (captura de áudio)
echo "[Entrypoint] Iniciando PulseAudio..."
pulseaudio --start --exit-idle-time=-1
sleep 1

# Verificar se Whisper está instalado
if [ -f "$WHISPER_PATH" ]; then
    echo "[Entrypoint] Whisper encontrado: $WHISPER_PATH"
else
    echo "[Entrypoint] AVISO: Whisper não encontrado em $WHISPER_PATH"
fi

# Verificar Chrome
if [ -f "/usr/bin/chromium" ]; then
    echo "[Entrypoint] Chromium encontrado"
else
    echo "[Entrypoint] ERRO: Chromium não encontrado!"
fi

echo "[Entrypoint] Iniciando aplicação..."
exec "$@"
