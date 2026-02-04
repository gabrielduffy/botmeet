
DASHBOARD_HTML = """
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BotMeet | Admin Command Center</title>
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

        .container { max-width: 1400px; margin: 0 auto; padding: 2rem 1.5rem; }

        /* Header Section */
        header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 3rem; flex-wrap: wrap; gap: 1rem; }
        .brand { display: flex; align-items: center; gap: 0.75rem; }
        .brand .icon { width: 12px; height: 12px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 15px var(--primary); animation: pulse 2s infinite; }
        .brand h1 { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.5px; }

        @keyframes pulse { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }

        .badge-online { display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); color: var(--success); padding: 0.4rem 1rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600; }

        /* Stats Grid */
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .stat-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; backdrop-filter: blur(10px); transition: transform 0.3s ease, border-color 0.3s ease; }
        .stat-card:hover { border-color: var(--primary); transform: translateY(-3px); }
        .stat-card h3 { color: var(--text-muted); font-size: 0.85rem; font-weight: 500; text-transform: uppercase; margin-bottom: 1rem; }
        .stat-value { font-size: 2.25rem; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: var(--text); }
        .stat-progress { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-top: 1rem; overflow: hidden; }
        .stat-progress-inner { height: 100%; background: linear-gradient(90deg, var(--primary-dark), var(--primary)); width: 0%; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }

        /* Main Content */
        .main-grid { display: grid; grid-template-columns: 1fr 380px; gap: 2rem; }
        @media (max-width: 1100px) { .main-grid { grid-template-columns: 1fr; } }

        .panel { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.5rem; backdrop-filter: blur(10px); }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .panel-title { font-size: 1.1rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; }

        /* Tabs */
        .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.03); padding: 0.35rem; border-radius: 10px; border: 1px solid var(--border); }
        .tab-btn { flex:1; padding: 0.75rem 1rem; border: none; background: none; color: var(--text-muted); cursor: pointer; border-radius: 8px; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; }
        .tab-btn.active { background: var(--primary); color: white; box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }

        /* Table Styles */
        table { width: 100%; border-collapse: separate; border-spacing: 0 0.75rem; }
        th { text-align: left; padding: 0.75rem 1rem; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        td { padding: 1.25rem 1rem; background: rgba(255,255,255,0.02); border-top: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); }
        td:first-child { border-left: 1px solid rgba(255,255,255,0.04); border-radius: 12px 0 0 12px; }
        td:last-child { border-right: 1px solid rgba(255,255,255,0.04); border-radius: 0 12px 12px 0; }

        .image-badge { background: #1a1a1e; padding: 0.25rem 0.5rem; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.1); }
        .status-pill { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase; }
        .status-running { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-stopped { background: rgba(239, 68, 68, 0.1); color: var(--danger); }

        /* Buttons */
        .btn { padding: 0.6rem 1.25rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; border: none; display: inline-flex; align-items: center; gap: 0.5rem; }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(139, 92, 246, 0.2); }
        .btn-danger { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); }
        .btn-danger:hover { background: var(--danger); color: white; }
        .btn-outline { background: transparent; border: 1px solid var(--border); color: var(--text); }
        .btn-outline:hover { border-color: var(--primary); background: rgba(139, 92, 246, 0.05); }
        .btn-sm { padding: 0.4rem 0.75rem; font-size: 0.75rem; }

        /* Controls Panel */
        .controls { position: sticky; top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .input-group { margin-bottom: 1rem; }
        .input-group label { display: block; font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem; font-weight: 500; }
        input, select { width: 100%; background: #111; border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 1rem; color: white; font-family: inherit; font-size: 0.9rem; transition: border-color 0.2s; }
        input:focus, select:focus { outline: none; border-color: var(--primary); }

        /* Modal */
        .modal { display: none; position: fixed; z-index: 1000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.8); backdrop-filter: blur(8px); }
        .modal-content { background: #0a0a0c; margin: 5% auto; padding: 2.5rem; border: 1px solid var(--border); border-radius: 20px; width: 80%; max-width: 900px; max-height: 80vh; overflow-y: auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
        .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
        .close { color: var(--text-muted); float: right; font-size: 28px; font-weight: bold; cursor: pointer; }
        .close:hover { color: #fff; }

        .transcription-line { margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px dotted rgba(255,255,255,0.05); }
        .t-time { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--primary); margin-bottom: 0.4rem; }
        .t-text { color: #e2e8f0; line-height: 1.6; }

        .toast { position: fixed; bottom: 2rem; right: 2rem; background: var(--primary); color: white; padding: 1rem 2rem; border-radius: 10px; font-weight: 600; box-shadow: 0 10px 25px rgba(0,0,0,0.3); transform: translateY(150%); transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); z-index: 9999; }
        .toast.show { transform: translateY(0); }

        .id-badge { background: var(--primary); color: white; padding: 0.1rem 0.4rem; border-radius: 4px; font-size: 0.7rem; font-weight: 800; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="brand">
                <div class="icon"></div>
                <h1>BotMeet Command Center</h1>
            </div>
            <div class="badge-online">
                <div style="width: 8px; height: 8px; background: var(--success); border-radius: 50%;"></div>
                Sistema Operacional
            </div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <h3>CPU Usage</h3>
                <div class="stat-value" id="cpu-val">0%</div>
                <div class="stat-progress"><div id="cpu-progress" class="stat-progress-inner"></div></div>
            </div>
            <div class="stat-card">
                <h3>Memory RAM</h3>
                <div class="stat-value" id="mem-val">0%</div>
                <div class="stat-progress"><div id="mem-progress" class="stat-progress-inner"></div></div>
            </div>
            <div class="stat-card">
                <h3>Disco</h3>
                <div class="stat-value" id="disk-val">0%</div>
                <div class="stat-progress"><div id="disk-progress" class="stat-progress-inner"></div></div>
            </div>
        </div>

        <div class="main-grid">
            <div class="panel">
                <div class="panel-header">
                    <div class="panel-title">Gerenciador de Instâncias</div>
                    <button onclick="cleanupExited()" class="btn btn-outline btn-sm">Limpar Mortos</button>
                </div>

                <div class="tabs">
                    <button class="tab-btn active" onclick="openTab(event, 'panel')">Centro de Comando</button>
                    <button class="tab-btn" onclick="openTab(event, 'history'); loadHistory();">Histórico de Reuniões</button>
                </div>

                <div id="panel" class="tab-content active">
                    <table id="container-table">
                        <thead>
                            <tr>
                                <th>Container</th>
                                <th>Imagem</th>
                                <th>Status</th>
                                <th>Estado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="container-body">
                            <!-- JS populated -->
                        </tbody>
                    </table>
                </div>

                <div id="history" class="tab-content">
                    <table id="history-table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Plataforma</th>
                                <th>Reunião</th>
                                <th>Status</th>
                                <th>Data</th>
                                <th>Duração</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody id="history-body">
                            <!-- JS populated -->
                        </tbody>
                    </table>
                </div>
            </div>

            <aside class="controls">
                <div class="panel">
                    <div class="panel-title" style="margin-bottom: 1.5rem;">Lançamento Rápido</div>
                    <div class="input-group">
                        <label>URL do Google Meet</label>
                        <input type="text" id="meet-url" placeholder="https://meet.google.com/abc-defg-hij">
                    </div>
                    <div class="input-group">
                        <label>Nome do Bot</label>
                        <input type="text" id="bot-name" value="Vexa Assistant">
                    </div>
                    <button onclick="launchBot()" class="btn btn-primary" style="width: 100%; justify-content: center; margin-top: 1rem;">Lançar Novo Bot</button>
                </div>

                <div class="panel">
                    <div class="panel-title" style="margin-bottom: 1.5rem;">Serviços Críticos</div>
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button onclick="restartService('bot-manager')" class="btn btn-outline" style="width: 100%;">Reiniciar Manager</button>
                        <button onclick="restartService('whisper')" class="btn btn-outline" style="width: 100%;">Reiniciar Whisper</button>
                        <button onclick="killBots()" class="btn btn-danger" style="width: 100%; justify-content: center;">MATAR TODOS BOTS</button>
                    </div>
                </div>
            </aside>
        </div>
    </div>

    <!-- Transcription Modal -->
    <div id="transcription-modal" class="modal">
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="modal-title">Transcrição da Reunião</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>
            <div id="transcription-content">
                <!-- Content here -->
            </div>
        </div>
    </div>

    <div id="toast" class="toast">Mensagem do sistema</div>

    <script>
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg;
            t.classList.add('show');
            setTimeout(() => t.classList.remove('show'), 3000);
        }

        async function updateStats() {
            try {
                const res = await fetch('/api/admin/stats');
                const data = await res.json();
                
                document.getElementById('cpu-val').innerText = data.cpu_percent + '%';
                document.getElementById('cpu-progress').style.width = data.cpu_percent + '%';
                
                document.getElementById('mem-val').innerText = data.memory.percent + '%';
                document.getElementById('mem-progress').style.width = data.memory.percent + '%';
                
                document.getElementById('disk-val').innerText = data.disk.percent + '%';
                document.getElementById('disk-progress').style.width = data.disk.percent + '%';
            } catch(e) {}
        }

        async function loadContainers() {
            try {
                const res = await fetch('/api/admin/containers');
                const data = await res.json();
                const tbody = document.getElementById('container-body');
                tbody.innerHTML = '';

                data.forEach(c => {
                    const tr = document.createElement('tr');
                    const isRunning = c.state === 'running';
                    const isMainService = ['bot-manager', 'whisper', 'vexa-bot', 'admin-api', 'api-gateway', 'sortebem'].some(term => c.name.toLowerCase().includes(term));
                    
                    tr.innerHTML = `
                        <td><div style="font-weight:700;">${c.name}</div><div style="font-size:0.7rem;color:var(--text-muted)">ID: ${c.id}</div></td>
                        <td><div class="image-badge">${c.image}</div></td>
                        <td><span class="status-pill ${isRunning ? 'status-running' : 'status-stopped'}">${c.status}</span></td>
                        <td style="text-transform:uppercase; font-size:0.75rem; font-weight:800; color:${isRunning ? 'var(--success)' : 'var(--danger)'}">${c.state}</td>
                        <td>
                            ${!isMainService ? `<button onclick="stopContainer('${c.id}')" class="btn btn-danger btn-sm">PARAR</button>` : '<span style="font-size:0.7rem; color:var(--text-muted)">SISTEMA</span>'}
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch(e) {
                console.error("Containers fail", e);
            }
        }

        async function launchBot() {
            const urlInput = document.getElementById('meet-url').value;
            const botName = document.getElementById('bot-name').value;
            
            if (!urlInput) {
                showToast("Por favor, insira uma URL do Google Meet");
                return;
            }

            // Extract meet ID from URL
            const regex = /meet\\.google\\.com\\/([a-z0-9-]+)/i;
            const match = urlInput.match(regex);
            
            if (!match) {
                showToast("URL do Google Meet inválida");
                return;
            }

            const nativeMeetingId = match[1];
            
            showToast(`Iniciando bot '${botName}' para a reunião ${nativeMeetingId}...`);
            
            try {
                const res = await fetch('/bots', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        platform: "google_meet",
                        native_meeting_id: nativeMeetingId,
                        bot_name: botName
                    })
                });
                
                if (res.ok) {
                    showToast("Bot solicitado com sucesso!");
                    document.getElementById('meet-url').value = '';
                    loadContainers();
                } else {
                    const err = await res.json();
                    showToast(`Erro: ${err.detail || 'Falha ao lançar'}`);
                }
            } catch(e) {
                showToast("Erro na conexão com o servidor");
            }
        }

        async function killBots() {
            if (!confirm("Confirmar encerramento de todos os robôs?")) return;
            try {
                const res = await fetch('/api/admin/kill-bots', { method: 'POST' });
                const data = await res.json();
                showToast(`${data.killed || 0} bots removidos.`);
                loadContainers();
            } catch(e) { showToast("Erro ao processar"); }
        }

        async function cleanupExited() {
            try {
                const res = await fetch('/api/admin/cleanup', { method: 'POST' });
                const data = await res.json();
                showToast(`${data.removed || 0} containers mortos removidos.`);
                loadContainers();
            } catch(e) { showToast("Erro ao limpar"); }
        }

        async function stopContainer(id) {
            if (!confirm("Parar este bot?")) return;
            try {
                const res = await fetch(`/api/admin/stop/${id}`, { method: 'POST' });
                const data = await res.json();
                if (data.success) {
                    showToast("Bot interrompido");
                    loadContainers();
                } else showToast(data.error || "Erro");
            } catch(e) { showToast("Erro na requisição"); }
        }

        function openTab(event, tabId) {
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById(tabId).classList.add('active');
            if (event && event.currentTarget) {
                event.currentTarget.classList.add('active');
            }
        }

        async function loadHistory() {
            try {
                const res = await fetch('/api/admin/history');
                const data = await res.json();
                const tbody = document.getElementById('history-body');
                tbody.innerHTML = '';

                if (!data || data.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">Nenhuma reunião encontrada.</td></tr>';
                    return;
                }

                data.forEach(m => {
                    const tr = document.createElement('tr');
                    const date = m.created_at ? new Date(m.created_at).toLocaleString() : '-';
                    const duration = m.duration ? `${Math.floor(m.duration / 60)}m ${m.duration % 60}s` : '-';
                    
                    tr.innerHTML = `
                        <td><span class="id-badge">${m.id}</span></td>
                        <td style="text-transform: capitalize;">${m.platform.replace('_', ' ')}</td>
                        <td><div class="image-badge">${m.native_id}</div></td>
                        <td><span class="status-pill status-running" style="${m.status === 'completed' ? 'background:rgba(16,185,129,0.1);color:var(--success);' : (m.status === 'failed' ? 'background:rgba(239,68,68,0.1);color:var(--danger);' : 'background:rgba(245,158,11,0.1);color:var(--warning);')}">${m.status}</span></td>
                        <td style="font-size: 0.8rem;">${date}</td>
                        <td style="font-size: 0.8rem;">${duration}</td>
                        <td>
                            <button class="btn btn-outline btn-sm" onclick="openTranscription(${m.id})">VER</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            } catch (e) { console.error("History fail", e); }
        }

        async function openTranscription(meetingId) {
            const modal = document.getElementById('transcription-modal');
            const content = document.getElementById('transcription-content');
            modal.style.display = 'block';
            content.innerHTML = 'Carregando transcrição...';

            try {
                const res = await fetch(`/api/admin/transcription/${meetingId}`);
                const data = await res.json();
                
                if (!data || data.length === 0) {
                    content.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhuma fala capturada para esta reunião.</p>';
                    return;
                }

                content.innerHTML = data.map(t => `
                    <div class="transcription-line">
                        <div class="t-time">${t.start_time.toFixed(1)}s - ${t.end_time.toFixed(1)}s</div>
                        <div class="t-text">${t.text}</div>
                    </div>
                `).join('');
            } catch (e) {
                content.innerHTML = `<p style="color: var(--danger);">Erro ao carregar: ${e.message}</p>`;
            }
        }

        async function restartService(name) {
            if (!confirm(`Reiniciar o serviço ${name}?`)) return;
            try {
                await fetch(`/api/admin/restart/${name}`, { method: 'POST' });
                showToast(`Reinício solicitado para ${name}`);
            } catch(e) { showToast("Erro ao solicitar"); }
        }

        function closeModal() {
            document.getElementById('transcription-modal').style.display = 'none';
        }

        // Close modal on outside click
        window.onclick = function(event) {
            const modal = document.getElementById('transcription-modal');
            if (event.target == modal) closeModal();
        }

        setInterval(updateStats, 3000);
        setInterval(loadContainers, 10000);
        updateStats();
        loadContainers();
    </script>
</body>
</html>
"""

DOCS_HTML = """
<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BotMeet | Documentação Técnica</title>
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
            --code-bg: #111;
            --radius: 12px;
        }
        body { 
            background: var(--bg); 
            color: var(--text); 
            font-family: 'Poppins', sans-serif; 
            margin: 0; padding: 0;
            background-image: radial-gradient(circle at 100% 0%, rgba(109, 40, 149, 0.1) 0%, transparent 40%);
            background-attachment: fixed;
        }
        .container { max-width: 1000px; margin: 0 auto; padding: 4rem 2rem; }
        header { margin-bottom: 4rem; border-bottom: 1px solid var(--border); padding-bottom: 2rem; }
        h1 { font-size: 2.5rem; margin-bottom: 1rem; letter-spacing: -1px; }
        h2 { color: var(--primary); margin-top: 3rem; margin-bottom: 1.5rem; font-size: 1.5rem; }
        h3 { color: #fff; margin-top: 2rem; }
        p { color: var(--text-muted); line-height: 1.7; margin-bottom: 1rem; }
        .code-block { background: var(--code-bg); padding: 1.5rem; border-radius: 8px; border: 1px solid var(--border); font-family: 'JetBrains Mono', monospace; font-size: 0.9rem; overflow-x: auto; margin: 1.5rem 0; position: relative; }
        .method { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 700; margin-right: 0.5rem; font-size: 0.8rem; }
        .get { background: rgba(16, 185, 129, 0.1); color: #10b981; }
        .post { background: rgba(139, 92, 246, 0.1); color: var(--primary); }
        .endpoint { color: #fff; font-weight: 600; }
        ul { list-style: none; padding: 0; }
        li { margin-bottom: 1rem; padding-left: 1.5rem; position: relative; color: var(--text-muted); }
        li::before { content: '→'; position: absolute; left: 0; color: var(--primary); }
        .badge { background: var(--primary); color: #fff; padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; vertical-align: middle; margin-left: 0.5rem; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Documentação Vexa-Bot</h1>
            <p>Guia técnico para integração de transcrição e gerenciamento de bots de reunião.</p>
        </header>

        <section>
            <h2>1. Visão Geral</h2>
            <p>O Vexa-Bot é um agente autônomo projetado para entrar em reuniões do Google Meet, realizar transcrição de áudio em tempo real usando a Groq API e persistir os dados no banco de dados central.</p>
        </section>

        <section>
            <h2>2. Ciclo de Vida do Bot</h2>
            <ul>
                <li><strong>Launch:</strong> Um bot é solicitado via API ou Dashboard.</li>
                <li><strong>Entry:</strong> O bot entra na sala mutado (mic/cam desativados via script).</li>
                <li><strong>Transcription:</strong> O bot captura áudio, processa via Groq e envia de volta ao manager.</li>
                <li><strong>Persistence:</strong> O manager salva cada segmento com timestamp e texto.</li>
                <li><strong>History:</strong> Os dados ficam disponíveis para consulta posterior via Dashboard.</li>
            </ul>
        </section>

        <section>
            <h2>3. Endpoints de Lançamento</h2>
            <div class="code-block">
                <span class="method post">POST</span> <span class="endpoint">/bots</span>
            </div>
            <p>Inicia uma nova instância do bot em um container Docker isolado.</p>
            <div class="code-block">
{
  "platform": "google_meet",
  "native_meeting_id": "abc-defg-hij",
  "passcode": "opcional",
  "bot_name": "Seu Nome de Bot"
}
            </div>
        </section>

        <section>
            <h2>4. Callbacks Internos (Exclusivo Bot)</h2>
            <p>Estes endpoints são usados pelos bots para reportar status ao Manager.</p>
            
            <h3>Trancrição em Tempo Real</h3>
            <div class="code-block">
                <span class="method post">POST</span> <span class="endpoint">/bots/internal/callback/transcription</span>
            </div>
            
            <h3>Status de Execução</h3>
            <div class="code-block">
                <span class="method post">POST</span> <span class="endpoint">/bots/internal/callback/started</span> <span class="badge">STARTUP</span>
            </div>
            <div class="code-block">
                <span class="method post">POST</span> <span class="endpoint">/bots/internal/callback/exited</span> <span class="badge">CLEANUP</span>
            </div>
        </section>

        <section>
            <h2>5. Dashboard e Histórico</h2>
            <p>O sistema oferece uma interface visual completa para monitoramento:</p>
            <ul>
                <li><strong>Aba Comando:</strong> Controle de containers ativos, logs em tempo real e lançamento rápido.</li>
                <li><strong>Aba Histórico:</strong> Lista de todas as reuniões realizadas com tempo de duração.</li>
                <li><strong>Viewer:</strong> Visualização detalhada de transcrições por ID de reunião.</li>
            </ul>
        </section>

        <footer style="margin-top: 5rem; text-align: center; color: var(--text-muted); font-size: 0.8rem;">
            &copy; 2026 BotMeet Command | Advanced Agentic Coding
        </footer>
    </div>
</body>
</html>
"""
