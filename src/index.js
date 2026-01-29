// src/index.js
// Meeting Bot - Servidor principal

require('dotenv').config();
const express = require('express');
const cron = require('node-cron');
const { logger } = require('./utils/logger');
const { CalendarMonitor } = require('./services/calendar-monitor');
const { MeetRecorder } = require('./services/meet-recorder');
const { Transcriber } = require('./services/transcriber');
const { WebhookSender } = require('./services/webhook-sender');

const app = express();
app.use(express.json());

// Instâncias dos serviços
const calendarMonitor = new CalendarMonitor();
const meetRecorder = new MeetRecorder();
const transcriber = new Transcriber();
const webhookSender = new WebhookSender();

// Estado das reuniões ativas
const activeMeetings = new Map();
const processedMeetings = new Set();

// ═══════════════════════════════════════════════════════════════════
// ROTAS DA API
// ═══════════════════════════════════════════════════════════════════

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeMeetings: activeMeetings.size,
    processedToday: processedMeetings.size,
  });
});

// Status detalhado
app.get('/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeMeetings: Array.from(activeMeetings.keys()),
    processedMeetings: Array.from(processedMeetings),
  });
});

// Logs em tempo real (Painel simples)
app.get('/logs', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const logDir = process.env.LOG_DIR || '/app/logs';
  const logFile = path.join(logDir, 'combined.log');

  if (!fs.existsSync(logFile)) {
    return res.send('<h1>Arquivo de log não encontrado</h1>');
  }

  const logContent = fs.readFileSync(logFile, 'utf8');
  const lines = logContent.split('\n').reverse().slice(0, 100);

  res.send(`
    <html>
      <head>
        <title>Bot Logs</title>
        <meta http-equiv="refresh" content="5">
        <style>
          body { background: #1a1a1a; color: #00ff00; font-family: monospace; padding: 20px; }
          .log-line { margin-bottom: 5px; border-bottom: 1px dashed #333; padding-bottom: 5px; }
          .info { color: #00ff00; }
          .error { color: #ff0000; font-weight: bold; }
          .header { position: sticky; top: 0; background: #333; padding: 10px; margin-bottom: 20px; color: white; display: flex; justify-content: space-between; align-items: center; }
          .badge { background: #007bff; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>🤖 MEETING BOT - LOGS (Últimas 100 linhas)</div>
          <div><span class="badge">Auto-refresh: 5s</span></div>
        </div>
        <div>
          ${lines.map(line => {
    const isError = line.includes('[ERROR]');
    return `<div class="log-line ${isError ? 'error' : 'info'}">${line}</div>`;
  }).join('')}
        </div>
      </body>
    </html>
  `);
});

// Screenshot em tempo real (DEBUG)
app.get('/screenshot', async (req, res) => {
  try {
    if (!meetRecorder || !meetRecorder.page) {
      return res.status(404).send('Browser não iniciado ou página não disponível');
    }
    const screenshot = await meetRecorder.page.screenshot({ type: 'png' });
    res.contentType('image/png');
    res.send(screenshot);
  } catch (error) {
    res.status(500).send('Erro ao capturar screenshot: ' + error.message);
  }
});

// Forçar verificação de calendário
app.post('/check-calendar', async (req, res) => {
  try {
    logger.info('[API] Verificação manual de calendário solicitada');
    await checkUpcomingMeetings();
    res.json({ success: true, message: 'Verificação executada' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Entrar em reunião manualmente (para testes)
app.post('/join-meeting', async (req, res) => {
  const { meetUrl, eventId } = req.body;

  if (!meetUrl) {
    return res.status(400).json({ error: 'meetUrl é obrigatório' });
  }

  try {
    logger.info(`[API] Entrada manual em reunião: ${meetUrl}`);
    const result = await joinAndRecordMeeting(meetUrl, eventId || 'manual');
    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Listar próximas reuniões
app.get('/upcoming', async (req, res) => {
  try {
    const meetings = await calendarMonitor.getUpcomingMeetings(60);
    res.json({ success: true, meetings });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Controle Remoto: Digitar texto no bot (útil para 2FA)
app.get('/type', async (req, res) => {
  const { text } = req.query;
  try {
    if (!meetRecorder || !meetRecorder.page) return res.status(404).send('Bot offline');
    await meetRecorder.page.keyboard.type(text);
    await meetRecorder.page.keyboard.press('Enter');
    res.send(`Texto "${text}" enviado ao bot e Enter pressionado.`);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Controle Remoto: Clicar em coordenadas ou seletores via API
app.get('/click', async (req, res) => {
  const { x, y, selector } = req.query;
  try {
    if (!meetRecorder || !meetRecorder.page) return res.status(404).send('Bot offline');
    if (selector) {
      await meetRecorder.page.click(selector);
      res.send(`Clicou no seletor: ${selector}`);
    } else {
      await meetRecorder.page.mouse.click(parseInt(x), parseInt(y));
      res.send(`Clicou em x:${x}, y:${y}`);
    }
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// ═══════════════════════════════════════════════════════════════════
// LÓGICA PRINCIPAL
// ═══════════════════════════════════════════════════════════════════

/**
 * Verifica reuniões próximas e agenda entrada do bot
 */
async function checkUpcomingMeetings() {
  try {
    logger.info('[Monitor] Verificando reuniões próximas...');

    // Buscar reuniões nos próximos 5 minutos
    const meetings = await calendarMonitor.getUpcomingMeetings(5);

    logger.info(`[Monitor] Encontradas ${meetings.length} reuniões próximas`);

    for (const meeting of meetings) {
      // Pular se já processou ou está ativo
      if (processedMeetings.has(meeting.id) || activeMeetings.has(meeting.id)) {
        continue;
      }

      // Verificar se tem link do Meet
      if (!meeting.meetUrl) {
        logger.warn(`[Monitor] Reunião ${meeting.id} sem link do Meet`);
        continue;
      }

      logger.info(`[Monitor] Agendando entrada: ${meeting.summary}`);
      logger.info(`[Monitor] Link: ${meeting.meetUrl}`);
      logger.info(`[Monitor] Início: ${meeting.start}`);

      // Calcular delay até o início (entrar 30 segundos antes)
      const startTime = new Date(meeting.start).getTime();
      const now = Date.now();
      const delay = Math.max(0, startTime - now - 30000);

      // Agendar entrada
      setTimeout(() => {
        joinAndRecordMeeting(meeting.meetUrl, meeting.id, meeting);
      }, delay);

      activeMeetings.set(meeting.id, {
        ...meeting,
        status: 'scheduled',
        scheduledAt: new Date().toISOString(),
      });

      logger.info(`[Monitor] Entrada agendada em ${Math.round(delay / 1000)}s`);
    }
  } catch (error) {
    logger.error(`[Monitor] Erro ao verificar calendário: ${error.message}`);
  }
}

/**
 * Entra na reunião, grava e transcreve
 */
async function joinAndRecordMeeting(meetUrl, eventId, meetingInfo = {}) {
  logger.info(`[Bot] ════════════════════════════════════════`);
  logger.info(`[Bot] Iniciando gravação: ${meetingInfo.summary || eventId}`);
  logger.info(`[Bot] URL: ${meetUrl}`);
  logger.info(`[Bot] ════════════════════════════════════════`);

  // Atualizar status
  activeMeetings.set(eventId, {
    ...activeMeetings.get(eventId),
    status: 'joining',
    joinedAt: new Date().toISOString(),
  });

  let recordingPath = null;
  let transcription = null;

  try {
    // 1. Entrar e gravar
    logger.info('[Bot] Entrando na reunião...');
    recordingPath = await meetRecorder.joinAndRecord(meetUrl, eventId);

    if (!recordingPath) {
      throw new Error('Gravação falhou - arquivo não gerado');
    }

    logger.info(`[Bot] Gravação salva: ${recordingPath}`);

    // Atualizar status
    activeMeetings.set(eventId, {
      ...activeMeetings.get(eventId),
      status: 'transcribing',
      recordingPath,
    });

    // 2. Transcrever
    logger.info('[Bot] Iniciando transcrição...');
    transcription = await transcriber.transcribe(recordingPath);

    if (!transcription) {
      throw new Error('Transcrição falhou');
    }

    logger.info(`[Bot] Transcrição completa: ${transcription.length} caracteres`);

    // 3. Enviar para webhook
    logger.info('[Bot] Enviando para webhook...');

    const payload = {
      eventId,
      meetUrl,
      summary: meetingInfo.summary || 'Reunião',
      transcricao: transcription,
      duracao: meetRecorder.getLastRecordingDuration(),
      dataHora: meetingInfo.start || new Date().toISOString(),
      processedAt: new Date().toISOString(),
    };

    await webhookSender.send(payload);

    logger.info('[Bot] ✅ Processo completo com sucesso!');

    // Marcar como processado
    processedMeetings.add(eventId);
    activeMeetings.delete(eventId);

    return {
      success: true,
      eventId,
      transcriptionLength: transcription.length,
      duration: meetRecorder.getLastRecordingDuration(),
    };

  } catch (error) {
    logger.error(`[Bot] ❌ Erro: ${error.message}`);

    // Atualizar status com erro
    activeMeetings.set(eventId, {
      ...activeMeetings.get(eventId),
      status: 'error',
      error: error.message,
    });

    // Tentar enviar notificação de erro
    try {
      await webhookSender.sendError({
        eventId,
        meetUrl,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      logger.error(`[Bot] Falha ao enviar notificação de erro: ${e.message}`);
    }

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ═══════════════════════════════════════════════════════════════════

async function start() {
  const PORT = process.env.PORT || 3000;

  logger.info('╔════════════════════════════════════════════════════════════╗');
  logger.info('║           🤖 MEETING BOT - Iniciando...                    ║');
  logger.info('╚════════════════════════════════════════════════════════════╝');

  // Verificar variáveis de ambiente
  const requiredEnvVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REFRESH_TOKEN',
    'BOT_GOOGLE_EMAIL',
    'BOT_GOOGLE_PASSWORD',
    'LOVABLE_WEBHOOK_URL',
  ];

  const missing = requiredEnvVars.filter(v => !process.env[v]);

  if (missing.length > 0) {
    logger.error(`[Init] Variáveis de ambiente faltando: ${missing.join(', ')}`);
    logger.error('[Init] Execute: npm run auth para gerar o GOOGLE_REFRESH_TOKEN');
    process.exit(1);
  }

  // Inicializar serviços
  try {
    await calendarMonitor.initialize();
    logger.info('[Init] ✅ Calendar Monitor inicializado');
  } catch (error) {
    logger.error(`[Init] ❌ Erro ao inicializar Calendar: ${error.message}`);
    process.exit(1);
  }

  // Verificar Whisper
  const whisperOk = await transcriber.checkWhisper();
  if (whisperOk) {
    logger.info('[Init] ✅ Whisper disponível');
  } else {
    logger.warn('[Init] ⚠️ Whisper não encontrado - transcrição pode falhar');
  }

  // Agendar verificação de calendário a cada 2 minutos
  cron.schedule('*/2 * * * *', () => {
    checkUpcomingMeetings();
  });
  logger.info('[Init] ✅ Cron agendado: verificação a cada 2 minutos');

  // Verificação inicial
  await checkUpcomingMeetings();

  // Iniciar servidor
  app.listen(PORT, () => {
    logger.info(`[Init] ✅ Servidor rodando na porta ${PORT}`);
    logger.info('[Init] ════════════════════════════════════════');
    logger.info('[Init] 🤖 Meeting Bot ATIVO e monitorando!');
    logger.info('[Init] ════════════════════════════════════════');
  });
}

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
  logger.error(`[Fatal] Uncaught Exception: ${error.message}`);
  logger.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`[Fatal] Unhandled Rejection: ${reason}`);
});

// Iniciar
start();
