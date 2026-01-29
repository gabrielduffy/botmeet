# Meeting Bot - Dockerfile (V3 Ultra-Stable)
FROM node:20-slim

# Instalar dependências básicas e ferramentas de sistema
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    ffmpeg \
    pulseaudio \
    pulseaudio-utils \
    xvfb \
    python3 \
    python3-pip \
    python3-venv \
    fonts-liberation \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libasound2 \
    xdg-utils \
    --no-install-recommends

# Instalar Google Chrome Stable oficial (Melhor para Undetected Chromedriver)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Criar ambiente virtual Python
RUN python3 -m venv /opt/whisper-env

# Instalar dependências Python (Torch CPU-only + Evasão)
RUN /opt/whisper-env/bin/pip install --upgrade pip && \
    /opt/whisper-env/bin/pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu && \
    /opt/whisper-env/bin/pip install --no-cache-dir openai-whisper undetected-chromedriver selenium

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .

# Permissões
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p /app/recordings /app/transcriptions /app/logs /tmp && \
    chmod -R 777 /app/recordings /app/transcriptions /app/logs /tmp

# Variáveis de ambiente
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    DISPLAY=:99 \
    WHISPER_PATH=/opt/whisper-env/bin/whisper \
    PYTHON_BOT_PATH=/opt/whisper-env/bin/python3 \
    PYTHONUNBUFFERED=1

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
