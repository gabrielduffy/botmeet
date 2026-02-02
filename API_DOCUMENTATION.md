# 🤖 BotMeet API - Documentação Oficial

**Base URL:** `https://sortebem-bot.ax5glv.easypanel.host`

---

## 📋 Índice

1. [Autenticação](#autenticação)
2. [Gerenciamento de Bots](#gerenciamento-de-bots)
3. [Controle de Reuniões](#controle-de-reuniões)
4. [Transcrições](#transcrições)
5. [Dashboard Admin](#dashboard-admin)
6. [WebHooks](#webhooks)

---

## 🔐 Autenticação

Todas as rotas (exceto Dashboard Admin) requerem autenticação via **Bearer Token**.

### Header de Autenticação
```http
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 🤖 Gerenciamento de Bots

### 1. Criar/Iniciar Bot em Reunião

**Endpoint:** `POST /bots`

**Descrição:** Inicia um novo bot para entrar em uma reunião e gravar.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "platform": "google_meet",
  "platform_specific_id": "abc-defg-hij",
  "config": {
    "bot_name": "Vexa Recorder",
    "recording_mode": "speaker_view",
    "automatic_leave": {
      "enabled": true,
      "waiting_room_timeout": 600
    }
  }
}
```

**Parâmetros:**
- `platform` (string, obrigatório): Plataforma da reunião
  - Valores: `"google_meet"`, `"zoom"`, `"teams"`
- `platform_specific_id` (string, obrigatório): ID único da reunião na plataforma
- `config` (object, opcional): Configurações do bot
  - `bot_name` (string): Nome exibido do bot
  - `recording_mode` (string): Modo de gravação
  - `automatic_leave` (object): Configurações de saída automática

**Resposta de Sucesso (201):**
```json
{
  "id": 123,
  "user_id": 456,
  "platform": "google_meet",
  "platform_specific_id": "abc-defg-hij",
  "meeting_url": "https://meet.google.com/abc-defg-hij",
  "status": "pending",
  "bot_name": "Vexa Recorder",
  "created_at": "2026-02-02T14:30:00Z",
  "updated_at": "2026-02-02T14:30:00Z"
}
```

---

### 2. Listar Bots/Reuniões do Usuário

**Endpoint:** `GET /bots`

**Descrição:** Lista todas as reuniões/bots do usuário autenticado.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Query Parameters:**
- `status` (string, opcional): Filtrar por status
  - Valores: `pending`, `starting`, `in_meeting`, `recording`, `leaving`, `processing`, `completed`, `failed`
- `platform` (string, opcional): Filtrar por plataforma
- `limit` (int, opcional): Número máximo de resultados (padrão: 50)
- `offset` (int, opcional): Offset para paginação (padrão: 0)

**Exemplo:**
```http
GET /bots?status=in_meeting&limit=10
```

**Resposta de Sucesso (200):**
```json
{
  "total": 25,
  "limit": 10,
  "offset": 0,
  "meetings": [
    {
      "id": 123,
      "platform": "google_meet",
      "status": "in_meeting",
      "meeting_url": "https://meet.google.com/abc-defg-hij",
      "bot_name": "Vexa Recorder",
      "created_at": "2026-02-02T14:00:00Z",
      "updated_at": "2026-02-02T14:15:00Z"
    }
  ]
}
```

---

### 3. Obter Detalhes de um Bot/Reunião

**Endpoint:** `GET /bots/{meeting_id}`

**Descrição:** Retorna informações detalhadas de uma reunião específica.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (200):**
```json
{
  "id": 123,
  "user_id": 456,
  "platform": "google_meet",
  "platform_specific_id": "abc-defg-hij",
  "meeting_url": "https://meet.google.com/abc-defg-hij",
  "status": "recording",
  "bot_name": "Vexa Recorder",
  "container_id": "a1b2c3d4e5f6",
  "started_at": "2026-02-02T14:00:00Z",
  "ended_at": null,
  "created_at": "2026-02-02T13:58:00Z",
  "updated_at": "2026-02-02T14:05:00Z",
  "config": {
    "bot_name": "Vexa Recorder",
    "recording_mode": "speaker_view"
  }
}
```

---

### 4. Atualizar Configuração de Bot

**Endpoint:** `PATCH /bots/{meeting_id}`

**Descrição:** Atualiza configurações de um bot em execução.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
Content-Type: application/json
```

**Body:**
```json
{
  "config": {
    "bot_name": "Novo Nome do Bot",
    "recording_mode": "gallery_view"
  }
}
```

**Resposta de Sucesso (200):**
```json
{
  "id": 123,
  "status": "recording",
  "config": {
    "bot_name": "Novo Nome do Bot",
    "recording_mode": "gallery_view"
  },
  "updated_at": "2026-02-02T14:30:00Z"
}
```

---

### 5. Parar Bot/Sair da Reunião

**Endpoint:** `POST /bots/{meeting_id}/stop`

**Descrição:** Faz o bot sair da reunião e finaliza a gravação.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (200):**
```json
{
  "id": 123,
  "status": "leaving",
  "message": "Bot está saindo da reunião",
  "updated_at": "2026-02-02T14:30:00Z"
}
```

---

### 6. Deletar Bot/Reunião

**Endpoint:** `DELETE /bots/{meeting_id}`

**Descrição:** Remove completamente um bot e seus dados (apenas se não estiver ativo).

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (204):**
```
No Content
```

---

## 📊 Controle de Reuniões

### 7. Obter Status do Bot em Tempo Real

**Endpoint:** `GET /bots/{meeting_id}/status`

**Descrição:** Retorna o status atual do bot via Redis (tempo real).

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (200):**
```json
{
  "meeting_id": 123,
  "status": "recording",
  "is_recording": true,
  "participants_count": 5,
  "duration_seconds": 1800,
  "last_update": "2026-02-02T14:30:00Z"
}
```

---

### 8. Listar Bots Ativos (Containers Rodando)

**Endpoint:** `GET /bots/active`

**Descrição:** Lista todos os containers de bot atualmente em execução.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (200):**
```json
{
  "active_bots": [
    {
      "container_id": "a1b2c3d4e5f6",
      "meeting_id": 123,
      "status": "running",
      "uptime_seconds": 1800,
      "meeting_url": "https://meet.google.com/abc-defg-hij"
    }
  ],
  "total_active": 1
}
```

---

## 📝 Transcrições

### 9. Obter Transcrição de uma Reunião

**Endpoint:** `GET /bots/{meeting_id}/transcription`

**Descrição:** Retorna a transcrição completa de uma reunião finalizada.

**Headers:**
```http
Authorization: Bearer SEU_TOKEN
```

**Resposta de Sucesso (200):**
```json
{
  "meeting_id": 123,
  "transcription": {
    "segments": [
      {
        "speaker": "Participante 1",
        "text": "Olá, bom dia a todos!",
        "timestamp": "00:00:15",
        "confidence": 0.95
      },
      {
        "speaker": "Participante 2",
        "text": "Bom dia! Vamos começar?",
        "timestamp": "00:00:20",
        "confidence": 0.92
      }
    ],
    "full_text": "Olá, bom dia a todos! Bom dia! Vamos começar?...",
    "language": "pt-BR",
    "duration_seconds": 3600
  },
  "created_at": "2026-02-02T15:00:00Z"
}
```

---

## 🎛️ Dashboard Admin

**Nota:** Estas rotas **NÃO** requerem autenticação Bearer. São rotas internas do dashboard.

### 10. Estatísticas do Sistema

**Endpoint:** `GET /api/admin/stats`

**Descrição:** Retorna métricas de uso do sistema (CPU, RAM, Disco).

**Resposta de Sucesso (200):**
```json
{
  "cpu_percent": 15.3,
  "memory": {
    "total": 16777216000,
    "available": 8388608000,
    "percent": 50.0,
    "used": 8388608000
  },
  "disk": {
    "percent": 45.2
  },
  "uptime": 1707235200
}
```

---

### 11. Listar Todos os Containers

**Endpoint:** `GET /api/admin/containers`

**Descrição:** Lista todos os containers Docker relevantes do projeto.

**Resposta de Sucesso (200):**
```json
[
  {
    "id": "a1b2c3d4e5f6",
    "name": "sortebem_bot.1.abcd1234",
    "image": "easypanel/sortebem/bot:latest",
    "status": "Up 2 hours",
    "state": "running"
  },
  {
    "id": "f6e5d4c3b2a1",
    "name": "botmeet-whisperlive-cpu-1",
    "image": "botmeet-whisperlive-cpu",
    "status": "Up 5 hours",
    "state": "running"
  }
]
```

---

### 12. Matar Todos os Bots Ativos

**Endpoint:** `POST /api/admin/kill-bots`

**Descrição:** Para e remove todos os containers de bot em execução.

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "killed": 3
}
```

---

### 13. Reiniciar Serviço

**Endpoint:** `POST /api/admin/restart/{service}`

**Descrição:** Reinicia um serviço específico do sistema.

**Parâmetros de URL:**
- `service` (string): Nome do serviço
  - Valores: `bot-manager`, `whisperlive`, `admin-api`, `api-gateway`

**Exemplo:**
```http
POST /api/admin/restart/whisperlive
```

**Resposta de Sucesso (200):**
```json
{
  "success": true
}
```

---

### 14. Parar Container Específico

**Endpoint:** `POST /api/admin/stop/{container_id}`

**Descrição:** Para um container específico pelo ID.

**Parâmetros de URL:**
- `container_id` (string): ID do container (12 caracteres)

**Exemplo:**
```http
POST /api/admin/stop/a1b2c3d4e5f6
```

**Resposta de Sucesso (200):**
```json
{
  "success": true
}
```

---

### 15. Limpar Containers Parados

**Endpoint:** `POST /api/admin/cleanup`

**Descrição:** Remove todos os containers que estão com status "exited" ou "dead".

**Resposta de Sucesso (200):**
```json
{
  "success": true,
  "removed": 5
}
```

---

## 🔔 WebHooks

### 16. Receber Eventos de Status

**Endpoint:** `POST /webhooks/meeting-status`

**Descrição:** WebHook para receber atualizações de status de reuniões (configurado internamente).

**Body Recebido:**
```json
{
  "event": "meeting.status_changed",
  "meeting_id": 123,
  "old_status": "starting",
  "new_status": "in_meeting",
  "timestamp": "2026-02-02T14:30:00Z",
  "metadata": {
    "container_id": "a1b2c3d4e5f6",
    "participants_count": 5
  }
}
```

---

## 📊 Códigos de Status HTTP

| Código | Significado |
|--------|-------------|
| 200 | Sucesso |
| 201 | Criado com sucesso |
| 204 | Sem conteúdo (deletado) |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito (ex: bot já existe) |
| 500 | Erro interno do servidor |

---

## 🔄 Estados de Reunião (Status)

| Status | Descrição |
|--------|-----------|
| `pending` | Reunião criada, aguardando inicialização |
| `starting` | Bot está iniciando o container |
| `in_meeting` | Bot entrou na reunião |
| `recording` | Gravação ativa |
| `leaving` | Bot está saindo da reunião |
| `processing` | Processando gravação/transcrição |
| `completed` | Reunião finalizada com sucesso |
| `failed` | Falha durante o processo |

---

## 📝 Exemplos de Uso

### Exemplo 1: Iniciar Bot e Monitorar

```bash
# 1. Criar bot
curl -X POST https://sortebem-bot.ax5glv.easypanel.host/bots \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "platform": "google_meet",
    "platform_specific_id": "abc-defg-hij",
    "config": {
      "bot_name": "Vexa Recorder"
    }
  }'

# Resposta: { "id": 123, "status": "pending", ... }

# 2. Verificar status
curl -X GET https://sortebem-bot.ax5glv.easypanel.host/bots/123/status \
  -H "Authorization: Bearer SEU_TOKEN"

# 3. Parar bot quando necessário
curl -X POST https://sortebem-bot.ax5glv.easypanel.host/bots/123/stop \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Exemplo 2: Listar e Filtrar Reuniões

```bash
# Listar apenas reuniões ativas
curl -X GET "https://sortebem-bot.ax5glv.easypanel.host/bots?status=recording&limit=20" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Exemplo 3: Administração via Dashboard

```bash
# Ver estatísticas do sistema
curl -X GET https://sortebem-bot.ax5glv.easypanel.host/api/admin/stats

# Limpar containers mortos
curl -X POST https://sortebem-bot.ax5glv.easypanel.host/api/admin/cleanup
```

---

## 🛡️ Segurança

1. **Tokens de API:** Nunca compartilhe seus tokens. Eles dão acesso total à sua conta.
2. **HTTPS:** Sempre use HTTPS em produção.
3. **Rate Limiting:** A API possui limite de 100 requisições por minuto por token.
4. **Validação:** Todos os inputs são validados. Dados inválidos retornam erro 400.

---

## 📞 Suporte

Para dúvidas ou problemas:
- **Dashboard:** https://sortebem-bot.ax5glv.easypanel.host/
- **Status da API:** Verifique o dashboard admin para métricas em tempo real

---

**Última atualização:** 02 de Fevereiro de 2026
