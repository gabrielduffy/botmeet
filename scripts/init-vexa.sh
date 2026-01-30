#!/bin/bash

# Script de Inicialização Completa do Sistema Vexa
# Autor: Antigravity AI
# Uso: ./init-vexa.sh

set -e

echo "🚀 Iniciando Sistema Vexa..."

# 1. Para containers antigos (se existirem)
echo "🛑 Parando containers antigos..."
docker stop whisperlive 2>/dev/null || true
docker rm whisperlive 2>/dev/null || true

# 2. Inicia o WhisperLive
echo "🎙️ Iniciando WhisperLive (Transcrição em Tempo Real)..."
docker run -d \
  --name whisperlive \
  --restart unless-stopped \
  --network easypanel-sortebem \
  -e REDIS_STREAM_URL='redis://default:412trocar@sortebem_redisbot:6379' \
  -p 9090:9090 \
  whisperlive:latest

# 3. Aguarda WhisperLive ficar pronto
echo "⏳ Aguardando WhisperLive inicializar..."
sleep 10

# 4. Verifica se está rodando
if docker ps | grep -q whisperlive; then
  echo "✅ WhisperLive está rodando na porta 9090"
else
  echo "❌ Erro: WhisperLive não iniciou corretamente"
  docker logs whisperlive
  exit 1
fi

# 5. Exibe status final
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SISTEMA VEXA PRONTO PARA USO!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Serviços Ativos:"
echo "   • WhisperLive: http://localhost:9090"
echo "   • Vexa Bot: Gerenciado pelo Easypanel/Docker Swarm"
echo ""
echo "🎯 Próximo Passo:"
echo "   Use o script trigger-bot.sh para disparar o bot em uma reunião"
echo ""
