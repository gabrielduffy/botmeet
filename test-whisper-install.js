const { Transcriber } = require('./src/services/transcriber');
const { logger } = require('./src/utils/logger');
require('dotenv').config();

async function test() {
  const transcriber = new Transcriber();
  
  logger.info('Iniciando teste de sanidade do Whisper...');
  
  const isAvailable = await transcriber.checkWhisper();
  if (isAvailable) {
    logger.info('✅ Whisper está instalado e acessível!');
  } else {
    logger.error('❌ Whisper NÃO foi encontrado no caminho: ' + transcriber.whisperPath);
    logger.info('Dica: Verifique se o Docker terminou de construir a imagem corretamente.');
  }
}

test();
