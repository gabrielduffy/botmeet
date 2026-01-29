# Meeting Bot - Vexa Unified Dockerfile (Evasão Pro)
FROM node:20-slim

# Instalar dependências de sistema (Chrome + Python para o Vexa)
RUN apt-get update && apt-get install -y \
    wget \
    curl \
    gnupg \
    ca-certificates \
    ffmpeg \
    pulseaudio \
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

# Instalar Google Chrome (O motor do robô indetectável)
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list \
    && apt-get update \
    && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Configurar o ambiente do robô Vexa (Python)
RUN python3 -m venv /opt/vexa-env && \
    /opt/vexa-env/bin/pip install --upgrade pip && \
    /opt/vexa-env/bin/pip install --no-cache-dir \
    undetected-chromedriver \
    selenium \
    requests \
    fastapi \
    uvicorn[standard] \
    httpx \
    pydantic \
    python-dotenv \
    redis \
    sqlalchemy \
    asyncpg \
    databases[asyncpg] \
    alembic \
    psycopg2-binary

WORKDIR /app

# Instalar dependências do Node.js
COPY package*.json ./
RUN npm install --omit=dev

# Copiar tudo (Orquestrador + Código do Vexa)
COPY . .

# Permissões e pastas
RUN mkdir -p /app/recordings /app/logs /tmp /app/storage/screenshots /app/storage/logs && \
    chmod -R 777 /app/recordings /app/logs /tmp /app/storage

# Variáveis de ambiente para o robô
ENV DISPLAY=:99 \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/vexa-env/bin:$PATH"

EXPOSE 3000

# Garantir que o script de entrada tenha permissão de execução
RUN chmod +x /app/docker-entrypoint.sh

# Script de entrada unificado
ENTRYPOINT ["/app/docker-entrypoint.sh"]
