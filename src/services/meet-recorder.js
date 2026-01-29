// src/services/meet-recorder.js
// CONTROLADOR QUE COMANDA O VEXA (INFRAESTRUTURA PROFISSIONAL)
const axios = require('axios');
const { logger } = require('../utils/logger');

class MeetRecorder {
  constructor() {
    // URL interna do Docker para o api-gateway do Vexa
    this.vexaApiUrl = process.env.VEXA_API_URL || 'http://api-gateway:8000';
    this.adminToken = process.env.ADMIN_API_TOKEN || 'benemax_bot_secure_token_2026';
    this.activeVexaBots = new Map(); // Armazena botId -> meetingId
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Pede ao Vexa para enviar um robô para a reunião
   */
  async joinAndRecord(meetUrl, eventId) {
    try {
      logger.info(`[Vexa-Orchestrator] Solicitando bot para: ${meetUrl}`);

      // A rota descoberta no Gateway é /bots
      const response = await axios.post(`${this.vexaApiUrl}/bots`, {
        platform: "google-meet",
        meeting_url: meetUrl,
        bot_config: {
          bot_name: "Assistente Benemax",
          automatic_leave: {
            waiting_room_timeout: 300000,
            no_one_joined_timeout: 300000,
            everyone_left_timeout: 300000
          }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.adminToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30 segundos de timeout para a API responder
      });

      const botData = response.data;
      logger.info(`[Vexa-Orchestrator] ✅ Bot disparado com sucesso! ID: ${botData.bot_id}`);

      // Armazenamos para controle futuro se necessário
      this.activeVexaBots.set(eventId, botData.bot_id);

      return botData;
    } catch (error) {
      const errorMsg = error.response?.data?.detail || error.message;
      logger.error(`[Vexa-Orchestrator] ❌ Falha ao chamar Vexa: ${errorMsg}`);

      // Se falhar no Vexa, não adianta tentar o antigo, pois o ambiente mudou
      throw new Error(`Vexa Error: ${errorMsg}`);
    }
  }

  async cleanup() {
    // O Vexa gerencia o próprio ciclo de vida dos containers robôs
    logger.info('[Vexa-Orchestrator] Cleanup executado.');
  }

  // Métodos mantidos apenas para compatibilidade de interface se necessário
  async stopAudioRecording() { }
  async cleanupPython() { }
}

module.exports = { MeetRecorder };
