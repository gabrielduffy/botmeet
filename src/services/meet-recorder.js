// src/services/meet-recorder.js
// CONTROLADOR NODE QUE DISPARA O MOTOR PYTHON (EVASÃO)
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { logger } = require('../utils/logger');

class MeetRecorder {
  constructor() {
    this.pythonProcess = null;
    this.recordingProcess = null;
    this.recordingsDir = process.env.RECORDINGS_DIR || '/app/recordings';
    this.whisperPath = process.env.WHISPER_PATH || '/opt/whisper-env/bin/whisper';
    this.pythonEnvPath = process.env.PYTHON_BOT_PATH || '/opt/whisper-env/bin/python3';

    if (!fs.existsSync(this.recordingsDir)) fs.mkdirSync(this.recordingsDir, { recursive: true });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async joinAndRecord(meetUrl, eventId) {
    const timestamp = Date.now();
    const outputPath = path.join(this.recordingsDir, `${eventId}-${timestamp}.webm`);
    const audioPath = path.join(this.recordingsDir, `${eventId}-${timestamp}.wav`);

    try {
      logger.info(`[Recorder] 🚀 Iniciando motor Python: ${meetUrl}`);

      const scriptPath = path.join(__dirname, 'recorder.py');

      // Disparar o script Python
      this.pythonProcess = spawn(this.pythonEnvPath, [
        scriptPath,
        meetUrl,
        eventId
      ], {
        env: {
          ...process.env,
          DISPLAY: ':99',
          PYTHONUNBUFFERED: '1' // Garante logs em tempo real
        }
      });

      // Handlers de Log
      this.pythonProcess.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) logger.info(`[Python] ${line.trim()}`);
        });
      });

      this.pythonProcess.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        lines.forEach(line => {
          if (line.trim()) logger.error(`[Python-Error] ${line.trim()}`);
        });
      });

      this.pythonProcess.on('error', (err) => {
        logger.error(`[Recorder] ❌ Falha ao iniciar spawn do Python: ${err.message}`);
      });

      this.pythonProcess.on('close', (code) => {
        logger.info(`[Recorder] Processo Python finalizado (code ${code})`);
      });

      // Aguardar o bot entrar e estabilizar
      logger.info('[Recorder] Aguardando estabilização do navegador...');
      await this.sleep(20000);

      // Iniciar a gravação de áudio via FFmpeg
      logger.info('[Recorder] Iniciando captura de áudio FFmpeg...');
      this.startAudioRecording(outputPath);

      // Aguardar o fim da reunião ou timeout
      await this.monitorMeeting();

      // Limpeza
      await this.stopAudioRecording();
      await this.cleanupPython();

      // Converter para WAV para o Whisper
      await this.convertToWav(outputPath, audioPath);

      return audioPath;
    } catch (error) {
      logger.error(`[Recorder] ❌ Crash no fluxo: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  startAudioRecording(outputPath) {
    // Usamos pulse para capturar o áudio que o Chrome está "tocando" no sink virtual
    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse',
      '-i', 'default', // Pulseaudio configurado no entrypoint
      '-acodec', 'libopus',
      '-y', outputPath
    ]);

    this.recordingProcess.stderr.on('data', (data) => {
      // ffmpeg envia progresso para stderr
    });
  }

  async monitorMeeting() {
    // Basicamente esperamos o processo Python fechar ou um tempo máximo
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.pythonProcess || this.pythonProcess.killed) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 5000);

      // Timeout de segurança de 2 horas
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 2 * 60 * 60 * 1000);
    });
  }

  async stopAudioRecording() {
    if (this.recordingProcess) {
      this.recordingProcess.kill('SIGINT');
      await this.sleep(2000);
    }
  }

  async cleanupPython() {
    if (this.pythonProcess) {
      this.pythonProcess.kill('SIGKILL');
      this.pythonProcess = null;
    }
  }

  async cleanup() {
    await this.stopAudioRecording();
    await this.cleanupPython();
  }

  getLastRecordingDuration() {
    return "Calculado via metadados FFmpeg";
  }

  async convertToWav(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      if (!fs.existsSync(inputPath)) {
        return reject(new Error(`Input file not found: ${inputPath}`));
      }

      const ffmpeg = spawn('ffmpeg', ['-i', inputPath, '-ar', '16000', '-ac', '1', '-y', outputPath]);
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve(outputPath);
        else reject(new Error(`FFmpeg convert failed code ${code}`));
      });
    });
  }
}

module.exports = { MeetRecorder };
