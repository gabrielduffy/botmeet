// src/services/webhook-sender.js
// Envia transcrições para o webhook do Lovable

const axios = require('axios');
const { logger } = require('../utils/logger');

class WebhookSender {
  constructor() {
    this.webhookUrl = process.env.LOVABLE_WEBHOOK_URL;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 segundos entre tentativas
  }

  /**
   * Envia dados para o webhook
   * @param {Object} payload - Dados a serem enviados
   */
  async send(payload) {
    if (!this.webhookUrl) {
      logger.warn('[Webhook] LOVABLE_WEBHOOK_URL não configurada - pulando envio');
      return { success: false, reason: 'URL não configurada' };
    }

    logger.info(`[Webhook] Enviando para: ${this.webhookUrl}`);
    logger.info(`[Webhook] Payload: ${JSON.stringify(payload).slice(0, 200)}...`);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(this.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Bot-Source': 'meeting-bot',
            'X-Bot-Version': '1.0.0',
          },
          timeout: 30000, // 30 segundos timeout
        });

        logger.info(`[Webhook] ✅ Enviado com sucesso! Status: ${response.status}`);
        
        return {
          success: true,
          status: response.status,
          data: response.data,
        };

      } catch (error) {
        const errorMessage = error.response?.data?.message || error.message;
        logger.error(`[Webhook] ❌ Tentativa ${attempt}/${this.maxRetries} falhou: ${errorMessage}`);

        if (attempt < this.maxRetries) {
          logger.info(`[Webhook] Aguardando ${this.retryDelay / 1000}s antes de tentar novamente...`);
          await this.sleep(this.retryDelay);
        } else {
          logger.error('[Webhook] Todas as tentativas falharam');
          
          // Salvar payload localmente para não perder dados
          await this.saveFailedPayload(payload);
          
          return {
            success: false,
            error: errorMessage,
            savedLocally: true,
          };
        }
      }
    }
  }

  /**
   * Envia notificação de erro
   */
  async sendError(errorPayload) {
    const errorWebhookUrl = process.env.LOVABLE_ERROR_WEBHOOK_URL || this.webhookUrl;
    
    if (!errorWebhookUrl) {
      logger.warn('[Webhook] URL de erro não configurada');
      return;
    }

    try {
      await axios.post(errorWebhookUrl, {
        type: 'error',
        ...errorPayload,
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Bot-Source': 'meeting-bot',
        },
        timeout: 10000,
      });

      logger.info('[Webhook] Notificação de erro enviada');
    } catch (error) {
      logger.error(`[Webhook] Falha ao enviar notificação de erro: ${error.message}`);
    }
  }

  /**
   * Salva payload que falhou localmente
   */
  async saveFailedPayload(payload) {
    const fs = require('fs');
    const path = require('path');
    
    const failedDir = '/app/failed-webhooks';
    
    if (!fs.existsSync(failedDir)) {
      fs.mkdirSync(failedDir, { recursive: true });
    }

    const filename = `failed-${Date.now()}.json`;
    const filepath = path.join(failedDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(payload, null, 2));
    logger.info(`[Webhook] Payload salvo localmente: ${filepath}`);
  }

  /**
   * Reenvia webhooks que falharam anteriormente
   */
  async retryFailedWebhooks() {
    const fs = require('fs');
    const path = require('path');
    
    const failedDir = '/app/failed-webhooks';
    
    if (!fs.existsSync(failedDir)) {
      return { processed: 0, success: 0, failed: 0 };
    }

    const files = fs.readdirSync(failedDir).filter(f => f.endsWith('.json'));
    let success = 0;
    let failed = 0;

    for (const file of files) {
      const filepath = path.join(failedDir, file);
      
      try {
        const payload = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
        const result = await this.send(payload);
        
        if (result.success) {
          fs.unlinkSync(filepath);
          success++;
        } else {
          failed++;
        }
      } catch (error) {
        logger.error(`[Webhook] Erro ao processar ${file}: ${error.message}`);
        failed++;
      }
    }

    logger.info(`[Webhook] Retry concluído: ${success} sucesso, ${failed} falhas`);
    
    return { processed: files.length, success, failed };
  }

  /**
   * Helper para sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { WebhookSender };
