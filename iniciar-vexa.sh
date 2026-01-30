#!/bin/bash
echo "Iniciando configuracao do Vexa..."

if ! docker network ls | grep -q vexa_default; then
    echo "Criando rede vexa_default..."
    docker network create vexa_default
fi

echo "Procurando containers..."
REDIS_CONTAINER=$(docker ps | grep sortebem_redisbot | awk '{print $NF}')
BOT_CONTAINER=$(docker ps | grep sortebem_bot | head -1 | awk '{print $NF}')

if [ -z "$REDIS_CONTAINER" ] || [ -z "$BOT_CONTAINER" ]; then
    echo "Erro: Containers nao encontrados!"
    exit 1
fi

echo "Conectando Redis na rede..."
docker network connect vexa_default $REDIS_CONTAINER 2>/dev/null || echo "Redis ja conectado"

echo "Conectando Bot Manager na rede..."
docker network connect vexa_default $BOT_CONTAINER 2>/dev/null || echo "Bot Manager ja conectado"

echo "Configuracao concluida!"
echo "Redis: $REDIS_CONTAINER"
echo "Bot Manager: $BOT_CONTAINER"
