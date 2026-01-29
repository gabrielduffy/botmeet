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
    this.userDataDir = process.env.USER_DATA_DIR || '/app/browser-data';

    // Garantir que diretórios existem
    if (!fs.existsSync(this.recordingsDir)) fs.mkdirSync(this.recordingsDir, { recursive: true });
    if (!fs.existsSync(this.userDataDir)) fs.mkdirSync(this.userDataDir, { recursive: true });
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
    logger.info('[Recorder] Iniciando browser com perfil persistente...');

    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false,
      userDataDir: this.userDataDir, // SALVA O LOGIN AQUI
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

    try {
      const email = process.env.BOT_GOOGLE_EMAIL;
      const password = process.env.BOT_GOOGLE_PASSWORD;

      if (!email || !password) {
        throw new Error('BOT_GOOGLE_EMAIL e BOT_GOOGLE_PASSWORD são obrigatórios');
      }

      // Cookies hardcoded para garantir o login sem depender do Easypanel
      const HARDCODED_COOKIES = [{ "domain": ".google.com", "expirationDate": 1804252560.375281, "hostOnly": false, "httpOnly": false, "name": "SAPISID", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3" }, { "domain": ".google.com", "expirationDate": 1804252560.375386, "hostOnly": false, "httpOnly": false, "name": "__Secure-3PAPISID", "path": "/", "sameSite": "no_restriction", "secure": true, "session": false, "storeId": null, "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3" }, { "domain": ".google.com", "expirationDate": 1769699548.562192, "hostOnly": false, "httpOnly": true, "name": "AEC", "path": "/", "sameSite": "lax", "secure": true, "session": false, "storeId": null, "value": "AaJma5ucTT0xwFmyg4Nxhc2dPNrTYYjYBoPiZtbGfrZiIxSMgfJAu-iniUQ" }, { "domain": ".google.com", "expirationDate": 1785473235.203693, "hostOnly": false, "httpOnly": true, "name": "NID", "path": "/", "sameSite": "no_restriction", "secure": true, "session": false, "storeId": null, "value": "528=jOcAayjs-H3LorgCEGgwjSy9HVbpDTP3TEXsoJn8f5BKrpVrhC08Tt2U6cJYOtPZ4AFGnXz75AyjizLpAgoDvkPm6oVcEDggwijOmlRvMxBq7XhoINL_zyBRr_El6au9pQmCWQSChYHmIJS7WCbMsE67f8PvoITh0wKp_QUrCSediJvnZmM9DRyk2NiDXN0dZU38BAJNNnzyHxhyUsxO5dEXNs8ArTgqkoYo4X-Co1omvNqCxJUxv-MQi6VYrR8P1DUMObmnXDco-0DMwoQtRQHxFj-kq4LCZ5-WsPGNRwNgd7TjF8b46jDkR2FL0D5KWJ1mxAb3G-WOqRsYwVwKR6mViKoLA3t7deq_b-5r5DocDm8mO-PZu4sr0dfXAMP3qdy2tBksfWxAiprM3eb5T73RHFXuvCEZFVGmV_iJJo8QaNISiHcYnxc_IB0Ra8rStcEE-UGuIuChA4dmTub2_ekfbpJetGzwrYdITnST1CCnujHWwZI13XGdPJPaukuPzcJkzKhA7w6elBFkCshed0yX5GOlBUpWN_3t5nW9itBR4adBO5AkEVDUwiHRNLD6wKerZqiQP0ytNUg_BctJ4ov3do3kF6G8Dp8UEiwQz36fLnTAdG6Xc1rJhdo5Li5fgBVesr56Wfc21xy_ZpSJ7DLXrasRKdGmtHnCXR5H7K5YWrlpGDNyFbNHjyaJCWA9JIhwZbbyRH6Ql0HKoXk0AydXkxXPc8b1tFSCf3QIIrULRfaMz_ZgS0r98m-TFdnNCYzHZ0nopn_Z5Pau5DwedO19gytCTIb0V-0XqqWkha3j1aLLj3Hqyd2rNkxk5Gg8FK38GWy-d06PxNfjNz0-fDvvfK1tJ6Rp4hCMwWZUfW6JEisMyaMZ5ForXmRupr4t8Duv6w0eLi3pu16H0bAofASsN0CIQ-Yhr6oF28ZJaW1EiseLRMnk-hSk_J7IexNRzL2pIxZFrEM7CQ1bMolwGJBQHyZHVC6iMhEwCURCXDjhLBeaX7ny_YUtXnKK0LZB9IeN9mTAQPSFdLflpVNO20DCMojl2MOpS5NxWcv361imN5wSX3e2rpZlIjgU4qB9IYc87sLRd4MeHxbOw7zkTI_7YJ4jOcv5ugsuKVAI2jECoAlHH2DVA6jaeDg4YwjUMubayQLZHrSBDZAcVKYLf8JpZKneZKDJDfnvCFFFSgHN715yCw3tmJeYwUr1CgIpHJpHbX8d4sXFXvmge1h8KqP1jl8QHyGN373Ipd6pBsQixs2ZJK8stIiZOzE1agKsfHgtC2MiS7RtdTNYVC4FSZSopzmNrbwnr4t86jtc3Fg2KoumVF_YQ7F5wo8p-LgLUvaLc0v3WqRd_dO8wVEwdmj44axYjMCcfwMgK8iKIxgb1AqX0Y2n-W4Yh0eWYTKddpRJdslTus4Xclexk9txCDIdTskqF3eNGF15twdwC7KxIvIcU5hYFJTZZ3ZleB0l62RAM1Kn3Z9NGrJSPnQryWh6uwMA-v1O8pBGEvVIW3wG_ABFRA-UcZVI180-xGkdj1PrR2rHenbtmiDv_ZXD-8H2NShuFNR85PAftKjZaV9tKk4Y8R8DazYPGQnzkYxbRCDhjdMMaMrVaXQQ3_objzgigfcig90A0Gxgk07nRXWlagkpZfzv4QAYClvocEi_hUr2bqjU7SXZTHjbhHvSYgdjYPOBsyflKBJ4pbYbhCv3ETUHIeBvDsFIkwS_jvWtPrndsQHykdyxAL0vu1Y7zBMVimBCXDgxXCN_3WQWu6W3MKJMpAmrVd_uApkuoxtDpckOWo3azzWVh442IuJ0a6Xe14VcfXN1dEqYzNjtUBOuV45bX_yA0N7Uj8vpWYzWi24HORKDmJ4IsI9UObH0sIDNTxUGyxRiSvOH7iygHNaVLdVydqkXLzOQXKKeS9QEW98oSanYmfT639oIJMfAuxqVlZ18g021ZGqxNFXLFokZqXDks02Cia4hLyEDjsUi7hPo-Ecf0OsqRu0ILWat5oMEz9W1rl96V22bfyERw" }, { "domain": ".google.com", "expirationDate": 1801233366.834571, "hostOnly": false, "httpOnly": true, "name": "__Secure-1PSIDTS", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "sidts-CjEB7I_69KXMNNh7z_L0bxMgyLTg92jhv6sEDQO49L4rsJ5op85xaYS40Vnsf1dLw-5XEAA" }, { "domain": "www.google.com", "expirationDate": 1770144296, "hostOnly": true, "httpOnly": false, "name": "OTZ", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "8420805_68_64_73560_68_416340" }, { "domain": ".google.com", "expirationDate": 1804252560.375334, "hostOnly": false, "httpOnly": false, "name": "__Secure-1PAPISID", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3" }, { "domain": ".google.com", "expirationDate": 1804252560.374856, "hostOnly": false, "httpOnly": true, "name": "__Secure-3PSID", "path": "/", "sameSite": "no_restriction", "secure": true, "session": false, "storeId": null, "value": "g.a0006AgzkxcQw3DwwEKThr_jS830Vu0oWyO3NYnTkFwC-iQQTt83C9njC1T8LwZGizhvSM36cAACgYKAcgSARQSFQHGX2MiahYosPWLDff5RhrZKafmOhoVAUF8yKry1jXdJePNcT6z4-42kl3X0076" }, { "domain": ".google.com", "expirationDate": 1804252560.374786, "hostOnly": false, "httpOnly": true, "name": "__Secure-1PSID", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "g.a0006AgzkxcQw3DwwEKThr_jS830Vu0oWyO3NYnTkFwC-iQQTt83r6uPcGrzFo_ZwmuGWRx7nAACgYKAVMSARQSFQHGX2MiOm-b5X-hLzuYaBuBtHomQxoVAUF8yKo3Hptnb0-bCEUBvBitSbvI0076" }, { "domain": ".google.com", "expirationDate": 1801233657.463584, "hostOnly": false, "httpOnly": true, "name": "__Secure-1PSIDCC", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "AKEyXzU_HW69pYWZTvsiEatLLPfX_bQs3bmC1S3cFDjRBDUJ9UOVuN0YcSWThfOq3PGf8H13dZM" }, { "domain": ".google.com", "expirationDate": 1801233657.463647, "hostOnly": false, "httpOnly": true, "name": "__Secure-3PSIDCC", "path": "/", "sameSite": "no_restriction", "secure": true, "session": false, "storeId": null, "value": "AKEyXzVJYm9lZCQ_IPHsi2Ow0h2HyqJm42SDGaXRqGd19Ql_E6vERni0eEF8aO89QrzsU_rQqS0" }, { "domain": ".google.com", "expirationDate": 1801233366.834754, "hostOnly": false, "httpOnly": true, "name": "__Secure-3PSIDTS", "path": "/", "sameSite": "no_restriction", "secure": true, "session": false, "storeId": null, "value": "sidts-CjEB7I_69KXMNNh7z_L0bxMgyLTg92jhv6sEDQO49L4rsJ5op85xaYS40Vnsf1dLw-5XEAA" }, { "domain": ".google.com", "expirationDate": 1779491082.490728, "hostOnly": false, "httpOnly": true, "name": "__Secure-BUCKET", "path": "/", "sameSite": "lax", "secure": true, "session": false, "storeId": null, "value": "CA4" }, { "domain": ".google.com", "expirationDate": 1804252560.375174, "hostOnly": false, "httpOnly": true, "name": "SSID", "path": "/", "sameSite": null, "secure": true, "session": false, "storeId": null, "value": "A_pwxGdK_et32L7Gn" }];

      logger.info('[Recorder] Usando cookies de sessão hardcoded...');
      try {
        // Sanitizar cookies (Puppeteer não aceita null no sameSite)
        const sanitizedCookies = HARDCODED_COOKIES.map(cookie => {
          const sanitized = { ...cookie };
          if (!sanitized.sameSite || sanitized.sameSite === null) {
            delete sanitized.sameSite;
          }
          return sanitized;
        });

        await this.page.setCookie(...sanitizedCookies);
        logger.info('[Recorder] Cookies aplicados com sucesso');

        await this.page.goto('https://myaccount.google.com', { waitUntil: 'networkidle2' });
        if (this.page.url().includes('myaccount.google.com')) {
          logger.info('[Recorder] Login realizado com sucesso via COOKIES');
          return;
        }
        logger.warn('[Recorder] Cookies parecem expirados ou inválidos');
      } catch (cookieError) {
        logger.error(`[Recorder] Erro ao aplicar cookies: ${cookieError.message}`);
      }

      // Fallback para login convencional
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

      // Seletores de botões conhecidos (Português e Inglês)
      const joinButtonSelectors = [
        'button[jsname="Qx7uuf"]', // "Participar agora"
        '[data-idom-class*="join"]',
        'button:has-text("Participar")',
        'button:has-text("Join")',
        'button:has-text("Pedir para participar")',
        'button:has-text("Ask to join")',
        '[jsname="CQylAd"]', // Alternativo
      ];

      // Loop agressivo de tentativa de entrada (30 segundos)
      let joined = false;
      const startTime = Date.now();

      while (!joined && (Date.now() - startTime < 30000)) {
        for (const selector of joinButtonSelectors) {
          try {
            const button = await this.page.$(selector);
            if (button) {
              const isVisible = await button.evaluate(b => {
                const style = window.getComputedStyle(b);
                return style && style.display !== 'none' && style.visibility !== 'hidden' && b.offsetHeight > 0;
              });

              if (isVisible) {
                await button.click();
                logger.info(`[Recorder] Clicou no botão via seletor: ${selector}`);
                joined = true;
                break;
              }
            }
          } catch (e) { }
        }

        if (!joined) {
          // Tentar via Texto/Texto em botões genéricos
          joined = await this.page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
            const joinBtn = buttons.find(b => {
              const text = (b.innerText || b.textContent || "").toLowerCase();
              return text.includes('participar') ||
                text.includes('join') ||
                text.includes('pedir para') ||
                text.includes('ask to join') ||
                text.includes('entrar');
            });
            if (joinBtn) {
              joinBtn.click();
              return true;
            }
            return false;
          });
          if (joined) logger.info('[Recorder] Clicou no botão via busca de texto');
        }

        if (!joined) {
          await this.sleep(2000); // Espera 2s antes de tentar de novo
        }
      }

      // Aguardar e verificar se entrou de fato
      logger.info('[Recorder] Aguardando confirmação de entrada...');
      await this.sleep(10000); // Dá 10s para ser admitido ou carregar

      const meetingState = await this.page.evaluate(() => {
        const text = document.body.innerText || "";
        if (text.includes('Pedindo para participar') || text.includes('Asking to join')) return 'waiting';
        if (document.querySelector('[data-participant-id]') || document.querySelector('[jscontroller="xzbRj"]')) return 'in';
        return 'unknown';
      });

      if (meetingState === 'waiting') {
        logger.warn('[Recorder] ⏳ Bot parado no lobby: Aguardando organizador admitir entrada');
      } else if (meetingState === 'in') {
        logger.info('[Recorder] ✅ Confirmado: Bot dentro da reunião');
      } else {
        logger.warn('[Recorder] ❓ Estado da reunião incerto, prosseguindo com gravação');
      }

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
          } catch (e) { }

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
      } catch (e) { }
    }

    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) { }
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
