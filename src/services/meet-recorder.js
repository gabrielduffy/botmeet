// src/services/meet-recorder.js
// Entra no Google Meet e grava o áudio da reunião - MODO STEALTH (tl.dv Style)

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
    this.lastRecordingDuration = 0;
    this.recordingsDir = process.env.RECORDINGS_DIR || '/app/recordings';
    this.userDataDir = process.env.USER_DATA_DIR || '/app/browser-data';

    if (!fs.existsSync(this.recordingsDir)) fs.mkdirSync(this.recordingsDir, { recursive: true });
    if (!fs.existsSync(this.userDataDir)) fs.mkdirSync(this.userDataDir, { recursive: true });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async joinAndRecord(meetUrl, eventId) {
    const outputPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.webm`);
    const audioPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.wav`);

    try {
      await this.launchBrowser();

      // Tentamos o login, mas se der desafio de 2FA, seguimos como convidado!
      await this.loginGoogle();

      await this.joinMeeting(meetUrl);
      await this.startRecording(outputPath);
      await this.monitorMeetingUntilEnd();
      await this.stopRecording();
      await this.convertToWav(outputPath, audioPath);
      await this.cleanup();

      return audioPath;
    } catch (error) {
      logger.error(`[Recorder] Erro: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  async launchBrowser() {
    logger.info('[Recorder] Iniciando browser em modo STEALTH...');

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--window-size=1280,720',
        '--enable-audio-service-sandbox',
        `--display=${process.env.DISPLAY || ':99'}`,
      ],
      defaultViewport: { width: 1280, height: 720 },
    });

    this.page = await this.browser.newPage();

    // Configurar permissões globais
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
  }

  async loginGoogle() {
    logger.info('[Recorder] Verificando sessão do Google...');
    try {
      await this.page.goto('https://accounts.google.com/signin', { waitUntil: 'networkidle2', timeout: 30000 });

      // Se vir a barra de busca ou perfil, já está logado
      if (await this.page.$('[aria-label="Google Account"]') || this.page.url().includes('myaccount')) {
        logger.info('[Recorder] ✅ Sessão já ativa!');
        return;
      }

      logger.info('[Recorder] Tentando login automático...');
      const email = process.env.BOT_GOOGLE_EMAIL;
      const pass = process.env.BOT_GOOGLE_PASSWORD;

      if (!email || !pass) return;

      await this.page.type('input[type="email"]', email, { delay: 100 });
      await this.page.keyboard.press('Enter');
      await this.sleep(3000);

      // Se aparecer tela de desafio/2FA, DESISTE e vai pra reunião como convidado
      if (this.page.url().includes('challenge') || await this.page.$('#identity-checkout')) {
        logger.warn('[Recorder] ⚠️ Desafio de segurança detectado. Entraremos como CONVIDADO.');
        return;
      }

      await this.page.type('input[type="password"]', pass, { delay: 100 });
      await this.page.keyboard.press('Enter');
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(() => { });
    } catch (e) {
      logger.warn('[Recorder] Falha no login, seguindo como convidado: ' + e.message);
    }
  }

  async joinMeeting(meetUrl) {
    logger.info(`[Recorder] Acessando Meet: ${meetUrl}`);
    await this.page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    // Esperar a tela carregar
    await this.sleep(5000);

    // Se pedir nome (modo convidado)
    const nameInput = await this.page.$('input[aria-label="Qual é o seu nome?"], input[placeholder="Seu nome"]');
    if (nameInput) {
      logger.info('[Recorder] Entrando como CONVIDADO (Benemax Bot)...');
      await nameInput.type('Benemax Assistant', { delay: 100 });
      await this.page.keyboard.press('Enter');
    }

    // Clicar em "Pedir para participar" ou "Participar agora"
    const joinSelectors = [
      'span:contains("Pedir para participar")',
      'span:contains("Participar agora")',
      'div[role="button"] span',
      'button:not([disabled])'
    ];

    logger.info('[Recorder] Tentando entrar na sala...');
    for (let i = 0; i < 10; i++) {
      const buttons = await this.page.$$('button');
      for (const btn of buttons) {
        const text = await this.page.evaluate(el => el.innerText, btn);
        if (text.includes('participar') || text.includes('Join') || text.includes('Participar')) {
          await btn.click();
          logger.info(`[Recorder] Botão "${text}" clicado!`);
          return;
        }
      }
      await this.page.waitForTimeout(2000);
    }
  }

  async startRecording(outputPath) {
    logger.info('[Recorder] Iniciando gravação FFmpeg...');
    const display = process.env.DISPLAY || ':99';

    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse',
      '-i', 'default',
      '-acodec', 'libopus',
      outputPath,
      '-y'
    ]);

    this.recordingProcess.stderr.on('data', (data) => {
      // logger.debug(`[FFmpeg] ${data}`);
    });
  }

  async monitorMeetingUntilEnd() {
    logger.info('[Recorder] Monitorando reunião...');
    let participantMissingCount = 0;

    while (participantMissingCount < 5) {
      const participants = await this.page.evaluate(() => {
        const el = document.querySelector('.uGOf1d'); // Seletor de número de participantes
        return el ? parseInt(el.innerText) : 0;
      });

      if (participants <= 1) {
        participantMissingCount++;
        logger.info(`[Recorder] Reunião vazia? (${participantMissingCount}/10)`);
      } else {
        participantMissingCount = 0;
      }
      await this.sleep(10000);
    }
    logger.info('[Recorder] Reunião encerrada ou bot ficou sozinho.');
  }

  async stopRecording() {
    if (this.recordingProcess) {
      this.recordingProcess.kill('SIGINT');
      logger.info('[Recorder] Gravação interrompida.');
    }
  }

  async convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      spawn('ffmpeg', ['-i', inputPath, '-ar', '16000', '-ac', '1', outputPath, '-y'])
        .on('close', resolve)
        .on('error', reject);
    });
  }

  async cleanup() {
    if (this.browser) await this.browser.close();
    logger.info('[Recorder] Recursos limpos.');
  }
}

module.exports = { MeetRecorder };
