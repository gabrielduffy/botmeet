// src/test-bot.js
// Teste de validação para o novo Orquestrador Vexa
require('dotenv').config();
const { CalendarMonitor } = require('./services/calendar-monitor');
const { MeetRecorder } = require('./services/meet-recorder');
const { logger } = require('./utils/logger');
const axios = require('axios');

async function runTests() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           🧪 Benemax Bot - Validação de Sistema           ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const results = {
    google_calendar: false,
    vexa_config: false,
    environment: false
  };

  // 1. Testar Variáveis de Ambiente
  console.log('━'.repeat(60));
  console.log('📦 Teste 1: Variáveis de Ambiente\n');
  const required = [
    'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN',
    'DB_HOST', 'REDIS_HOST', 'ADMIN_API_TOKEN'
  ];

  let envOk = true;
  required.forEach(v => {
    if (process.env[v]) {
      console.log(`✅ ${v} está configurada`);
    } else {
      console.log(`❌ ${v} está FALTANDO`);
      envOk = false;
    }
  });
  results.environment = envOk;

  // 2. Testar Google Calendar
  console.log('\n' + '━'.repeat(60));
  console.log('📅 Teste 2: Google Calendar API\n');

  try {
    const calendar = new CalendarMonitor();
    await calendar.initialize();

    const meetings = await calendar.getUpcomingMeetings(1440); // Próximas 24h
    console.log(`✅ Sucesso! Conectado ao Google Calendar.`);
    console.log(`   Eventos encontrados nas próximas 24h: ${meetings.length}`);

    results.google_calendar = true;
  } catch (error) {
    console.log(`❌ Falha no Calendar: ${error.message}`);
  }

  // 3. Testar Configuração Vexa (Sem disparar robô real)
  console.log('\n' + '━'.repeat(60));
  console.log('📡 Teste 3: Configuração do Orquestrador Vexa\n');

  try {
    const recorder = new MeetRecorder();
    console.log(`   URL Alvo: ${recorder.vexaApiUrl}`);
    console.log(`   Token: ${recorder.adminToken.substring(0, 5)}...`);

    // Testamos se a URL é válida
    if (recorder.vexaApiUrl.includes('api-gateway') || recorder.vexaApiUrl.includes('localhost')) {
      console.log('✅ Endpoint do Vexa configurado corretamente.');
      results.vexa_config = true;
    } else {
      console.log('❌ Endpoint do Vexa parece incorreto.');
    }
  } catch (error) {
    console.log(`❌ Erro na config: ${error.message}`);
  }

  // Resumo
  console.log('\n' + '━'.repeat(60));
  console.log('📋 RESUMO DA VALIDAÇÃO\n');

  const total = Object.values(results).filter(Boolean).length;
  Object.entries(results).forEach(([name, ok]) => {
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
  });

  console.log(`\nStatus: ${total}/3 testes de configuração passaram.`);

  if (results.google_calendar && results.environment) {
    console.log('\n🚀 TUDO PRONTO! Pode subir para o Easypanel com confiança.');
    console.log('   O Vexa só responderá "OK" após o deploy completo lá.\n');
  } else {
    console.log('\n⚠️ Corrija os erros acima antes de tentar o deploy.\n');
  }

  process.exit(results.google_calendar && results.environment ? 0 : 1);
}

runTests().catch(e => {
  console.error('❌ Erro Fatal no teste:', e);
  process.exit(1);
});
