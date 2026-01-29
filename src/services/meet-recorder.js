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
      await this.applyCookies();

      const joined = await this.joinMeeting(meetUrl);
      if (!joined) throw new Error('Falha ao entrar na sala do Meet.');

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
    logger.info('[Recorder] Iniciando Browser...');
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
    const context = this.browser.defaultBrowserContext();
    await context.overridePermissions('https://meet.google.com', ['microphone', 'camera']);
  }

  async applyCookies() {
    logger.info('[Recorder] Aplicando cookies de segurança...');
    const cookies = [
      { "domain": ".google.com", "name": "SAPISID", "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "__Secure-3PAPISID", "value": "N_AhWA2wQ_Y7Fhgz/AJoSDbIeheiXJJ1F3", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "AEC", "value": "AaJma5ucTT0xwFmyg4Nxhc2dPNrTYYjYBoPiZtbGfrZiIxSMgfJAu-iniUQ", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "NID", "value": "528=jOcAayjs-H3LorgCEGgwjSy9HVbpDTP3TEXsoJn8f5BKrpVrhC08Tt2U6cJYOtPZ4AFGnXz75AyjizLpAgoDvkPm6oVcEDggwijOmlRvMxBq7XhoINL_zyBRr_El6au9pQmCWQSChYHmIJS7WCbMsE67f8PvoITh0wKp_QUrCSediJvnZmM9DRyk2NiDXN0dZU38BAJNNnzyHxhyUsxO5dEXNs8ArTgqkoYo4X-Co1omvNqCxJUxv-MQi6VYrR8P1DUMObmnXDco-0DMwoQtRQHxFj-kq4LCZ5-WsPGNRwNgd7TjF8b46jDkR2FL0D5KWJ1mxAb3G-WOqRsYwVwKR6mViKoLA3t7deq_b-5r5DocDm8mO-PZu4sr0dfXAMP3qdy2tBksfWxAiprM3eb5T73RHFXuvCEZFVGmV_iJJo8QaNISiHcYnxc_IB0Ra8rStcEE-UGuIuChA4dmTub2_ekfbpJetGzwrYdITnST1CCnujHWwZI13XGdPJPaukuPzcJkzKhA7w6elBFkCshed0yX5GOlBUpWN_3t5nW9itBR4adBO5AkEVDUwiHRNLD6wKerZqiQP0ytNUg_BctJ4ov3do3kF6G8Dp8UEiwQz36fLnTAdG6Xc1rJhdo5Li5fgBVesr56Wfc21xy_ZpSJ7DLXrasRKdGmtHnCXR5H7K5YWrlpGDNyFbNHjyaJCWA9JIhwZbbyRH6Ql0HKoXk0AydXkxXPc8b1tFSCf3QIIrULRfaMz_ZgS0r98m-TFdnNCYzHZ0nopn_Z5Pau5DwedO19gytCTIb0V-0XqqWkha3j1aLLj3Hqyd2rNkxk5Gg8FK38GWy-d06PxNfjNz0-fDvvfK1tJ6Rp4hCMwWZUfW6JEisMyaMZ5ForXmRupr4t8Duv6w0eLi3pu16H0bAofASsN0CIQ-Yhr6oF28ZJaW1EiseLRMnk-hSk_J7IexNRzL2pIxZFrEM7CQ1bMolwGJBQHyZHVC6iMhEwCURCXDjhLBeaX7ny_YUtXnKK0LZB9IeN9mTAQPSFdLflpVNO20DCMojl2MOpS5NxWcv361imN5wSX3e2rpZlIjgU4qB9IYc87sLRd4MeHxbOw7zkTI_7YJ4jOcv5ugsuKVAI2jECoAlHH2DVA6jaeDg4YwjUMubayQLZHrSBDZAcVKYLf8JpZKneZKDJDfnvCFFFSgHN715yCw3tmJeYwUr1CgIpHJpHbX8d4sXFXvmge1h8KqP1jl8QHyGN373Ipd6pBsQixs2ZJK8stIiZOzE1agKsfHgtC2MiS7RtdTNYVC4FSZSopzmNrbwnr4t86jtc3Fg2KoumVF_YQ7F5wo8p-LgLUvaLc0v3WqRd_dO8wVEwdmj44axYjMCcfwMgK8iKIxgb1AqX0Y2n-W4Yh0eWYTKddpRJdslTus4Xclexk9txCDIdTskqF3eNGF15twdwC7KxIvIcU5hYFJTZZ3ZleB0l62RAM1Kn3Z9NGrJSPnQryWh6uwMA-v1O8pBGEvVIW3wG_ABFRA-UcZVI180-xGkdj1PrR2rHenbtmiDv_ZXD-8H2NShuFNR85PAftKjZaV9tKk4Y8R8DazYPGQnzkYxbRCDhjdMMaMrVaXQQ3_objzgigfcig90A0Gxgk07nRXWlagkpZfzv4QAYClvocEi_hUr2bqjU7SXZTHjbhHvSYgdjYPOBsyflKBJ4pbYbhCv3ETUHIeBvDsFIkwS_jvWtPrndsQHykdyxAL0vu1Y7zBMVimBCXDgxXCN_3WQWu6W3MKJMpAmrVd_uApkuoxtDpckOWo3azzWVh442IuJ0a6Xe14VcfXN1dEqYzNjtUBOuV45bX_yA0N7Uj8vpWWzWz" },
      { "domain": ".google.com", "name": "__Secure-1PSIDTS", "value": "sidts-CjEB7I_69KXMNNh7z_L0bxMgyLTg92jhv6sEDQO49L4rsJ5op85xaYS40Vnsf1dLw-5XEAA", "path": "/", "secure": true },
      { "domain": ".google.com", "name": "__Secure-1PSID", "value": "g.a0006AgzkxcQw3DwwEKThr_jS830Vu0oWyO3NYnTkFwC-iQQTt83r6uPcGrzFo_ZwmuGWRx7nAACgYKAVMSARQSFQHGX2MiOm-b5X-hLzuYaBuBtHomQxoVAUF8yKo3Hptnb0-bCEUBvBitSbvI0076", "path": "/", "secure": true }
    ];
    await this.page.setCookie(...cookies);
  }

  async joinMeeting(meetUrl) {
    logger.info(`[Recorder] Acessando Meet: ${meetUrl}`);
    await this.page.goto(meetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await this.sleep(7000);

    // Tentativa de entrada forçada por Poll (15 tentativas)
    for (let i = 0; i < 15; i++) {
      // Verificar se já estamos dentro (pelo botão de hangup)
      const inside = await this.page.evaluate(() => {
        return !!document.querySelector('[aria-label*="Sair"], [aria-label*="Leave"], [aria-label*="encerrar"]');
      });
      if (inside) {
        logger.info('[Recorder] ✅ Confirmado: Bot dentro da sala!');
        return true;
      }

      // Tentar clicar em qualquer botão que pareça ser de entrada
      await this.page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
        const target = btns.find(b => {
          const text = b.innerText.toLowerCase();
          return text.includes('participar') || text.includes('join') || text.includes('pedir') || text.includes('ask');
        });
        if (target && !target.disabled) target.click();
      });

      await this.sleep(2000);
    }
    return false;
  }

  async startRecording(outputPath) {
    logger.info('[Recorder] Iniciando FFmpeg...');
    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse', '-i', 'default',
      '-acodec', 'libopus', outputPath, '-y'
    ]);
  }

  async monitorMeetingUntilEnd() {
    let empty = 0;
    while (empty < 5) {
      const count = await this.page.evaluate(() => {
        const el = document.querySelector('.uGOf1d');
        return el ? parseInt(el.innerText) : 0;
      });
      if (count <= 1) empty++; else empty = 0;
      await this.sleep(10000);
    }
    logger.info('[Recorder] Fim da reunião.');
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
