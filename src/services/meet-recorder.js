// src/services/meet-recorder.js
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');

puppeteer.use(StealthPlugin());

class MeetRecorder {
  constructor() {
    this.browser = null;
    this.page = null;
    this.recordingProcess = null;
    this.recordingsDir = process.env.RECORDINGS_DIR || '/app/recordings';

    if (!fs.existsSync(this.recordingsDir)) fs.mkdirSync(this.recordingsDir, { recursive: true });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simula movimentos humanos para evitar detecção (tl.dv style)
   */
  async simulateHumanBehavior() {
    try {
      await this.page.mouse.move(100, 100);
      await this.sleep(500);
      await this.page.mouse.move(200, 300);
    } catch (e) { }
  }

  async joinAndRecord(meetUrl, eventId) {
    const outputPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.webm`);
    const audioPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.wav`);

    try {
      await this.launchBrowser();

      const joined = await this.joinMeeting(meetUrl);
      if (!joined) throw new Error('Falha ao entrar na sala.');

      await this.startRecording(outputPath);
      await this.monitorMeetingUntilEnd();
      await this.stopRecording();
      await this.convertToWav(outputPath, audioPath);
      await this.cleanup();
      return audioPath;
    } catch (error) {
      logger.error(`[Recorder] ❌ Erro: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  async launchBrowser() {
    logger.info('[Recorder] Lançando instância limpa (Anti-Detecção)...');
    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--window-size=1280,720',
        '--disable-notifications',
        '--disable-infobars',
        `--display=${process.env.DISPLAY || ':99'}`,
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    this.page = await this.browser.newPage();

    // Configurar permissões de Microphone/Camera de forma irrevogável
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
  }

  async joinMeeting(meetUrl) {
    logger.info(`[Recorder] Navegando para link: ${meetUrl}`);

    // Entrar com parâmetro que desativa login automático
    await this.page.goto(meetUrl + '?authuser=0', { waitUntil: 'networkidle2', timeout: 60000 });
    await this.sleep(5000);
    await this.simulateHumanBehavior();

    // Lógica para clicar em "Participar" ou "Pedir para Entrar"
    logger.info('[Recorder] Procurando interação na página...');

    // 1. Tentar digitar nome (se for convidado)
    const nameInput = await this.page.$('input[aria-label*="nome"], input[placeholder*="nome"]');
    if (nameInput) {
      logger.info('[Recorder] Digitando nome de exibição...');
      await nameInput.type('Assistente Benemax', { delay: 150 });
      await this.page.keyboard.press('Enter');
      await this.sleep(3000);
    }

    // 2. Loop de detecção de botão (tl.dv usa esse tipo de polling)
    for (let i = 0; i < 15; i++) {
      const result = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const target = buttons.find(b => {
          const text = b.innerText.toLowerCase();
          return text.includes('participar') || text.includes('join') || text.includes('pedir') || text.includes('ask');
        });

        if (target && !target.disabled) {
          target.click();
          return target.innerText;
        }
        return null;
      });

      if (result) {
        logger.info(`[Recorder] ✅ Botão "${result}" acionado.`);
      }

      // 3. Verificar se já entrou (procurando botão de Sair/Hangup)
      const isInside = await this.page.evaluate(() => {
        return !!document.querySelector('[aria-label*="Sair"], [aria-label*="Leave"], [aria-label*="encerrar"]');
      });

      if (isInside) {
        logger.info('[Recorder] 🚀 Estamos dentro da reunião!');
        return true;
      }

      await this.sleep(2000);
      await this.simulateHumanBehavior();
    }

    return false;
  }

  async startRecording(outputPath) {
    logger.info('[Recorder] Gravando...');
    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse', '-i', 'default',
      '-acodec', 'libopus', outputPath, '-y'
    ]);
  }

  async monitorMeetingUntilEnd() {
    let aloneCount = 0;
    while (aloneCount < 10) {
      const participants = await this.page.evaluate(() => {
        const el = document.querySelector('.uGOf1d');
        return el ? parseInt(el.innerText) : 0;
      });
      if (participants <= 1) aloneCount++; else aloneCount = 0;
      await this.sleep(10000);
    }
    logger.info('[Recorder] Finalizando gravação por falta de participantes.');
  }

  async stopRecording() {
    if (this.recordingProcess) this.recordingProcess.kill('SIGINT');
  }

  async convertToWav(input, output) {
    return new Promise(res => spawn('ffmpeg', ['-i', input, '-ar', '16000', '-ac', '1', output, '-y']).on('close', res));
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = { MeetRecorder };
