#!/bin/bash

if [ -z "$1" ]; then
    echo "Erro: URL do Google Meet nao fornecida!"
    echo "Uso: ./disparar-bot.sh https://meet.google.com/xxx-xxxx-xxx"
    exit 1
fi

MEET_URL=$1
MEETING_ID=$(echo $MEET_URL | sed 's/.*meet.google.com\///')

echo "Disparando bot para: $MEET_URL"
echo "Meeting ID: $MEETING_ID"

BOT_CONTAINER=$(docker ps | grep sortebem_bot | head -1 | awk '{print $NF}')

if [ -z "$BOT_CONTAINER" ]; then
    echo "Erro: Container do Bot Manager nao encontrado!"
    exit 1
fi

docker exec $BOT_CONTAINER curl -X POST http://localhost:8080/bots \
  -H "X-API-Key: benemax_bot_secure_token_2026" \
  -H "Content-Type: application/json" \
  -d "{\"platform\": \"google_meet\", \"meeting_url\": \"$MEET_URL\", \"native_meeting_id\": \"$MEETING_ID\", \"bot_name\": \"Assistente Benemax\"}"

echo ""
echo "Comando enviado!"
echo "Verifique o Google Meet para aceitar o bot."
