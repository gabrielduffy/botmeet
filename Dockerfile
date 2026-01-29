# Meeting Bot Orchestrator - Dockerfile (SLIM)
FROM node:20-slim

# Instalar dependências básicas
RUN apt-get update && apt-get install -y \
    curl \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar apenas o necessário para o Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Copiar o código fonte e pastas necessárias
COPY src/ ./src/
COPY docker-entrypoint.sh ./

# Garantir permissões básicas
RUN mkdir -p /app/logs /tmp && \
    chmod -R 777 /app/logs /tmp && \
    chmod +x docker-entrypoint.sh

# Variáveis de ambiente padrão
ENV NODE_ENV=production

EXPOSE 3000

# Usamos um entrypoint simples já que não precisamos mais de Xvfb ou PulseAudio aqui
# O Vexa cuida de toda a parte gráfica e de áudio.
ENTRYPOINT ["node", "src/index.js"]
