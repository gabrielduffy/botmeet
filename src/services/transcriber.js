// src/services/transcriber.js
// Transcreve áudio usando Whisper local

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { logger } = require('../utils/logger');

class Transcriber {
  constructor() {
    this.whisperPath = process.env.WHISPER_PATH || '/opt/whisper-env/bin/whisper';
    this.model = process.env.WHISPER_MODEL || 'base'; // tiny, base, small, medium, large
    this.language = process.env.WHISPER_LANGUAGE || 'pt'; // português
    this.transcriptionsDir = process.env.TRANSCRIPTIONS_DIR || '/app/transcriptions';

    // Garantir que diretório existe
    if (!fs.existsSync(this.transcriptionsDir)) {
      fs.mkdirSync(this.transcriptionsDir, { recursive: true });
    }
  }

  /**
   * Verifica se Whisper está disponível
   */
  async checkWhisper() {
    return new Promise((resolve) => {
      const check = spawn(this.whisperPath, ['--help']);

      check.on('close', (code) => {
        resolve(code === 0);
      });

      check.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Transcreve arquivo de áudio usando Groq API
   * @param {string} audioPath - Caminho do arquivo de áudio
   * @returns {string} Texto transcrito
   */
  async transcribe(audioPath) {
    logger.info(`[Transcriber] Iniciando transcrição com Groq API: ${audioPath}`);

    // Verificar se arquivo existe
    if (!fs.existsSync(audioPath)) {
      throw new Error(`Arquivo de áudio não encontrado: ${audioPath}`);
    }

    // Verificar tamanho do arquivo
    const stats = fs.statSync(audioPath);
    const sizeMB = stats.size / (1024 * 1024);
    logger.info(`[Transcriber] Tamanho do arquivo: ${sizeMB.toFixed(2)} MB`);

    if (sizeMB < 0.01) {
      throw new Error('Arquivo de áudio muito pequeno ou vazio');
    }

    // Groq tem limite de 25MB
    if (sizeMB > 25) {
      throw new Error('Arquivo de áudio muito grande para Groq API (máximo 25MB)');
    }

    try {
      const transcript = await this.transcribeWithGroq(audioPath);

      // Limpar arquivo de áudio após transcrição
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        logger.info(`[Transcriber] Removido: ${audioPath}`);
      }

      return transcript;
    } catch (error) {
      logger.error(`[Transcriber] Erro na transcrição: ${error.message}`);
      throw error;
    }
  }

  /**
   * Limpa arquivos temporários após transcrição
   */
  cleanupFiles(audioPath, outputDir, baseName) {
    try {
      // Remover arquivo de áudio original
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        logger.info(`[Transcriber] Removido: ${audioPath}`);
      }

      // Remover arquivos auxiliares do Whisper (json, srt, vtt, etc)
      const extensions = ['.json', '.srt', '.vtt', '.tsv'];
      for (const ext of extensions) {
        const filePath = path.join(outputDir, `${baseName}${ext}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
    } catch (error) {
      logger.warn(`[Transcriber] Erro ao limpar arquivos: ${error.message}`);
    }
  }

  /**
   * Transcreve usando API do Groq (alternativa/fallback)
   * Pode ser usado se Whisper local não funcionar
   */
  async transcribeWithGroq(audioPath) {
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!groqApiKey) {
      throw new Error('GROQ_API_KEY não configurada');
    }

    logger.info('[Transcriber] Usando Groq para transcrição...');

    // Groq usa Whisper large-v3 via API
    const FormData = require('form-data');
    const axios = require('axios');

    const form = new FormData();
    form.append('file', fs.createReadStream(audioPath));
    form.append('model', 'whisper-large-v3');
    form.append('language', 'pt');
    form.append('response_format', 'text');

    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        form,
        {
          headers: {
            ...form.getHeaders(),
            'Authorization': `Bearer ${groqApiKey}`,
          },
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );

      return response.data;
    } catch (error) {
      logger.error(`[Transcriber] Erro no Groq: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { Transcriber };
