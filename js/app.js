class FileManager {
    constructor() {
        this.files = [];
        this.currentFile = null;
        this.autoSaveTimer = null;
        this.loadSettings();
        this.checkAuth();
    }

    checkAuth() {
        const auth = JSON.parse(localStorage.getItem('fm_auth') || 'null');
        if (auth && auth.logged) {
            document.getElementById('login-panel').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.init();
        } else {
            document.getElementById('app').classList.add('hidden');
            document.getElementById('login-panel').classList.remove('hidden');
        }
    }

    showLogin() {
        document.getElementById('app').classList.add('hidden');
        document.getElementById('login-panel').classList.remove('hidden');
    }

    login() {
        const user = document.getElementById('login-user').value.trim();
        const pass = document.getElementById('login-pass').value;
        const saved = JSON.parse(localStorage.getItem('fm_auth') || 'null');
        
        if (!saved) {
            // Primeiro acesso - cadastrar
            if (!user || !pass) {
                this.showToast('Preencha usuÃ¡rio e senha', 'error');
                return;
            }
            localStorage.setItem('fm_auth', JSON.stringify({ user, pass, logged: true }));
            this.showToast('Conta criada! Use este login para acessar.', 'success');
            document.getElementById('login-panel').classList.add('hidden');
            document.getElementById('app').classList.remove('hidden');
            this.init();
        } else {
            // Login
            if (user === saved.user && pass === saved.pass) {
                localStorage.setItem('fm_auth', JSON.stringify({ ...saved, logged: true }));
                document.getElementById('login-panel').classList.add('hidden');
                document.getElementById('app').classList.remove('hidden');
                this.init();
            } else {
                this.showToast('UsuÃ¡rio ou senha incorretos', 'error');
            }
        }
    }

    logout() {
        const auth = JSON.parse(localStorage.getItem('fm_auth') || 'null');
        if (auth) {
            localStorage.setItem('fm_auth', JSON.stringify({ ...auth, logged: false }));
        }
        location.reload();
    }

    resetAuth() {
        if (confirm('Isso apagarÃ¡ seu login e senha. Continuar?')) {
            localStorage.removeItem('fm_auth');
            location.reload();
        }
    }

    init() {
        this.updateStatus();
        if (this.config.user && this.config.token) {
            this.refreshFiles();
        } else {
            this.showSettings();
            this.showToast('Configure o GitHub para comeÃ§ar', 'info');
        }
    }

    loadSettings() {
        this.config = JSON.parse(localStorage.getItem('fm_config') || '{}');
        document.getElementById('gh-user').value = this.config.user || '';
        document.getElementById('gh-repo').value = this.config.repo || '';
        document.getElementById('gh-token').value = this.config.token || '';
        document.getElementById('gh-folder').value = this.config.folder || '';
    }

    saveSettings() {
        this.config = {
            user: document.getElementById('gh-user').value.trim(),
            repo: document.getElementById('gh-repo').value.trim(),
            token: document.getElementById('gh-token').value.trim(),
            folder: document.getElementById('gh-folder').value.trim() || 'arquivos'
        };
        localStorage.setItem('fm_config', JSON.stringify(this.config));
        this.hideSettings();
        this.updateStatus();
        this.showToast('ConfiguraÃ§Ãµes salvas!', 'success');
        this.refreshFiles();
    }

    updateStatus() {
        const status = document.getElementById('status');
        if (this.config.user && this.config.token) {
            status.textContent = `Conectado: ${this.config.user}/${this.config.repo}`;
            status.style.color = '#2ecc71';
        } else {
            status.textContent = 'NÃ£o conectado';
            status.style.color = '#e94560';
        }
    }

    showSettings() {
        document.getElementById('settings-panel').classList.remove('hidden');
        document.getElementById('file-list-container').classList.add('hidden');
        document.getElementById('editor-container').classList.add('hidden');
    }

    hideSettings() {
        document.getElementById('settings-panel').classList.add('hidden');
        document.getElementById('file-list-container').classList.remove('hidden');
    }

    async apiCall(endpoint, method = 'GET', body = null) {
        const url = `https://api.github.com/repos/${this.config.user}/${this.config.repo}/contents/${this.config.folder}/${endpoint}`;
        const headers = {
            'Authorization': `token ${this.config.token}`,
            'Accept': 'application/vnd.github.v3+json'
        };
        const options = { method, headers };
        if (body) {
            options.body = JSON.stringify(body);
            headers['Content-Type'] = 'application/json';
        }
        const response = await fetch(url, options);
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.message || `Erro ${response.status}`);
        }
        return response.json();
    }

    async refreshFiles() {
        if (!this.config.user || !this.config.token) return;

        const fileList = document.getElementById('file-list');
        const emptyState = document.getElementById('empty-state');
        fileList.innerHTML = '<div class="loading"></div> Carregando...';

        try {
            const contents = await this.apiCall('');
            this.files = contents
                .filter(f => f.type === 'file' && f.name.endsWith('.html'))
                .map(f => ({
                    name: f.name,
                    path: f.path,
                    sha: f.sha,
                    size: f.size,
                    url: f.download_url,
                    updated: f.commit?.commit?.committer?.date || new Date().toISOString()
                }));
            this.renderFiles(this.files);
        } catch (error) {
            fileList.innerHTML = '';
            emptyState.classList.remove('hidden');
            this.showToast(`Erro ao carregar: ${error.message}`, 'error');
        }
    }

    renderFiles(files) {
        const fileList = document.getElementById('file-list');
        const emptyState = document.getElementById('empty-state');

        if (files.length === 0) {
            fileList.innerHTML = '';
            emptyState.classList.remove('hidden');
            return;
        }

        emptyState.classList.add('hidden');
        fileList.innerHTML = files.map(f => `
            <div class="file-card" onclick="app.editFile('${f.name}')">
                <div class="file-actions">
                    <button class="btn btn-sm" onclick="event.stopPropagation(); app.openFileByName('${f.name}')" title="Abrir">ðŸ‘</button>
                    <button class="btn btn-sm" onclick="event.stopPropagation(); app.duplicateFile('${f.name}')" title="Duplicar">ðŸ“‹</button>
                    <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); app.deleteFile('${f.name}', '${f.sha}')" title="Excluir">ðŸ—‘</button>
                </div>
                <div class="file-icon">ðŸ“„</div>
                <div class="file-title">${f.name}</div>
                <div class="file-meta">${this.formatSize(f.size)} Â· ${this.formatDate(f.updated)}</div>
            </div>
        `).join('');
    }

    filterFiles() {
        const query = document.getElementById('search').value.toLowerCase();
        const filtered = this.files.filter(f => f.name.toLowerCase().includes(query));
        this.renderFiles(filtered);
    }

    formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR') + ' ' + date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }

    createFile() {
        const name = prompt('Nome do arquivo (sem .html):', 'novo-arquivo');
        if (!name) return;
        const fileName = name.endsWith('.html') ? name : name + '.html';

        this.currentFile = {
            name: fileName,
            sha: null,
            content: `<!DOCTYPE html>\n<html lang="pt-BR">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>${fileName.replace('.html', '')}</title>\n</head>\n<body>\n    <h1>${fileName.replace('.html', '')}</h1>\n</body>\n</html>`
        };

        document.getElementById('file-name').value = fileName;
        document.getElementById('editor').value = this.currentFile.content;
        this.updatePreview();
        this.showEditor();
    }

    async editFile(name) {
        const file = this.files.find(f => f.name === name);
        if (!file) return;

        try {
            const data = await this.apiCall(name);
            const content = decodeURIComponent(escape(atob(data.content)));

            this.currentFile = {
                name: data.name,
                sha: data.sha,
                content: content
            };

            document.getElementById('file-name').value = data.name;
            document.getElementById('editor').value = content;
            this.updatePreview();
            this.showEditor();
        } catch (error) {
            this.showToast(`Erro ao abrir: ${error.message}`, 'error');
        }
    }

    showEditor() {
        document.getElementById('file-list-container').classList.add('hidden');
        document.getElementById('settings-panel').classList.add('hidden');
        document.getElementById('editor-container').classList.remove('hidden');
        document.getElementById('save-status').textContent = '';
    }

    closeEditor() {
        document.getElementById('editor-container').classList.add('hidden');
        document.getElementById('file-list-container').classList.remove('hidden');
        this.currentFile = null;
        if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
        this.refreshFiles();
    }

    onEditorInput() {
        this.updatePreview();
        if (document.getElementById('autosave').checked && this.currentFile) {
            document.getElementById('save-status').textContent = 'â³ Aguardando...';
            if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = setTimeout(() => this.saveFile(), 2000);
        }
    }

    updatePreview() {
        const content = document.getElementById('editor').value;
        const iframe = document.getElementById('preview');
        iframe.srcdoc = content;
    }

    async saveFile() {
        if (!this.currentFile) return;
        if (!this.config.user || !this.config.token) {
            this.showToast('Configure o GitHub primeiro', 'error');
            return;
        }

        const name = document.getElementById('file-name').value.trim();
        const content = document.getElementById('editor').value;

        if (!name) {
            this.showToast('Digite um nome para o arquivo', 'error');
            return;
        }

        document.getElementById('save-status').textContent = 'ðŸ’¾ Salvando...';

        try {
            const body = {
                message: `Update ${name}`,
                content: btoa(unescape(encodeURIComponent(content))),
                branch: 'main'
            };
            if (this.currentFile.sha) {
                body.sha = this.currentFile.sha;
            }

            const data = await this.apiCall(name, 'PUT', body);
            this.currentFile.sha = data.content.sha;
            this.currentFile.name = name;

            document.getElementById('save-status').textContent = 'âœ… Salvo!';
            document.getElementById('file-info').textContent = `SHA: ${data.content.sha.substring(0, 7)}`;
            this.showToast('Arquivo salvo com sucesso!', 'success');
        } catch (error) {
            document.getElementById('save-status').textContent = 'âŒ Erro';
            this.showToast(`Erro ao salvar: ${error.message}`, 'error');
        }
    }

    openFile() {
        const name = document.getElementById('file-name').value.trim();
        if (!name || !this.config.user) return;
        const url = `https://${this.config.user}.github.io/${this.config.repo}/${this.config.folder}/${name}`;
        window.open(url, '_blank');
    }

    openFileRaw() {
        const name = document.getElementById('file-name').value.trim();
        if (!name || !this.config.user) return;
        const url = `https://${this.config.user}.github.io/${this.config.repo}/${this.config.folder}/${name}`;
        prompt('Link direto do arquivo:', url);
    }

    openFileByName(name) {
        if (!this.config.user) return;
        const url = `https://${this.config.user}.github.io/${this.config.repo}/${this.config.folder}/${name}`;
        window.open(url, '_blank');
    }

    async duplicateFile(name) {
        try {
            const data = await this.apiCall(name);
            const content = decodeURIComponent(escape(atob(data.content)));
            const newName = name.replace('.html', '_copia.html');

            await this.apiCall(newName, 'PUT', {
                message: `Duplicate ${name} as ${newName}`,
                content: btoa(unescape(encodeURIComponent(content))),
                branch: 'main'
            });

            this.showToast(`Arquivo duplicado como ${newName}`, 'success');
            this.refreshFiles();
        } catch (error) {
            this.showToast(`Erro ao duplicar: ${error.message}`, 'error');
        }
    }

    async deleteFile(name, sha) {
        if (!confirm(`Excluir "${name}"?`)) return;

        try {
            await this.apiCall(name, 'DELETE', {
                message: `Delete ${name}`,
                sha: sha,
                branch: 'main'
            });

            this.showToast('Arquivo excluÃ­do', 'success');
            this.refreshFiles();
        } catch (error) {
            this.showToast(`Erro ao excluir: ${error.message}`, 'error');
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    switchMainTab(tab, el) {
        document.querySelectorAll('.tab-main-btn').forEach(b => b.classList.remove('active'));
        el.classList.add('active');
        
        if (tab === 'files') {
            document.getElementById('file-list-container').classList.remove('hidden');
            document.getElementById('freq-container').classList.add('hidden');
        } else if (tab === 'freq') {
            document.getElementById('file-list-container').classList.add('hidden');
            document.getElementById('freq-container').classList.remove('hidden');
            this.loadFreqGenerator();
        }
    }

    loadFreqGenerator() {
        const iframe = document.getElementById('freq-frame');
        if (iframe.srcdoc && iframe.srcdoc.length > 100) return;
        
        const content = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gerador de FrequÃªncias Musicais</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f2; color: #1a1a18; min-height: 100vh; padding: 24px 16px; }
  .wrap { max-width: 620px; margin: 0 auto; }
  h1 { font-size: 18px; font-weight: 500; color: #1a1a18; margin-bottom: 16px; }
  .card { background: #ffffff; border: 1px solid #e0deda; border-radius: 12px; padding: 16px 20px; margin-bottom: 12px; }
  .sec-title { font-size: 11px; font-weight: 500; color: #888780; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 12px; }
  .lbl { font-size: 12px; color: #888780; }
  .big-freq { font-size: 40px; font-weight: 500; font-family: 'SF Mono', 'Consolas', monospace; color: #1a1a18; letter-spacing: -1px; }
  .note-tag { font-size: 16px; color: #888780; margin-left: 10px; font-family: 'SF Mono', 'Consolas', monospace; }
  .status-row { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: #d0ceca; flex-shrink: 0; transition: background .2s; }
  .dot.play { background: #3b8f4e; }
  .dot.sweep { background: #b07d1a; }
  .status-txt { font-size: 12px; color: #888780; }
  canvas { display: block; width: 100%; height: 60px; background: #f5f5f2; border: 1px solid #e0deda; border-radius: 8px; margin-top: 12px; }
  .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
  .col { display: flex; flex-direction: column; gap: 5px; }
  input[type=range] { flex: 1; min-width: 100px; height: 4px; accent-color: #2c6fbf; cursor: pointer; }
  input[type=number], select { padding: 6px 10px; border-radius: 7px; border: 1px solid #d0ceca; background: #f9f9f7; color: #1a1a18; font-size: 13px; font-family: 'SF Mono', 'Consolas', monospace; width: 80px; }
  input[type=number]:focus, select:focus { outline: 2px solid #2c6fbf; outline-offset: 1px; }
  select { width: auto; font-family: inherit; cursor: pointer; }
  .btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 20px; border-radius: 8px; border: 1px solid #c8c6c0; background: #ffffff; font-size: 14px; font-weight: 500; color: #1a1a18; cursor: pointer; transition: background .12s; margin-top: 2px; }
  .btn:hover { background: #f5f5f2; }
  .btn.on-play { background: #e6f5ea; border-color: #7ecb8e; color: #1f6631; }
  .btn.on-sweep { background: #fdf2da; border-color: #e8c060; color: #7a5210; }
  .dir-btn { padding: 5px 13px; border-radius: 7px; border: 1px solid #d0ceca; background: #ffffff; font-size: 13px; color: #888780; cursor: pointer; transition: background .12s; }
  .dir-btn:hover { background: #f5f5f2; }
  .dir-btn.active { background: #ddeaf9; border-color: #88b0e0; color: #1a4f8a; font-weight: 500; }
  .step-info { font-size: 12px; color: #888780; font-family: 'SF Mono', 'Consolas', monospace; margin: 6px 0 4px; }
  .bar-wrap { height: 6px; background: #f0ede8; border-radius: 3px; border: 1px solid #e0deda; overflow: hidden; margin: 8px 0 12px; }
  .bar { height: 100%; background: #e8a820; border-radius: 3px; width: 0%; transition: width .12s linear; }
  .val-display { font-size: 13px; font-weight: 500; min-width: 44px; text-align: right; color: #1a1a18; }
</style>
</head>
<body>
<div class="wrap">
  <h1>Gerador de FrequÃªncias Musicais</h1>
  <div class="card">
    <div style="display:flex;align-items:baseline;justify-content:space-between">
      <div>
        <span class="big-freq" id="dispFreq">440.00</span>
        <span style="font-size:20px;color:#888780;font-family:monospace"> Hz</span>
        <span class="note-tag" id="dispNote">A4</span>
      </div>
    </div>
    <div class="status-row">
      <span class="dot" id="sdot"></span>
      <span class="status-txt" id="statusTxt">parado</span>
    </div>
    <canvas id="wc"></canvas>
  </div>
  <div class="card">
    <div class="sec-title">Controle manual</div>
    <div class="row">
      <span class="lbl" style="min-width:64px">FrequÃªncia</span>
      <input type="range" id="freqSlider" min="65" max="1500" value="440" step="1">
      <input type="number" id="freqNum" min="65" max="1500" value="440" step="1">
      <span class="lbl">Hz</span>
    </div>
    <div class="row">
      <span class="lbl" style="min-width:64px">Volume</span>
      <input type="range" id="volSlider" min="0" max="100" value="60" step="1">
      <span class="val-display" id="volVal">60%</span>
    </div>
    <button class="btn" id="btnPlay">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" id="playIcon"><polygon points="3,1 13,7 3,13"/></svg>
      <span id="playTxt">Tocar</span>
    </button>
  </div>
  <div class="card">
    <div class="sec-title">Varredura automÃ¡tica</div>
    <div class="row" style="gap:14px">
      <div class="col"><span class="lbl">De (Hz)</span><input type="number" id="swFrom" min="65" max="1500" value="65" step="1"></div>
      <div class="col"><span class="lbl">AtÃ© (Hz)</span><input type="number" id="swTo" min="65" max="1500" value="1500" step="1"></div>
      <div class="col"><span class="lbl">Passo (Hz)</span><input type="number" id="swStep" min="1" max="200" value="5" step="1"></div>
      <div class="col"><span class="lbl">Intervalo (s)</span><input type="number" id="swInterval" min="0.1" max="10" value="1" step="0.1"></div>
    </div>
    <div class="row" style="margin-top:4px;gap:8px">
      <span class="lbl">DireÃ§Ã£o:</span>
      <button class="dir-btn active" id="dirUp" onclick="setDir('up')">&#8593; Subindo</button>
      <button class="dir-btn" id="dirDown" onclick="setDir('down')">&#8595; Descendo</button>
      <button class="dir-btn" id="dirBounce" onclick="setDir('bounce')">&#8597; Ida e volta</button>
    </div>
    <div class="step-info" id="stepInfo">65 Hz â†’ 1500 Hz â†‘, passo 5 Hz, a cada 1.0 s</div>
    <div class="bar-wrap"><div class="bar" id="sweepBar"></div></div>
    <button class="btn" id="btnSweep">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" id="sweepIcon"><path d="M1 7 Q3.5 2 7 7 Q10.5 12 13 7"/></svg>
      <span id="sweepTxt">Iniciar varredura</span>
    </button>
  </div>
</div>
<script>
const NOTES=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
function freqToNote(f){const m=Math.round(12*Math.log2(f/440)+69);return NOTES[((m%12)+12)%12]+String(Math.floor(m/12)-1);}
let audioCtx=null,osc=null,gainNode=null,isPlaying=false,isSweeping=false,sweepDir='up',sweepTimer=null,sweepBounceDir=1,currentFreq=440,animRAF=null,animT=0;
function getCtx(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}
function getVol(){return document.getElementById('volSlider').value/100*0.65;}
function ensureOsc(){if(osc)return;const ctx=getCtx();osc=ctx.createOscillator();gainNode=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(currentFreq,ctx.currentTime);gainNode.gain.setValueAtTime(0,ctx.currentTime);gainNode.gain.linearRampToValueAtTime(getVol(),ctx.currentTime+0.02);osc.connect(gainNode);gainNode.connect(ctx.destination);osc.start();startWaveAnim();}
function killOsc(){if(!osc)return;const ctx=getCtx();gainNode.gain.cancelScheduledValues(ctx.currentTime);gainNode.gain.setValueAtTime(gainNode.gain.value,ctx.currentTime);gainNode.gain.linearRampToValueAtTime(0,ctx.currentTime+0.04);const o=osc;setTimeout(()=>{try{o.stop()}catch(e){}},80);osc=null;gainNode=null;stopWaveAnim();}
function applyFreq(f){f=Math.max(65,Math.min(1500,Math.round(f)));currentFreq=f;document.getElementById('freqSlider').value=f;document.getElementById('freqNum').value=f;document.getElementById('dispFreq').textContent=f.toFixed(2);document.getElementById('dispNote').textContent=freqToNote(f);if(osc)osc.frequency.setValueAtTime(f,getCtx().currentTime);}
function setStatus(txt,mode){document.getElementById('statusTxt').textContent=txt;const d=document.getElementById('sdot');d.className='dot'+(mode?' '+mode:'');}
function togglePlay(){if(isSweeping)stopSweep();if(isPlaying){isPlaying=false;killOsc();document.getElementById('btnPlay').className='btn';document.getElementById('playTxt').textContent='Tocar';document.getElementById('playIcon').innerHTML='<polygon points="3,1 13,7 3,13"/>';setStatus('parado','');}else{isPlaying=true;ensureOsc();document.getElementById('btnPlay').className='btn on-play';document.getElementById('playTxt').textContent='Parar';document.getElementById('playIcon').innerHTML='<rect x="2" y="1" width="4" height="12"/><rect x="8" y="1" width="4" height="12"/>';setStatus('tocando','play');}}
function setDir(d){sweepDir=d;document.getElementById('dirUp').className='dir-btn'+(d==='up'?' active':'');document.getElementById('dirDown').className='dir-btn'+(d==='down'?' active':'');document.getElementById('dirBounce').className='dir-btn'+(d==='bounce'?' active':'');updateStepInfo();}
function updateStepInfo(){const from=parseFloat(document.getElementById('swFrom').value)||65;const to=parseFloat(document.getElementById('swTo').value)||1500;const step=parseFloat(document.getElementById('swStep').value)||5;const iv=parseFloat(document.getElementById('swInterval').value)||1;const arrow=sweepDir==='up'?'â†‘':sweepDir==='down'?'â†“':'â†•';document.getElementById('stepInfo').textContent=from+' Hz â†’ '+to+' Hz '+arrow+', passo '+step+' Hz, a cada '+iv.toFixed(1)+' s';}
function toggleSweep(){if(isSweeping){stopSweep();}else{if(isPlaying)togglePlay();startSweep();}}
function startSweep(){const from=Math.max(65,parseFloat(document.getElementById('swFrom').value)||65);const to=Math.min(1500,parseFloat(document.getElementById('swTo').value)||1500);isSweeping=true;sweepBounceDir=1;applyFreq(sweepDir==='down'?to:from);ensureOsc();document.getElementById('btnSweep').className='btn on-sweep';document.getElementById('sweepTxt').textContent='Parar varredura';document.getElementById('sweepIcon').innerHTML='<rect x="1" y="1" width="12" height="12" rx="2"/>';setStatus('varrendo','sweep');updateSweepBar();scheduleSweepStep();}
function scheduleSweepStep(){const iv=Math.max(0.1,parseFloat(document.getElementById('swInterval').value)||1)*1000;sweepTimer=setTimeout(doSweepStep,iv);}
function doSweepStep(){if(!isSweeping)return;const from=Math.max(65,parseFloat(document.getElementById('swFrom').value)||65);const to=Math.min(1500,parseFloat(document.getElementById('swTo').value)||1500);const step=Math.max(1,parseFloat(document.getElementById('swStep').value)||5);let next;if(sweepDir==='up'){next=currentFreq+step;if(next>to)next=from;}else if(sweepDir==='down'){next=currentFreq-step;if(next<from)next=to;}else{next=currentFreq+step*sweepBounceDir;if(next>=to){next=to;sweepBounceDir=-1;}else if(next<=from){next=from;sweepBounceDir=1;}}applyFreq(next);updateSweepBar();scheduleSweepStep();}
function updateSweepBar(){const from=Math.max(65,parseFloat(document.getElementById('swFrom').value)||65);const to=Math.min(1500,parseFloat(document.getElementById('swTo').value)||1500);const pct=(currentFreq-from)/(to-from)*100;document.getElementById('sweepBar').style.width=Math.max(0,Math.min(100,pct)).toFixed(1)+'%';}
function stopSweep(){isSweeping=false;if(sweepTimer){clearTimeout(sweepTimer);sweepTimer=null;}killOsc();document.getElementById('btnSweep').className='btn';document.getElementById('sweepTxt').textContent='Iniciar varredura';document.getElementById('sweepIcon').innerHTML='<path d="M1 7 Q3.5 2 7 7 Q10.5 12 13 7"/>';document.getElementById('sweepBar').style.width='0%';setStatus('parado','');}
function startWaveAnim(){if(animRAF)cancelAnimationFrame(animRAF);animT=0;drawWave();}
function stopWaveAnim(){if(animRAF){cancelAnimationFrame(animRAF);animRAF=null;}const cv=document.getElementById('wc');const ctx=cv.getContext('2d');cv.width=cv.offsetWidth*devicePixelRatio;cv.height=cv.offsetHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);ctx.clearRect(0,0,cv.offsetWidth,cv.offsetHeight);ctx.strokeStyle='#d0ceca';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,cv.offsetHeight/2);ctx.lineTo(cv.offsetWidth,cv.offsetHeight/2);ctx.stroke();}
function drawWave(){const cv=document.getElementById('wc');const ctx=cv.getContext('2d');cv.width=cv.offsetWidth*devicePixelRatio;cv.height=cv.offsetHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);const W=cv.offsetWidth,H=cv.offsetHeight;const cycles=Math.max(3,Math.min(14,Math.round(currentFreq/90)));ctx.clearRect(0,0,W,H);ctx.strokeStyle='#2c6fbf';ctx.lineWidth=1.8;ctx.beginPath();for(let x=0;x<W;x++){const y=H/2-Math.sin((x/W)*cycles*2*Math.PI+animT)*(H*0.38);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();animT+=0.015;animRAF=requestAnimationFrame(drawWave);}
document.getElementById('btnPlay').addEventListener('click',togglePlay);document.getElementById('btnSweep').addEventListener('click',toggleSweep);document.getElementById('freqSlider').addEventListener('input',e=>applyFreq(parseFloat(e.target.value)));document.getElementById('freqNum').addEventListener('change',e=>applyFreq(parseFloat(e.target.value)||440));document.getElementById('volSlider').addEventListener('input',()=>{document.getElementById('volVal').textContent=Math.round(document.getElementById('volSlider').value)+'%';if(gainNode&&audioCtx)gainNode.gain.setValueAtTime(getVol(),audioCtx.currentTime);});['swFrom','swTo','swStep','swInterval'].forEach(id=>{document.getElementById(id).addEventListener('input',updateStepInfo);});applyFreq(440);stopWaveAnim();updateStepInfo();
</script>
</body>
</html>`;
        iframe.srcdoc = content;
    }
}

const app = new FileManager();
