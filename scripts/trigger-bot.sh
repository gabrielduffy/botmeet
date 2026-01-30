#!/bin/bash

# Script de Disparo do Bot Vexa em Reuniões
# Autor: Antigravity AI
# Uso: ./trigger-bot.sh "https://meet.google.com/xxx-xxxx-xxx"

set -e

# Validação de argumentos
if [ -z "$1" ]; then
  echo "❌ Erro: URL da reunião não fornecida"
  echo ""
  echo "Uso: ./trigger-bot.sh <URL_DA_REUNIAO>"
  echo "Exemplo: ./trigger-bot.sh https://meet.google.com/abc-defg-hij"
  exit 1
fi

MEETING_URL="$1"
EVENT_ID="${2:-auto-$(date +%s)}"

# Detecta o container do Vexa Bot
CONTAINER_NAME=$(docker ps --filter "name=sortebem_bot" --format "{{.Names}}" | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
  echo "❌ Erro: Container do Vexa Bot não encontrado"
  echo "Certifique-se de que o Easypanel/Docker Swarm está rodando"
  exit 1
fi

echo "🤖 Disparando Bot Vexa..."
echo "   • Reunião: $MEETING_URL"
echo "   • Container: $CONTAINER_NAME"
echo "   • Event ID: $EVENT_ID"
echo ""

# Dispara o bot (usa porta 8080 para evitar erro de Gateway)
RESPONSE=$(docker exec "$CONTAINER_NAME" curl -s -X POST http://localhost:8080/bots \
  -H "X-API-Key: benemax_bot_secure_token_2026" \
  -H "Content-Type: application/json" \
  -d '{"platform":"google_meet","meeting_url":"'"$MEETING_URL"'","native_meeting_id":"'$(basename "$MEETING_URL")'","bot_config":{"bot_name":"Assistente Benemax"}}')
echo "📡 Resposta do servidor:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Verifica sucesso
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Bot disparado com sucesso!"
  echo "🎙️ O 'Assistente Benemax' deve aparecer na reunião em ~15 segundos"
  echo ""
  echo "📊 Para ver os logs do bot:"
  echo "   docker logs -f $CONTAINER_NAME"
else
  echo "❌ Erro ao disparar o bot"
  echo "Verifique os logs: docker logs $CONTAINER_NAME"
  exit 1
fi
