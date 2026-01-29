#!/bin/bash
echo "🚀 Iniciando build da imagem vexa-bot..."
cd services/vexa-bot/core
docker build -t vexa-bot:latest .
echo "✅ Build concluído! A imagem vexa-bot:latest está pronta."
