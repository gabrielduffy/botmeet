// src/test-bot.js
// Teste básico das funcionalidades do bot

require('dotenv').config();
const { CalendarMonitor } = require('./services/calendar-monitor');
const { Transcriber } = require('./services/transcriber');
const { WebhookSender } = require('./services/webhook-sender');
const { logger } = require('./utils/logger');

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           🧪 Meeting Bot - Testes de Sistema               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {
    calendar: false,
    whisper: false,
    webhook: false,
  };

  // Teste 1: Google Calendar
  console.log('━'.repeat(60));
  console.log('📅 Teste 1: Google Calendar API\n');
  
  try {
    const calendar = new CalendarMonitor();
    await calendar.initialize();
    
    const meetings = await calendar.getUpcomingMeetings(60);
    console.log(`✅ Conexão OK! Encontradas ${meetings.length} reuniões na próxima hora`);
    
    if (meetings.length > 0) {
      console.log('\nPróximas reuniões:');
      meetings.forEach((m, i) => {
        console.log(`  ${i + 1}. ${m.summary}`);
        console.log(`     Início: ${m.start}`);
        console.log(`     Meet: ${m.meetUrl || 'N/A'}`);
      });
    }
    
    results.calendar = true;
  } catch (error) {
    console.log(`❌ Falhou: ${error.message}`);
  }

  // Teste 2: Whisper
  console.log('\n' + '━'.repeat(60));
  console.log('🎤 Teste 2: Whisper (Transcrição)\n');
  
  try {
    const transcriber = new Transcriber();
    const available = await transcriber.checkWhisper();
    
    if (available) {
      console.log('✅ Whisper disponível');
      console.log(`   Modelo: ${process.env.WHISPER_MODEL || 'small'}`);
      console.log(`   Idioma: ${process.env.WHISPER_LANGUAGE || 'pt'}`);
      results.whisper = true;
    } else {
      console.log('❌ Whisper não encontrado');
      console.log('   Verifique se está instalado em: ' + (process.env.WHISPER_PATH || '/opt/whisper-env/bin/whisper'));
    }
  } catch (error) {
    console.log(`❌ Falhou: ${error.message}`);
  }

  // Teste 3: Webhook
  console.log('\n' + '━'.repeat(60));
  console.log('📤 Teste 3: Webhook (Lovable)\n');
  
  const webhookUrl = process.env.LOVABLE_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('⚠️ LOVABLE_WEBHOOK_URL não configurada');
  } else {
    console.log(`URL: ${webhookUrl}`);
    console.log('(Não enviando dados de teste para não poluir o sistema)');
    console.log('✅ Configuração OK');
    results.webhook = true;
  }

  // Resumo
  console.log('\n' + '━'.repeat(60));
  console.log('📋 RESUMO DOS TESTES\n');
  
  const total = Object.values(results).filter(Boolean).length;
  const passed = Object.entries(results)
    .map(([name, ok]) => `  ${ok ? '✅' : '❌'} ${name}`)
    .join('\n');
  
  console.log(passed);
  console.log(`\nTotal: ${total}/3 testes passaram`);

  if (total === 3) {
    console.log('\n🎉 Todos os testes passaram! Bot pronto para uso.');
  } else {
    console.log('\n⚠️ Alguns testes falharam. Verifique as configurações.');
  }

  console.log('\n');
  process.exit(total === 3 ? 0 : 1);
}

runTests().catch(console.error);
