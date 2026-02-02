"""
Tokens page HTML content
Separated to keep main.py clean
"""

TOKENS_PAGE_HTML = """<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BotMeet | API Tokens</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #8b5cf6;
            --primary-dark: #6d28d9;
            --bg: #050505;
            --card-bg: rgba(18, 18, 22, 0.7);
            --border: rgba(139, 92, 246, 0.2);
            --text: #ffffff;
            --text-muted: #94a3b8;
            --danger: #ef4444;
            --success: #10b981;
            --warning: #f59e0b;
            --radius: 12px;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            background: var(--bg); 
            color: var(--text); 
            font-family: 'Poppins', sans-serif; 
            line-height: 1.5; 
            -webkit-font-smoothing: antialiased;
            background-image: 
                radial-gradient(circle at 0% 0%, rgba(109, 40, 149, 0.15) 0%, transparent 40%),
                radial-gradient(circle at 100% 100%, rgba(76, 29, 149, 0.1) 0%, transparent 40%);
            background-attachment: fixed;
        }

        .container { max-width: 1000px; margin: 0 auto; padding: 2rem 1.5rem; }

        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 1rem; }
        .brand { display: flex; align-items: center; gap: 0.75rem; }
        .brand .icon { width: 12px; height: 12px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 15px var(--primary); animation: pulse 2s infinite; }
        .brand h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }

        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }

        .btn { display: inline-flex; align-items: center; justify-content: center; padding: 0.6rem 1.2rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; border: none; transition: all 0.2s; gap: 0.5rem; font-family: inherit; text-decoration: none; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn-outline:hover { background: rgba(255,255,255,0.05); border-color: var(--primary); }
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-danger:hover { background: var(--danger); color: white; }
        .btn-sm { padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 6px; }

        .section { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; backdrop-filter: blur(10px); margin-bottom: 2rem; }
        .section h2 { font-size: 1.25rem; margin-bottom: 1.5rem; }
        .section p { color: var(--text-muted); margin-bottom: 1.5rem; }

        .token-list { display: flex; flex-direction: column; gap: 1rem; }
        .token-item { background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
        .token-info { flex: 1; }
        .token-preview { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--primary); margin-bottom: 0.25rem; }
        .token-date { font-size: 0.75rem; color: var(--text-muted); }

        .empty-state { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }

        .modal { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 1000; align-items: center; justify-content: center; }
        .modal.show { display: flex; }
        .modal-content { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; max-width: 500px; width: 90%; backdrop-filter: blur(20px); }
        .modal-content h3 { margin-bottom: 1rem; }
        .modal-content p { color: var(--text-muted); margin-bottom: 1.5rem; font-size: 0.9rem; }
        .token-display { background: rgba(139, 92, 246, 0.1); border: 1px solid var(--primary); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; }
        .token-display code { font-family: 'JetBrains Mono', monospace; font-size: 0.85rem; color: var(--primary); word-break: break-all; display: block; }
        .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }

        .alert { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; color: var(--danger); font-size: 0.85rem; }

        #toast { position: fixed; bottom: 2rem; right: 2rem; padding: 1rem 1.5rem; background: var(--primary-dark); color: white; border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); transform: translateY(150%); transition: transform 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28); z-index: 1000; border: 1px solid var(--primary); }
        #toast.show { transform: translateY(0); }

        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .token-item { flex-direction: column; align-items: flex-start; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <div class="icon"></div>
                <h1>GERENCIAMENTO DE TOKENS</h1>
            </div>
            <a href="/" class="btn btn-outline">← Voltar ao Dashboard</a>
        </header>

        <div class="section">
            <h2>Seus Tokens de API</h2>
            <p>Tokens de API permitem que aplicações externas acessem a API do BotMeet em seu nome. Mantenha-os seguros!</p>
            
            <div class="alert" id="auth-alert" style="display: none;">
                ⚠️ Você precisa estar autenticado para gerenciar tokens. Por favor, insira um token válido abaixo.
            </div>

            <div style="margin-bottom: 1.5rem;">
                <label style="display: block; margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-muted);">Token de Autenticação:</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="password" id="auth-token" placeholder="vexa_..." style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 1rem; color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                    <button class="btn btn-primary" onclick="loadTokens()">Carregar</button>
                </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div></div>
                <button class="btn btn-primary" onclick="createToken()">+ Criar Novo Token</button>
            </div>

            <div id="token-list" class="token-list">
                <div class="empty-state">
                    <p>Insira seu token de autenticação acima para visualizar seus tokens de API.</p>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>📚 Como Usar</h2>
            <p style="margin-bottom: 1rem;">Para fazer requisições à API, inclua o token no header Authorization:</p>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; font-family: 'JetBrains Mono', monospace; font-size: 0.85rem;">
                <code style="color: var(--text-muted);">curl -X POST https://sortebem-bot.ax5glv.easypanel.host/bots \\<br>
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \\<br>
  -H "Content-Type: application/json" \\<br>
  -d '{"platform": "google_meet", "platform_specific_id": "abc-defg-hij"}'</code>
            </div>
        </div>
    </div>

    <div id="token-modal" class="modal">
        <div class="modal-content">
            <h3>✅ Token Criado com Sucesso!</h3>
            <p>Este é o seu novo token de API. <strong>Copie-o agora</strong>, pois ele não será exibido novamente.</p>
            <div class="token-display">
                <code id="new-token-value"></code>
            </div>
            <div class="modal-actions">
                <button class="btn btn-primary" onclick="copyToken()">📋 Copiar Token</button>
                <button class="btn btn-outline" onclick="closeModal()">Fechar</button>
            </div>
        </div>
    </div>

    <div id="toast">Ação executada com sucesso</div>

    <script>
        let currentAuthToken = '';

        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }

        function getAuthToken() {
            const token = document.getElementById('auth-token').value.trim();
            if (!token) {
                document.getElementById('auth-alert').style.display = 'block';
                return null;
            }
            document.getElementById('auth-alert').style.display = 'none';
            return token;
        }

        async function loadTokens() {
            const authToken = getAuthToken();
            if (!authToken) return;

            currentAuthToken = authToken;

            try {
                const res = await fetch('/api/tokens/', {
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (!res.ok) {
                    if (res.status === 401) {
                        showToast('Token inválido ou expirado');
                        document.getElementById('auth-alert').style.display = 'block';
                        return;
                    }
                    throw new Error('Falha ao carregar tokens');
                }

                const data = await res.json();
                renderTokens(data.tokens);
            } catch (e) {
                showToast('Erro ao carregar tokens');
                console.error(e);
            }
        }

        function renderTokens(tokens) {
            const container = document.getElementById('token-list');
            
            if (!tokens || tokens.length === 0) {
                container.innerHTML = '<div class="empty-state"><p>Você ainda não possui tokens de API. Crie um para começar!</p></div>';
                return;
            }

            container.innerHTML = tokens.map(token => `
                <div class="token-item">
                    <div class="token-info">
                        <div class="token-preview">${token.token_preview}</div>
                        <div class="token-date">Criado em: ${new Date(token.created_at).toLocaleString('pt-BR')}</div>
                    </div>
                    <button class="btn btn-danger btn-sm" onclick="deleteToken(${token.id})">Deletar</button>
                </div>
            `).join('');
        }

        async function createToken() {
            const authToken = getAuthToken();
            if (!authToken) return;

            try {
                const res = await fetch('/api/tokens/', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (!res.ok) throw new Error('Falha ao criar token');

                const data = await res.json();
                document.getElementById('new-token-value').textContent = data.token;
                document.getElementById('token-modal').classList.add('show');
                
                loadTokens();
            } catch (e) {
                showToast('Erro ao criar token');
                console.error(e);
            }
        }

        async function deleteToken(tokenId) {
            if (!confirm('Tem certeza que deseja deletar este token? Esta ação não pode ser desfeita.')) return;

            const authToken = getAuthToken();
            if (!authToken) return;

            try {
                const res = await fetch(`/api/tokens/${tokenId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${authToken}` }
                });

                if (!res.ok) {
                    if (res.status === 400) {
                        showToast('Você não pode deletar o token que está usando');
                        return;
                    }
                    throw new Error('Falha ao deletar token');
                }

                showToast('Token deletado com sucesso');
                loadTokens();
            } catch (e) {
                showToast('Erro ao deletar token');
                console.error(e);
            }
        }

        function copyToken() {
            const tokenValue = document.getElementById('new-token-value').textContent;
            navigator.clipboard.writeText(tokenValue).then(() => {
                showToast('Token copiado para a área de transferência!');
            });
        }

        function closeModal() {
            document.getElementById('token-modal').classList.remove('show');
        }

        document.getElementById('token-modal').addEventListener('click', (e) => {
            if (e.target.id === 'token-modal') closeModal();
        });
    </script>
</body>
</html>
"""
