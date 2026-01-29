# Meeting Bot - Dockerfile
# Bot automático para gravar e transcrever reuniões do Google Meet

FROM node:20-slim

# Instalar dependências do sistema
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    ffmpeg \
    pulseaudio \
    xvfb \
    python3 \
    python3-pip \
    python3-venv \
    wget \
    curl \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Criar ambiente virtual Python para Whisper
RUN python3 -m venv /opt/whisper-env

# Instalar Whisper com economia de memória e sem cache
# PyTorch CPU-only (~200MB)
RUN /opt/whisper-env/bin/pip install --upgrade pip && \
    /opt/whisper-env/bin/pip install --no-cache-dir --timeout 600 --retries 10 torch --index-url https://download.pytorch.org/whl/cpu && \
    /opt/whisper-env/bin/pip install --no-cache-dir --timeout 300 --retries 5 openai-whisper

# Criar diretório da aplicação
WORKDIR /app

# Copiar package.json primeiro (cache de dependências)
COPY package*.json ./

# Instalar dependências Node.js
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Criar diretórios necessários
RUN mkdir -p /app/recordings /app/transcriptions /app/logs

# Variáveis de ambiente do Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    DISPLAY=:99 \
    WHISPER_PATH=/opt/whisper-env/bin/whisper

# Expor porta da API
EXPOSE 3000

# Script de inicialização
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
