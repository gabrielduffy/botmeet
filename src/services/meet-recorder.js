// src/services/meet-recorder.js
// Entra no Google Meet e grava o áudio da reunião

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');

class MeetRecorder {
  constructor() {
    this.browser = null;
    this.page = null;
    this.recordingProcess = null;
    this.lastRecordingDuration = 0;
    this.recordingsDir = process.env.RECORDINGS_DIR || '/app/recordings';
    
    // Garantir que diretório existe
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * Entra na reunião e grava
   * @param {string} meetUrl - URL do Google Meet
   * @param {string} eventId - ID do evento para nomear arquivo
   * @returns {string} Caminho do arquivo de áudio gravado
   */
  async joinAndRecord(meetUrl, eventId) {
    const outputPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.webm`);
    const audioPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.wav`);
    
    try {
      // 1. Iniciar browser
      await this.launchBrowser();
      
      // 2. Fazer login no Google
      await this.loginGoogle();
      
      // 3. Entrar na reunião
      await this.joinMeeting(meetUrl);
      
      // 4. Iniciar gravação de áudio
      await this.startRecording(outputPath);
      
      // 5. Monitorar reunião até terminar
      await this.monitorMeetingUntilEnd();
      
      // 6. Parar gravação
      await this.stopRecording();
      
      // 7. Converter para WAV (melhor para Whisper)
      await this.convertToWav(outputPath, audioPath);
      
      // 8. Limpar
      await this.cleanup();
      
      return audioPath;
      
    } catch (error) {
      logger.error(`[Recorder] Erro: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Inicia o browser com configurações especiais para áudio
   */
  async launchBrowser() {
    logger.info('[Recorder] Iniciando browser...');

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false, // Precisa ser false para capturar áudio
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-blink-features=AutomationControlled',
        '--use-fake-ui-for-media-stream', // Aceita permissões de mídia automaticamente
        '--use-fake-device-for-media-stream',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies',
        '--window-size=1920,1080',
        '--start-maximized',
        // Áudio
        '--enable-audio-service-sandbox',
        `--display=${process.env.DISPLAY || ':99'}`,
      ],
      defaultViewport: null,
    });

    this.page = await this.browser.newPage();
    
    // Configurar user agent realista
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Permitir todas as permissões
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', [
      'microphone',
      'camera',
      'notifications',
    ]);

    logger.info('[Recorder] Browser iniciado');
  }

  /**
   * Faz login na conta Google do bot
   */
  async loginGoogle() {
    logger.info('[Recorder] Fazendo login no Google...');

    const email = process.env.BOT_GOOGLE_EMAIL;
    const password = process.env.BOT_GOOGLE_PASSWORD;

    if (!email || !password) {
      throw new Error('BOT_GOOGLE_EMAIL e BOT_GOOGLE_PASSWORD são obrigatórios');
    }

    try {
      // Ir para página de login
      await this.page.goto('https://accounts.google.com/signin', {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      // Verificar se já está logado
      if (this.page.url().includes('myaccount.google.com')) {
        logger.info('[Recorder] Já está logado');
        return;
      }

      // Inserir email
      await this.page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await this.page.type('input[type="email"]', email, { delay: 50 });
      await this.page.click('#identifierNext');
      
      // Aguardar campo de senha
      await this.sleep(3000);
      
      // Inserir senha
      await this.page.waitForSelector('input[type="password"]', { visible: true, timeout: 15000 });
      await this.sleep(1000);
      await this.page.type('input[type="password"]', password, { delay: 50 });
      await this.page.click('#passwordNext');

      // Aguardar login completar
      await this.sleep(5000);

      // Verificar se login foi bem sucedido
      const currentUrl = this.page.url();
      if (currentUrl.includes('challenge') || currentUrl.includes('signin')) {
        logger.warn('[Recorder] Possível verificação de segurança detectada');
        // Tentar continuar mesmo assim
      }

      logger.info('[Recorder] Login realizado');
      
    } catch (error) {
      logger.error(`[Recorder] Erro no login: ${error.message}`);
      
      // Salvar screenshot para debug
      const screenshotPath = path.join(this.recordingsDir, `login-error-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      logger.info(`[Recorder] Screenshot salvo: ${screenshotPath}`);
      
      throw error;
    }
  }

  /**
   * Entra na reunião do Google Meet
   */
  async joinMeeting(meetUrl) {
    logger.info(`[Recorder] Entrando na reunião: ${meetUrl}`);

    try {
      // Navegar para o Meet
      await this.page.goto(meetUrl, {
        waitUntil: 'networkidle2',
        timeout: 60000,
      });

      await this.sleep(3000);

      // Desligar câmera e microfone antes de entrar
      try {
        // Botão de câmera (desligar)
        const cameraButton = await this.page.$('[data-is-muted="false"][aria-label*="camera" i]');
        if (cameraButton) {
          await cameraButton.click();
          logger.info('[Recorder] Câmera desligada');
        }
      } catch (e) {
        logger.warn('[Recorder] Não foi possível desligar câmera');
      }

      try {
        // Botão de microfone (desligar)
        const micButton = await this.page.$('[data-is-muted="false"][aria-label*="microphone" i]');
        if (micButton) {
          await micButton.click();
          logger.info('[Recorder] Microfone desligado');
        }
      } catch (e) {
        logger.warn('[Recorder] Não foi possível desligar microfone');
      }

      await this.sleep(2000);

      // Procurar botão de entrar
      const joinButtonSelectors = [
        'button[jsname="Qx7uuf"]', // "Participar agora"
        '[data-idom-class*="join"]',
        'button:has-text("Participar")',
        'button:has-text("Join")',
        'button:has-text("Pedir para participar")',
        'button:has-text("Ask to join")',
        '[jsname="CQylAd"]', // Alternativo
      ];

      let joined = false;
      for (const selector of joinButtonSelectors) {
        try {
          const button = await this.page.$(selector);
          if (button) {
            await button.click();
            joined = true;
            logger.info(`[Recorder] Clicou em: ${selector}`);
            break;
          }
        } catch (e) {
          continue;
        }
      }

      if (!joined) {
        // Tentar por texto
        await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const joinBtn = buttons.find(b => 
            b.textContent?.includes('Participar') || 
            b.textContent?.includes('Join') ||
            b.textContent?.includes('Pedir')
          );
          if (joinBtn) joinBtn.click();
        });
      }

      // Aguardar entrada na reunião
      await this.sleep(5000);

      // Verificar se entrou (procurar elementos da reunião ativa)
      const inMeeting = await this.page.evaluate(() => {
        return document.querySelector('[data-participant-id]') !== null ||
               document.querySelector('[data-self-name]') !== null ||
               document.querySelector('[jscontroller="xzbRj"]') !== null;
      });

      if (!inMeeting) {
        logger.warn('[Recorder] Pode não ter entrado na reunião ainda');
      }

      logger.info('[Recorder] Entrou na reunião');
      
    } catch (error) {
      logger.error(`[Recorder] Erro ao entrar na reunião: ${error.message}`);
      
      // Screenshot para debug
      const screenshotPath = path.join(this.recordingsDir, `join-error-${Date.now()}.png`);
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      
      throw error;
    }
  }

  /**
   * Inicia gravação de áudio do sistema
   */
  async startRecording(outputPath) {
    logger.info('[Recorder] Iniciando gravação de áudio...');

    return new Promise((resolve, reject) => {
      // Usar ffmpeg para gravar áudio do PulseAudio
      this.recordingProcess = spawn('ffmpeg', [
        '-f', 'pulse',
        '-i', 'default',
        '-ac', '1', // Mono
        '-ar', '16000', // 16kHz (bom para Whisper)
        '-y', // Sobrescrever
        outputPath,
      ]);

      this.recordingProcess.stderr.on('data', (data) => {
        // FFmpeg envia info no stderr
        const message = data.toString();
        if (message.includes('Error') || message.includes('error')) {
          logger.error(`[FFmpeg] ${message}`);
        }
      });

      this.recordingProcess.on('error', (error) => {
        logger.error(`[Recorder] Erro no FFmpeg: ${error.message}`);
        reject(error);
      });

      this.recordingStartTime = Date.now();
      logger.info('[Recorder] Gravação iniciada');
      resolve();
    });
  }

  /**
   * Monitora a reunião até que ela termine
   */
  async monitorMeetingUntilEnd() {
    logger.info('[Recorder] Monitorando reunião...');

    const maxDuration = 3 * 60 * 60 * 1000; // 3 horas máximo
    const checkInterval = 15000; // Verificar a cada 15 segundos
    const startTime = Date.now();
    let silenceCount = 0;
    const maxSilenceChecks = 20; // ~5 minutos de "inatividade"

    while (Date.now() - startTime < maxDuration) {
      await this.sleep(checkInterval);

      try {
        // Verificar se ainda está na reunião
        const meetingEnded = await this.page.evaluate(() => {
          // Procurar indicadores de reunião encerrada
          const endedIndicators = [
            'Você saiu da reunião',
            'You left the meeting',
            'A chamada terminou',
            'The call has ended',
            'Retornar à tela inicial',
            'Return to home screen',
          ];
          
          const bodyText = document.body.innerText || '';
          return endedIndicators.some(ind => bodyText.includes(ind));
        });

        if (meetingEnded) {
          logger.info('[Recorder] Reunião encerrada detectada');
          break;
        }

        // Verificar número de participantes
        const participantCount = await this.page.evaluate(() => {
          // Tentar encontrar contador de participantes
          const countEl = document.querySelector('[data-participant-count]');
          if (countEl) {
            return parseInt(countEl.getAttribute('data-participant-count') || '0');
          }
          
          // Contar avatares de participantes
          const participants = document.querySelectorAll('[data-participant-id]');
          return participants.length;
        });

        logger.info(`[Recorder] Participantes: ${participantCount} | Duração: ${Math.round((Date.now() - startTime) / 60000)} min`);

        // Se só sobrou o bot (1 participante), pode encerrar
        if (participantCount <= 1) {
          silenceCount++;
          if (silenceCount >= maxSilenceChecks) {
            logger.info('[Recorder] Apenas o bot na reunião por muito tempo, encerrando...');
            break;
          }
        } else {
          silenceCount = 0;
        }

      } catch (error) {
        logger.warn(`[Recorder] Erro ao verificar reunião: ${error.message}`);
        
        // Se página foi fechada, encerrar
        if (error.message.includes('Target closed') || error.message.includes('Session closed')) {
          break;
        }
      }
    }

    this.lastRecordingDuration = Math.round((Date.now() - this.recordingStartTime) / 1000);
    logger.info(`[Recorder] Monitoramento encerrado. Duração: ${this.lastRecordingDuration}s`);
  }

  /**
   * Para a gravação
   */
  async stopRecording() {
    logger.info('[Recorder] Parando gravação...');

    return new Promise((resolve) => {
      if (!this.recordingProcess) {
        resolve();
        return;
      }

      this.recordingProcess.on('close', () => {
        logger.info('[Recorder] Gravação parada');
        resolve();
      });

      // Enviar SIGINT para encerrar graciosamente
      this.recordingProcess.kill('SIGINT');

      // Timeout de segurança
      setTimeout(() => {
        if (this.recordingProcess && !this.recordingProcess.killed) {
          this.recordingProcess.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });
  }

  /**
   * Converte áudio para WAV (formato ideal para Whisper)
   */
  async convertToWav(inputPath, outputPath) {
    logger.info('[Recorder] Convertendo para WAV...');

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-i', inputPath,
        '-ar', '16000',
        '-ac', '1',
        '-c:a', 'pcm_s16le',
        '-y',
        outputPath,
      ]);

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          logger.info('[Recorder] Conversão concluída');
          
          // Remover arquivo original para economizar espaço
          try {
            fs.unlinkSync(inputPath);
          } catch (e) {}
          
          resolve(outputPath);
        } else {
          reject(new Error(`FFmpeg retornou código ${code}`));
        }
      });

      ffmpeg.on('error', reject);
    });
  }

  /**
   * Retorna duração da última gravação em segundos
   */
  getLastRecordingDuration() {
    return this.lastRecordingDuration;
  }

  /**
   * Limpa recursos
   */
  async cleanup() {
    logger.info('[Recorder] Limpando recursos...');

    if (this.recordingProcess && !this.recordingProcess.killed) {
      this.recordingProcess.kill();
    }

    if (this.page) {
      try {
        await this.page.close();
      } catch (e) {}
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {}
    }

    this.page = null;
    this.browser = null;
    this.recordingProcess = null;
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { MeetRecorder };
