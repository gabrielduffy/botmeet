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
    this.pythonEnvPath = '/opt/whisper-env/bin/python3'; // Onde instalamos o UC

    if (!fs.existsSync(this.recordingsDir)) fs.mkdirSync(this.recordingsDir, { recursive: true });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async joinAndRecord(meetUrl, eventId) {
    const outputPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.webm`);
    const audioPath = path.join(this.recordingsDir, `${eventId}-${Date.now()}.wav`);

    try {
      logger.info(`[Recorder] 🚀 Iniciando motor de evasão Python para: ${meetUrl}`);

      // 1. Disparar o script Python (Undetected ChromeDriver)
      this.pythonProcess = spawn(this.pythonEnvPath, [
        path.join(__dirname, 'recorder.py'),
        meetUrl,
        eventId
      ], {
        env: { ...process.env, DISPLAY: ':99' }
      });

      this.pythonProcess.stdout.on('data', (data) => {
        logger.info(`[Python] ${data.toString().trim()}`);
      });

      this.pythonProcess.stderr.on('data', (data) => {
        logger.error(`[Python-Error] ${data.toString().trim()}`);
      });

      // Dar tempo para o Python entrar na sala
      await this.sleep(15000);

      // 2. Iniciar a gravação do áudio via FFmpeg (PulseAudio)
      logger.info('[Recorder] Iniciando gravação de áudio...');
      this.startRecording(outputPath);

      // 3. Monitorar a reunião (aqui você pode implementar lógica para ver se acabou)
      await this.monitorMeetingUntilEnd();

      // 4. Finalizar tudo
      await this.stopRecording();
      await this.stopPython();
      await this.convertToWav(outputPath, audioPath);

      return audioPath;
    } catch (error) {
      logger.error(`[Recorder] ❌ Crash no processo: ${error.message}`);
      await this.cleanup();
      throw error;
    }
  }

  startRecording(outputPath) {
    this.recordingProcess = spawn('ffmpeg', [
      '-f', 'pulse', '-i', 'default',
      '-acodec', 'libopus', outputPath, '-y'
    ]);
  }

  async monitorMeetingUntilEnd() {
    // Monitoramento simples por tempo ou por saída do processo python
    // Por enquanto, vamos deixar o bot gravando por 10 minutos ou até o processo morrer
    return new Promise((resolve) => {
      let timeout = setTimeout(resolve, 600000); // 10 min de teste
      this.pythonProcess.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  async stopPython() {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }

  async stopRecording() {
    if (this.recordingProcess) {
      this.recordingProcess.kill('SIGINT');
      this.recordingProcess = null;
    }
  }

  async convertToWav(inputPath, audioPath) {
    return new Promise((res) => {
      spawn('ffmpeg', ['-i', inputPath, '-ar', '16000', '-ac', '1', audioPath, '-y']).on('close', res);
    });
  }

  async cleanup() {
    await this.stopRecording();
    await this.stopPython();
  }

  getLastRecordingDuration() { return 0; } // Placeholder
}

module.exports = { MeetRecorder };
