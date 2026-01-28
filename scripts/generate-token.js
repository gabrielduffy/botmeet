// scripts/generate-token.js
// Script para gerar o GOOGLE_REFRESH_TOKEN necessário para o bot

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const open = require('open');
const readline = require('readline');

// Carregar variáveis de ambiente
require('dotenv').config();

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/oauth/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/drive.file',
];

async function generateToken() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║     🔐 Gerador de Refresh Token - Meeting Bot              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error('❌ ERRO: GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET são obrigatórios!');
    console.error('\nConfigure no arquivo .env:');
    console.error('  GOOGLE_CLIENT_ID=seu_client_id');
    console.error('  GOOGLE_CLIENT_SECRET=seu_client_secret');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Gerar URL de autorização
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Forçar exibição do consent para obter refresh_token
  });

  console.log('📋 Instruções:\n');
  console.log('1. Uma janela do navegador vai abrir');
  console.log('2. Faça login com a conta Google do BOT (contato@gnxbrasil.com.br)');
  console.log('3. Autorize as permissões solicitadas');
  console.log('4. Você será redirecionado e o token será gerado automaticamente\n');

  // Criar servidor temporário para receber callback
  const server = http.createServer(async (req, res) => {
    const queryParams = url.parse(req.url, true).query;
    
    if (queryParams.code) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>✅ Autorização concluída!</h1>
            <p>Pode fechar esta janela e voltar ao terminal.</p>
          </body>
        </html>
      `);

      server.close();

      try {
        // Trocar código por tokens
        const { tokens } = await oauth2Client.getToken(queryParams.code);
        
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║                    ✅ TOKEN GERADO!                         ║');
        console.log('╚════════════════════════════════════════════════════════════╝\n');
        
        console.log('Adicione esta variável de ambiente no Easypanel:\n');
        console.log('─'.repeat(60));
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log('─'.repeat(60));
        
        console.log('\n📝 Tokens completos (para referência):\n');
        console.log(JSON.stringify(tokens, null, 2));
        
        console.log('\n✅ Pronto! Agora configure a variável no Easypanel e reinicie o container.\n');
        
        process.exit(0);
        
      } catch (error) {
        console.error('❌ Erro ao obter token:', error.message);
        process.exit(1);
      }
      
    } else if (queryParams.error) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <html>
          <body style="font-family: Arial; text-align: center; padding: 50px;">
            <h1>❌ Erro na autorização</h1>
            <p>${queryParams.error}</p>
          </body>
        </html>
      `);
      
      console.error('❌ Autorização negada:', queryParams.error);
      server.close();
      process.exit(1);
    }
  });

  server.listen(3333, async () => {
    console.log('🌐 Servidor temporário iniciado na porta 3333\n');
    console.log('Abrindo navegador...\n');
    
    // Tentar abrir navegador automaticamente
    try {
      await open(authUrl);
    } catch (e) {
      console.log('⚠️ Não foi possível abrir o navegador automaticamente.');
      console.log('Copie e cole esta URL no navegador:\n');
      console.log(authUrl);
      console.log('\n');
    }
  });
}

// Executar
generateToken().catch(console.error);
