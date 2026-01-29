# Meeting Bot - Dockerfile (Evasão Pro - DEBIAN STABLE)
FROM node:20-slim

# Instalar dependências do sistema - Nomes universais Debian Bookworm
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

# Criar ambiente virtual Python
RUN python3 -m venv /opt/whisper-env

# Instalar Whisper e Ferramentas de Evasão (UC + Selenium)
RUN /opt/whisper-env/bin/pip install --upgrade pip && \
    /opt/whisper-env/bin/pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    /opt/whisper-env/bin/pip install --no-cache-dir openai-whisper undetected-chromedriver selenium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

RUN mkdir -p /app/recordings /app/transcriptions /app/logs

# Variáveis críticas
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    DISPLAY=:99 \
    WHISPER_PATH=/opt/whisper-env/bin/whisper \
    PYTHON_BOT_PATH=/opt/whisper-env/bin/python3

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
