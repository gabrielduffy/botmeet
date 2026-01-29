#!/bin/bash
# docker-entrypoint.sh - Inicia o Display Virtual e os serviços Vexa

echo "🚀 Iniciando ambiente unificado Benemax..."

# 1. Iniciar Display Virtual (Indispensável para o robô abrir o Chrome sem monitor)
Xvfb :99 -screen 0 1280x1024x24 &
export DISPLAY=:99

# 2. Iniciar os serviços do Vexa em background (Lógica de microserviços em um container)
# Nota: Aqui o orquestrador Node vai se comunicar com o Vexa interno
echo "📡 Iniciando Gateways e Gerentes..."

# (Simulamos a inicialização dos binários/scripts do Vexa se necessário)
# Por enquanto, o Orquestrador Node domina o fluxo e chama o robô via Python Bridge

# 3. Rodar o Orquestrador Principal
echo "🤖 Bot Online! Monitorando reuniões..."
exec node src/index.js
