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

      // Tenta login com cookies, mas não trava se falhar
      await this.loginGoogle();

      const joined = await this.joinMeeting(meetUrl);
      if (!joined) {
        throw new Error('Não foi possível entrar na sala após várias tentativas.');
      }

      await this.startRecording(outputPath);
      await this.monitorMeetingUntilEnd();
      await this.stopRecording();
      await this.convertToWav(outputPath, audioPath);
      await this.cleanup();
      return audioPath;
    } catch (error) {
      logger.error(`[Recorder] ❌ Falha crítica: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  async launchBrowser() {
    logger.info('[Recorder] Iniciando Chromium Furtivo...');
    this.browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      headless: false,
      userDataDir: this.userDataDir,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--window-size=1280,720',
        `--display=${process.env.DISPLAY || ':99'}`,
      ],
    });

    this.page = await this.browser.newPage();
    await this.page.setViewport({ width: 1280, height: 720 });

    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
  }

  async loginGoogle() {
    logger.info('[Recorder] Aplicando cookies...');
    const HARDCODED_COOKIES = [
      { "domain": ".google.com", "name": "SAPISID", "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "__Secure-3PAPISID", "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "AEC", "value": "AaJma5ucTT0xwFmyg4Nxhc2dPNrTYYjYBoPiZtbGfrZiIxSMgfJAu-iniUQ", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "NID", "value": "528=jOcAayjs-H3LorgCEGgwjSy9HVbpDTP3TEXsoJn8f5BKrpVrhC08Tt2U6cJYOtPZ4AFGnXz75AyjizLpAgoDvkPm6oVcEDggwijOmlRvMxBq7XhoINL_zyBRr_El6au9pQmCWQSChYHmIJS7WCbMsE67f8PvoITh0wKp_QUrCSediJvnZmM9DRyk2NiDXN0dZU38BAJNNnzyHxhyUsxO5dEXNs8ArTgqkoYo4X-Co1omvNqCxJUxv-MQi6VYrR8P1DUMObmnXDco-0DMwoQtRQHxFj-kq4LCZ5-WsPGNRwNgd7TjF8b46jDkR2FL0D5KWJ1mxAb3G-WOqRsYwVwKR6mViKoLA3t7deq_b-5r5DocDm8mO-PZu4sr0dfXAMP3qdy2tBksfWxAiprM3eb5T73RHFXuvCEZFVGmV_iJJo8QaNISiHcYnxc_IB0Ra8rStcEE-UGuIuChA4dmTub2_ekfbpJetGzwrYdITnST1CCnujHWwZI13XGdPJPaukuPzcJkzKhA7w6elBFkCshed0yX5GOlBUpWN_3t5nW9itBR4adBO5AkEVDUwiHRNLD6wKerZqiQP0ytNUg_BctJ4ov3do3kF6G8Dp8UEiwQz36fLnTAdG6Xc1rJhdo5Li5fgBVesr56Wfc21xy_ZpSJ7DLXrasRKdGmtHnCXR5H7K5YWrlpGDNyFbNHjyaJCWA9JIhwZbbyRH6Ql0HKoXk0AydXkxXPc8b1tFSCf3QIIrULRfaMz_ZgS0r98m-TFdnNCYzHZ0nopn_Z5Pau5DwedO19gytCTIb0V-0XqqWkha3j1aLLj3Hqyd2rNkxk5Gg8FK38GWy-d06PxNfjNz0-fDvvfK1tJ6Rp4hCMwWZUfW6JEisMyaMZ5ForXmRupr4t8Duv6w0eLi3pu16H0bAofASsN0CIQ-Yhr6oF28ZJaW1EiseLRMnk-hSk_J7IexNRzL2pIxZFrEM7CQ1bMolwGJBQHyZHVC6iMhEwCURCXDjhLBeaX7ny_YUtXnKK0LZB9IeN9mTAQPSFdLflpVNO20DCMojl2MOpS5NxWcv361imN5wSX3e2rpZlIjgU4qB9IYc87sLRd4MeHxbOw7zkTI_7YJ4jOcv5ugsuKVAI2jECoAlHH2DVA6jaeDg4YwjUMubayQLZHrSBDZAcVKYLf8JpZKneZKDJDfnvCFFFSgHN715yCw3tmJeYwUr1CgIpHJpHbX8d4sXFXvmge1h8KqP1jl8QHyGN373Ipd6pBsQixs2ZJK8stIiZOzE1agKsfHgtC2MiS7RtdTNYVC4FSZSopzmNrbwnr4t86jtc3Fg2KoumVF_YQ7F5wo8p-LgLUvaLc0v3WqRd_dO8wVEwdmj44axYjMCcfwMgK8iKIxgb1AqX0Y2n-W4Yh0eWYTKddpRJdslTus4Xclexk9txCDIdTskqF3eNGF15twdwC7KxIvIcU5hYFJTZZ3ZleB0l62RAM1Kn3Z9NGrJSPnQryWh6uwMA-v1O8pBGEvVIW3wG_ABFRA-UcZVI180-xGkdj1PrR2rHenbtmiDv_ZXD-8H2NShuFNR85PAftKjZaV9tKk4Y8R8DazYPGQnzkYxbRCDhjdMMaMrVaXQQ3_objzgigfcig90A0Gxgk07nRXWlagkpZfzv4QAYClvocEi_hUr2bqjU7SXZTHjbhHvSYgdjYPOBsyflKBJ4pbYbhCv3ETUHIeBvDsFIkwS_jvWtPrndsQHykdyxAL0vu1Y7zBMVimBCXDgxXCN_3WQWu6W3MKJMpAmrVd_uApkuoxtDpckOWo3azzWVh442IuJ0a6Xe14VcfXN1dEqYzNjtUBOuV45bX_yA0N7Uj8vpWYzWi24HORKDmJ4IsI9UObH0sIDNTxUGyxRiSvOH7iygHNaVLdVydqkXLzOQXKKeS9QEW98oSanYmfT639oIJMfAuxqVlZ18g021ZGqxNFXLFokZqXDks02Cia4hLyEDjsUi7hPo-Ecf0OsqRu0ILWat5oMEz9W1rl96V22bfyERw" },
      { "domain": ".google.com", "name": "__Secure-1PSIDTS", "value": "sidts-CjEB7I_69KXMNNh7z_L0bxMgyLTg92jhv6sEDQO49L4rsJ5op85xaYS40Vnsf1dLw-5XEAA", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "__Secure-1PSID", "value": "g.a0006AgzkxcQw3DwwEKThr_jS830Vu0oWyO3NYnTkFwC-iQQTt83r6uPcGrzFo_ZwmuGWRx7nAACgYKAVMSARQSFQHGX2MiOm-b5X-hLzuYaBuBtHomQxoVAUF8yKo3Hptnb0-bCEUBvBitSbvI0076", "path": "/", "secure": true }
    ];

    try {
      await this.page.setCookie(...HARDCODED_COOKIES);
      await this.page.goto('https://www.google.com', { waitUntil: 'networkidle2' });
      logger.info('[Recorder] Cookies injetados.');
    } catch (e) {
      logger.warn('[Recorder] Falha ao injetar cookies: ' + e.message);
    }
  }

  async joinMeeting(meetUrl) {
    logger.info(`[Recorder] Abrindo Meet: ${meetUrl}`);
    await this.page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await this.sleep(7000);

    // Se estiver na tela de login, o Google Meet não deixou passar.
    if (this.page.url().includes('signin') || this.page.url().includes('accounts.google')) {
      logger.warn('[Recorder] ⚠️ Bloqueado na tela de login. Tentando redirecionar para guest...');
      // Tentamos forçar a URL de guest adicionando um parâmetro bobo ou limpando cookies específicos
      await this.page.goto(meetUrl + '?authuser=0', { waitUntil: 'networkidle2' });
      await this.sleep(5000);
    }

    // Tentar digitar nome se for convidado
    try {
      const nameInput = await this.page.$('input[aria-label*="nome"], input[placeholder*="nome"]');
      if (nameInput) {
        logger.info('[Recorder] Modo convidado detectado. Digitando nome...');
        await nameInput.type('Benemax Assistant', { delay: 100 });
        await this.page.keyboard.press('Enter');
        await this.sleep(3000);
      }
    } catch (e) { }

    // Tentar clicar nos botões de participar (Join/Pedir)
    logger.info('[Recorder] Procurando botões de entrada...');
    for (let attempt = 0; attempt < 10; attempt++) {
      const clicked = await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const target = btns.find(b => {
          const t = b.innerText.toLowerCase();
          return t.includes('participar') || t.includes('join') || t.includes('pedir') || t.includes('ask');
        });
        if (target && !target.disabled) {
          target.click();
          return target.innerText;
        }
        return null;
      });

      if (clicked) {
        logger.info(`[Recorder] ✅ Clique em "${clicked}" realizado.`);
        break;
      }

      // Se já vir o botão de desligar, é porque já entrou!
      const isInside = await this.page.$('[aria-label*="Sair"], [aria-label*="Leave"], [aria-label*="hangup"]');
      if (isInside) {
        logger.info('[Recorder] 🎉 Já estamos dentro da sala!');
        return true;
      }

      await this.sleep(3000);
    }

    // Verificação final
    await this.sleep(5000);
    const hangupBtn = await this.page.$('[aria-label*="Sair"], [aria-label*="Leave"], [aria-label*="hangup"]');
    if (hangupBtn) {
      logger.info('[Recorder] 🚀 Bot confirmado dentro da reunião.');
      return true;
    }

    logger.error('[Recorder] ❌ Falha: Bot não conseguiu entrar na sala (botão Sair não encontrado).');
    return false;
  }

  async startRecording(outputPath) {
    logger.info('[Recorder] Iniciando gravação FFmpeg...');
    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse', '-i', 'default',
      '-acodec', 'libopus', outputPath, '-y'
    ]);
  }

  async monitorMeetingUntilEnd() {
    logger.info('[Recorder] Monitorando atividade...');
    let emptyC = 0;
    while (emptyC < 10) {
      try {
        const count = await this.page.evaluate(() => {
          const el = document.querySelector('.uGOf1d');
          return el ? parseInt(el.innerText) : 0;
        });
        if (count <= 1) emptyC++; else emptyC = 0;
        await this.sleep(10000);
      } catch (e) {
        logger.warn('[Recorder] Erro leve no monitoramento: ' + e.message);
        break;
      }
    }
    logger.info('[Recorder] Reunião finalizada.');
  }

  async stopRecording() {
    if (this.recordingProcess) {
      this.recordingProcess.kill('SIGINT');
      logger.info('[Recorder] Gravação parada.');
    }
  }

  async convertToWav(input, output) {
    return new Promise((res) => {
      spawn('ffmpeg', ['-i', input, '-ar', '16000', '-ac', '1', output, '-y']).on('close', res);
    });
  }

  async cleanup() {
    try {
      if (this.browser) await this.browser.close();
    } catch (e) { }
    logger.info('[Recorder] Cleanup finalizado.');
  }
}

module.exports = { MeetRecorder };
