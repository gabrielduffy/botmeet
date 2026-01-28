# 🤖 Meeting Bot

Bot automático para gravar e transcrever reuniões do Google Meet.

## 📋 Funcionalidades

- ✅ Monitora Google Calendar automaticamente
- ✅ Entra nas reuniões do Google Meet sozinho
- ✅ Grava o áudio da reunião
- ✅ Transcreve usando Whisper (local, $0)
- ✅ Envia transcrição via webhook

## 🏗️ Arquitetura

```
Google Calendar (eventos com Meet)
         │
         ▼
    Bot monitora a cada 2 min
         │
         ▼
    Reunião em 2 min? → Bot entra automaticamente
         │
         ▼
    Grava áudio (FFmpeg + PulseAudio)
         │
         ▼
    Reunião termina (detecta automaticamente)
         │
         ▼
    Whisper transcreve (local)
         │
         ▼
    Webhook envia para Lovable
```

## 🚀 Instalação

### 1. Clone o repositório

```bash
git clone https://github.com/gabrielduffy/botmeet.git
cd botmeet
```

### 2. Configure as variáveis de ambiente

No **Easypanel**, adicione estas variáveis:

| Variável | Valor |
|----------|-------|
| `GOOGLE_CLIENT_ID` | `1027982944677-332cladvsutpk4jk9jdjuis0kd53is22.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |
| `GOOGLE_REFRESH_TOKEN` | *(gerar - veja abaixo)* |
| `BOT_GOOGLE_EMAIL` | `contato@gnxbrasil.com.br` |
| `BOT_GOOGLE_PASSWORD` | `412trocar` |
| `LOVABLE_WEBHOOK_URL` | `https://seu-lovable.com/api/webhook/transcricao` |
| `WHISPER_MODEL` | `small` |
| `WHISPER_LANGUAGE` | `pt` |

### 3. Gerar o GOOGLE_REFRESH_TOKEN

O refresh token permite o bot acessar o Calendar sem precisar de login manual.

**Opção A: Localmente (recomendado)**

```bash
# Instalar dependências
npm install

# Criar arquivo .env com CLIENT_ID e CLIENT_SECRET
cp .env.example .env
# Edite o .env com os valores

# Gerar token
npm run auth
```

**Opção B: Manualmente**

1. Acesse: https://developers.google.com/oauthplayground/
2. Configure (engrenagem) → Use your own OAuth credentials
3. Cole Client ID e Client Secret
4. Selecione os scopes:
   - `https://www.googleapis.com/auth/calendar`
   - `https://www.googleapis.com/auth/calendar.events`
5. Clique "Authorize APIs"
6. Faça login com a conta do bot
7. Clique "Exchange authorization code for tokens"
8. Copie o `refresh_token`

### 4. Deploy no Easypanel

1. Conecte o repositório GitHub
2. Configure as variáveis de ambiente
3. Deploy!

## 📡 API Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/health` | GET | Status do bot |
| `/status` | GET | Status detalhado |
| `/upcoming` | GET | Próximas reuniões |
| `/check-calendar` | POST | Forçar verificação |
| `/join-meeting` | POST | Entrar em reunião manualmente |

### Exemplos

```bash
# Verificar saúde
curl http://localhost:3000/health

# Ver próximas reuniões
curl http://localhost:3000/upcoming

# Entrar manualmente em uma reunião
curl -X POST http://localhost:3000/join-meeting \
  -H "Content-Type: application/json" \
  -d '{"meetUrl": "https://meet.google.com/xxx-yyyy-zzz"}'
```

## 📤 Formato do Webhook

O bot envia para seu webhook:

```json
{
  "eventId": "abc123",
  "meetUrl": "https://meet.google.com/xxx-yyyy-zzz",
  "summary": "Reunião com Cliente",
  "transcricao": "Texto completo da transcrição...",
  "duracao": 1847,
  "dataHora": "2026-01-28T15:00:00Z",
  "processedAt": "2026-01-28T15:35:00Z"
}
```

## ⚙️ Configuração do Whisper

| Modelo | RAM | Velocidade | Qualidade |
|--------|-----|------------|-----------|
| `tiny` | 1GB | 32x | ⭐⭐ |
| `base` | 1GB | 16x | ⭐⭐⭐ |
| `small` | 2GB | 6x | ⭐⭐⭐⭐ |
| `medium` | 5GB | 2x | ⭐⭐⭐⭐⭐ |

Recomendado: `small` para equilíbrio entre velocidade e qualidade.

## 🔧 Troubleshooting

### Bot não entra na reunião

1. Verifique se a conta do bot tem acesso ao Meet
2. Verifique se o link do Meet está correto no Calendar
3. Olhe os logs: `docker logs <container>`

### Transcrição falha

1. Verifique se o Whisper está instalado: `whisper --help`
2. Verifique espaço em disco
3. Tente modelo menor (`tiny` ou `base`)

### Webhook não recebe dados

1. Verifique a URL do webhook
2. Veja os logs de erro
3. Verifique `/app/failed-webhooks` para payloads salvos

## 📁 Estrutura do Projeto

```
botmeet/
├── Dockerfile
├── docker-entrypoint.sh
├── package.json
├── .env.example
├── src/
│   ├── index.js              # Servidor principal
│   ├── services/
│   │   ├── calendar-monitor.js   # Monitora Calendar
│   │   ├── meet-recorder.js      # Entra e grava Meet
│   │   ├── transcriber.js        # Transcreve com Whisper
│   │   └── webhook-sender.js     # Envia para Lovable
│   └── utils/
│       └── logger.js
└── scripts/
    └── generate-token.js     # Gera refresh token
```

## 📄 Licença

MIT

## 🆘 Suporte

Problemas? Abra uma issue no GitHub.
