#!/bin/bash
# Meeting Bot - Docker Entrypoint

echo "[Entrypoint] 🚀 Iniciando ambiente virtual..."

# 1. Iniciar Xvfb
echo "[Entrypoint] Iniciando Xvfb no :99..."
Xvfb :99 -ac -screen 0 1280x720x24 &
export DISPLAY=:99
sleep 2

# 2. Iniciar PulseAudio
echo "[Entrypoint] Iniciando PulseAudio..."
pulseaudio --start --exit-idle-time=-1 --daemonize=no &
sleep 2

# 3. Criar Sinks Virtuais (Null Sink)
# Isso engana o Chrome e o Meet fazendo-os pensar que há um microfone e alto-falante
echo "[Entrypoint] Configurando dispositivos de áudio virtuais..."
pactl load-module module-null-sink sink_name=Virtual_Sink sink_properties=device.description=Virtual_Sink
pactl set-default-sink Virtual_Sink

# Carregar o monitor do sink como fonte (Input)
pactl load-module module-virtual-source source_name=Virtual_Mic master=Virtual_Sink.monitor
pactl set-default-source Virtual_Mic

# 4. Verificações de Sanidade
echo "[Entrypoint] Verificando dependências..."
if [ -f "$WHISPER_PATH" ]; then
    echo "[Entrypoint] ✅ Whisper OK"
else
    echo "[Entrypoint] ⚠️ Whisper não encontrado em $WHISPER_PATH"
fi

if [ -f "/usr/bin/chromium" ]; then
    echo "[Entrypoint] ✅ Chromium OK"
else
    echo "[Entrypoint] ❌ Chromium não encontrado!"
fi

echo "[Entrypoint] 🎯 Iniciando Aplicação Node.js..."
exec "$@"
