Chart.register(ChartDataLabels);

const API_URL = 'https://script.google.com/macros/s/AKfycbwW56AajbBpeTAHLw_e6GPf_36j-NlYg_NU6gUB8e-5zZzNE5ExhrGmcTCOr2mGrrqc2A/exec';

let dadosPlanilha = {};
let chartAtividade, chartPizza, chartStories;

function urlFoto(url) {
    if (!url) return '';
    const id = (url.match(/[?&]id=([^&]+)/) || [])[1];
    return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w100' : url;
}

// ─── Init ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    configurarNavegacao();
    configurarEventosIndividual();
});

// ─── API ─────────────────────────────────────────────────────────────────────
async function carregarDados() {
    try {
        const res  = await fetch(API_URL);
        const json = await res.json();
        dadosPlanilha = json.data.BaseDeDatos;
        renderizarSOS();
        preencherListaNutricionistas();
        document.getElementById('sos-loading').style.display = 'none';
    } catch (e) {
        document.getElementById('sos-loading').textContent = 'Erro ao carregar dados.';
    }
}

// ─── Navegação ────────────────────────────────────────────────────────────────
function configurarNavegacao() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const page = item.dataset.page;
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
            item.classList.add('active');
            document.getElementById('page-' + page).classList.add('active');
        });
    });
}

// ─── SOS ─────────────────────────────────────────────────────────────────────
function renderizarSOS(filtroStatus = 'todos', busca = '') {
    const container = document.getElementById('sos-grupos');
    container.innerHTML = '';

    if (!dadosPlanilha.data) return;

    // Pega o último registro de cada nutricionista
    const porNutricionista = {};
    dadosPlanilha.data.forEach(row => {
        const nome = row['membros'];
        if (!nome) return;
        if (!porNutricionista[nome] || new Date(row['📅 Data']) > new Date(porNutricionista[nome]['📅 Data'])) {
            porNutricionista[nome] = row;
        }
    });

    const hoje = new Date();

    // Monta lista com métricas
    let lista = Object.entries(porNutricionista).map(([nome, row]) => {
        const ultimoPost = row['📤 Último post'] ? new Date(row['📤 Último post']) : null;
        const diasSemPostar = ultimoPost
            ? Math.floor((hoje - ultimoPost) / (1000 * 60 * 60 * 24))
            : 999;

        // Posts na última semana
        const seteDiasAtras = new Date();
        seteDiasAtras.setDate(hoje.getDate() - 7);
        const postsSemana = dadosPlanilha.data.filter(r =>
            r['membros'] === nome &&
            r['📤 Último post'] === r['📅 Data'] &&
            new Date(r['📅 Data']) >= seteDiasAtras
        ).length;

        const status = diasSemPostar >= 7 ? 'critico' : diasSemPostar >= 3 ? 'alerta' : 'saudavel';

        return { nome, diasSemPostar, postsSemana, status, row };
    });

    // Filtros
    if (filtroStatus !== 'todos') lista = lista.filter(i => i.status === filtroStatus);
    if (busca) lista = lista.filter(i => i.nome.toLowerCase().includes(busca.toLowerCase()));

    // Atualiza badge total
    document.getElementById('sos-count').textContent = lista.filter(i => i.status !== 'saudavel').length;

    // Ordena: crítico > alerta > saudável > dias
    lista.sort((a, b) => {
        const ordem = { critico: 0, alerta: 1, saudavel: 2 };
        if (ordem[a.status] !== ordem[b.status]) return ordem[a.status] - ordem[b.status];
        return b.diasSemPostar - a.diasSemPostar;
    });

    // Agrupa
    const grupos = { critico: [], alerta: [], saudavel: [] };
    lista.forEach(i => grupos[i.status].push(i));

    const configGrupos = [
        { key: 'critico', label: 'Atenção Máxima', dot: 'dot-critico' },
        { key: 'alerta',  label: 'Alerta',         dot: 'dot-alerta'  },
        { key: 'saudavel',label: 'Saudável',        dot: 'dot-saudavel'},
    ];

    configGrupos.forEach(({ key, label, dot }) => {
        if (grupos[key].length === 0) return;

        const grupo = document.createElement('div');
        grupo.className = 'sos-group';
        grupo.innerHTML = `
            <div class="sos-group-title">
                <div class="sos-dot ${dot}"></div>
                <span class="sos-group-name">${label}</span>
                <span class="sos-group-count">${grupos[key].length}</span>
            </div>
            <div class="sos-cards" id="cards-${key}"></div>
        `;
        container.appendChild(grupo);

        const cardsContainer = grupo.querySelector(`#cards-${key}`);
        grupos[key].forEach(item => cardsContainer.appendChild(criarCard(item)));
    });
}

function criarCard({ nome, diasSemPostar, postsSemana, status, row }) {
    const card = document.createElement('div');
    card.className = `sos-card ${status}`;

    const inicial = nome.charAt(0).toUpperCase();
    const csKey   = `cs_${nome}`;
    const csChecked = localStorage.getItem(csKey) === 'true';
    const fotoUrl = urlFoto(row && row['fotos'] ? row['fotos'] : '');

    const diasLabel = diasSemPostar === 999 ? 'sem dados' : `${diasSemPostar} dias`;
    const diasClass = status === 'critico' ? 'value-danger' : status === 'alerta' ? 'value-warning' : 'value-success';

    const avatarConteudo = fotoUrl
        ? `<img src="${fotoUrl}" class="avatar-img" alt="${inicial}" onerror="this.outerHTML='${inicial}'">`
        : inicial;

    card.innerHTML = `
        <div class="card-avatar">${avatarConteudo}</div>
        <div class="card-info">
            <div class="card-name">${nome}</div>
            <div class="card-meta">Último rastreamento atualizado</div>
        </div>
        <div class="card-metrics">
            <div class="card-metric">
                <span class="card-metric-value ${diasClass}">${diasLabel}</span>
                <span class="card-metric-label">Sem postar</span>
            </div>
            <div class="card-metric">
                <span class="card-metric-value value-primary">${postsSemana}</span>
                <span class="card-metric-label">Posts/semana</span>
            </div>
        </div>
        <div class="card-cs">
            <label>Entrei em<br>contato</label>
            <input type="checkbox" class="cs-checkbox" ${csChecked ? 'checked' : ''}>
        </div>
    `;

    // Salva estado do checkbox
    card.querySelector('.cs-checkbox').addEventListener('change', e => {
        localStorage.setItem(csKey, e.target.checked);
    });

    // Clique no card abre página individual
    card.addEventListener('click', e => {
        if (e.target.classList.contains('cs-checkbox')) return;
        document.querySelector('[data-page="individual"]').click();
        setTimeout(() => {
            document.getElementById('nutricionista').value = nome;
            selecionarNutricionista(nome);
        }, 100);
    });

    return card;
}

// Filtros SOS
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('sos-filtro')?.addEventListener('change', e => {
        renderizarSOS(e.target.value, document.getElementById('sos-busca').value);
    });
    document.getElementById('sos-busca')?.addEventListener('input', e => {
        renderizarSOS(document.getElementById('sos-filtro').value, e.target.value);
    });
});

// ─── Individual ───────────────────────────────────────────────────────────────
function preencherListaNutricionistas() {
    if (!dadosPlanilha.data) return;
    const nutricionistas = [...new Set(dadosPlanilha.data.map(r => r['membros']))].filter(Boolean).sort();
    const input = document.getElementById('nutricionista');
    const list  = document.getElementById('nutricionista-list');

    input.addEventListener('focus', () => { list.style.display = 'block'; renderLista(nutricionistas); });
    input.addEventListener('input', e => {
        const f = e.target.value.toLowerCase();
        renderLista(nutricionistas.filter(n => n.toLowerCase().includes(f)));
        list.style.display = 'block';
    });
    document.addEventListener('click', e => { if (e.target !== input) list.style.display = 'none'; });
}

function renderLista(lista) {
    const list = document.getElementById('nutricionista-list');
    list.innerHTML = lista.map(n =>
        `<div class="dropdown-item" onclick="selecionarNutricionista('${n}')">${n}</div>`
    ).join('');
}

function selecionarNutricionista(nome) {
    document.getElementById('nutricionista').value = nome;
    document.getElementById('nutricionista-list').style.display = 'none';
    window.history.pushState({}, '', `?nutricionista=${encodeURIComponent(nome)}`);
    atualizarIndividual();
}

function configurarEventosIndividual() {
    document.getElementById('periodo')?.addEventListener('change', e => {
        const custom = document.getElementById('custom-dates');
        custom.style.display = e.target.value === 'custom' ? 'flex' : 'none';
        if (e.target.value !== 'custom' && document.getElementById('nutricionista').value) atualizarIndividual();
    });
    document.getElementById('aplicar-custom')?.addEventListener('click', () => {
        if (document.getElementById('nutricionista').value) atualizarIndividual();
    });
}

function atualizarIndividual() {
    const nome = document.getElementById('nutricionista').value;
    if (!nome || !dadosPlanilha.data) return;

    const dados = filtrarDados(nome);
    if (dados.length === 0) {
        document.getElementById('individual-error').textContent = 'Nenhum dado encontrado para o período.';
        document.getElementById('individual-error').style.display = 'block';
        document.getElementById('individual-content').style.display = 'none';
        return;
    }

    document.getElementById('individual-error').style.display = 'none';
    document.getElementById('individual-content').style.display = 'block';
    atualizarPerfil(nome, dados);
    atualizarGraficos(dados);
}

function filtrarDados(nome) {
    let dados = dadosPlanilha.data.filter(r => r['membros'] === nome);
    const periodo = document.getElementById('periodo').value;

    if (periodo === 'custom') {
        const inicio = new Date(document.getElementById('data-inicio').value);
        const fim    = new Date(document.getElementById('data-fim').value);
        dados = dados.filter(r => { const d = new Date(r['📅 Data']); return d >= inicio && d <= fim; });
    } else {
        const limite = new Date();
        limite.setDate(limite.getDate() - parseInt(periodo) * 7);
        dados = dados.filter(r => new Date(r['📅 Data']) >= limite);
    }

    return dados.sort((a, b) => new Date(a['📅 Data']) - new Date(b['📅 Data']));
}

function atualizarPerfil(nome, dados) {
    const inicial  = nome.charAt(0).toUpperCase();
    const fotoUrl  = urlFoto(dados[dados.length - 1]?.['fotos'] || '');
    const avatarEl = document.getElementById('ind-avatar');
    if (fotoUrl) {
        avatarEl.innerHTML = `<img src="${fotoUrl}" class="avatar-img" alt="${inicial}" onerror="this.outerHTML='${inicial}'">`;
    } else {
        avatarEl.textContent = inicial;
    }
    document.getElementById('ind-username').textContent = nome;

    const postsUnicos  = [...new Set(dados.map(r => r['📤 Último post']).filter(v => v && v !== ''))].length;
    const reelsUnicos  = [...new Set(dados.map(r => r['🎞️ Último Reel']).filter(v => v && v !== ''))].length;
    const totalStories = dados.reduce((s, r) => s + (parseInt(r['🗂️ Stories Publicados']) || 0), 0);

    let ultimoPost = null;
    dados.forEach(r => {
        if (r['📤 Último post']) {
            const d = new Date(r['📤 Último post']);
            if (!ultimoPost || d > ultimoPost) ultimoPost = d;
        }
    });

    const dias = ultimoPost ? Math.floor((new Date() - ultimoPost) / (1000 * 60 * 60 * 24)) : null;
    document.getElementById('ind-ultimo-post').textContent = dias !== null ? `Último post: há ${dias} dias` : 'Nenhum post registrado';
    document.getElementById('ind-posts').textContent   = postsUnicos;
    document.getElementById('ind-reels').textContent   = reelsUnicos;
    document.getElementById('ind-stories').textContent = totalStories;
}

// ─── Gráficos ─────────────────────────────────────────────────────────────────
function formataData(row) {
    return new Date(row['📅 Data']).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function atualizarGraficos(dados) {
    const ultimos7 = dados.slice(-7);
    const datas    = ultimos7.map(formataData);
    const posts    = ultimos7.map(r => r['📤 Último post'] === r['📅 Data'] ? 1 : 0);
    const reels    = ultimos7.map(r => r['🎞️ Último Reel'] === r['📅 Data'] ? 1 : 0);

    const totalPosts   = [...new Set(dados.map(r => r['📤 Último post']).filter(v => v && v !== ''))].length;
    const totalReels   = [...new Set(dados.map(r => r['🎞️ Último Reel']).filter(v => v && v !== ''))].length;
    const totalStories = dados.reduce((s, r) => s + (parseInt(r['🗂️ Stories Publicados']) || 0), 0);

    const datasS  = dados.map(formataData);
    const storiesD = dados.map(r => parseInt(r['🗂️ Stories Publicados']) || 0);
    const repostD  = dados.map(r => parseInt(r['🔁 Storys Repost']) || 0);

    graficoAtividade(datas, posts, reels);
    graficoPizza(totalPosts, totalReels, totalStories);
    graficoStories(datasS, storiesD, repostD);
}

// Get theme colors from CSS variables
function getChartColors() {
    const root = document.documentElement;
    const colors = {
        green: getComputedStyle(root).getPropertyValue('--color-green').trim(),
        red: getComputedStyle(root).getPropertyValue('--color-red').trim(),
        blue: getComputedStyle(root).getPropertyValue('--color-blue').trim(),
        text: getComputedStyle(root).getPropertyValue('--text').trim(),
        textMuted: getComputedStyle(root).getPropertyValue('--text-muted').trim(),
        bg: getComputedStyle(root).getPropertyValue('--bg').trim(),
        bgCard: getComputedStyle(root).getPropertyValue('--bg-card').trim()
    };
    return colors;
}

function getChartDefaults() {
    const colors = getChartColors();
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { labels: { color: colors.textMuted, font: { size: 11 }, boxWidth: 12, padding: 12 } },
            datalabels: { display: false }
        }
    };
}

function graficoAtividade(datas, posts, reels) {
    if (chartAtividade) chartAtividade.destroy();
    const colors = getChartColors();
    const somas   = datas.map((_, i) => (posts[i] || 0) + (reels[i] || 0));
    const maxEixo = Math.max(...somas, 1) + 1;

    chartAtividade = new Chart(document.getElementById('chart-atividade'), {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                { label: 'Posts', data: posts, backgroundColor: colors.green, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: true, color: colors.bg, font: { weight: 'bold', size: 8 }, anchor: 'center', align: 'center' } },
                { label: 'Reels', data: reels, backgroundColor: colors.red, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: true, color: '#fff', font: { weight: 'bold', size: 8 }, anchor: 'center', align: 'center' } }
            ]
        },
        options: {
            ...getChartDefaults(),
            scales: {
                x: { stacked: true, ticks: { color: colors.textMuted, font: { size: 10 } }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, max: maxEixo, ticks: { color: colors.textMuted, precision: 0, stepSize: 1 }, grid: { color: `rgba(${colors.textMuted === '#1a1a1a' ? '0,0,0' : '255,255,255'},0.05)` } }
            }
        }
    });
}

function graficoPizza(totalPosts, totalReels, totalStories) {
    if (chartPizza) chartPizza.destroy();
    const colors = getChartColors();
    const total = totalPosts + totalReels + totalStories;

    chartPizza = new Chart(document.getElementById('chart-pizza'), {
        type: 'doughnut',
        data: {
            labels: ['Posts', 'Reels', 'Stories'],
            datasets: [{ data: [totalPosts, totalReels, totalStories],
                backgroundColor: [colors.green, colors.red, colors.blue],
                borderColor: colors.bgCard, borderWidth: 3, hoverOffset: 8 }]
        },
        options: {
            ...getChartDefaults(),
            cutout: '62%',
            plugins: {
                ...getChartDefaults().plugins,
                datalabels: {
                    display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                    color: '#fff',
                    font: { weight: 'bold', size: 12 },
                    formatter: v => total > 0 ? ((v / total) * 100).toFixed(0) + '%' : ''
                }
            }
        }
    });
}

function graficoStories(datas, stories, repost) {
    if (chartStories) chartStories.destroy();
    const colors = getChartColors();
    const somas   = datas.map((_, i) => (stories[i] || 0) + (repost[i] || 0));
    const maxEixo = Math.max(...somas, 1) + Math.ceil(Math.max(...somas, 1) * 0.2);

    chartStories = new Chart(document.getElementById('chart-stories'), {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                { label: 'Publicados', data: stories, backgroundColor: colors.green, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: colors.bg, font: { weight: 'bold', size: 10 }, anchor: 'center', align: 'center' } },
                { label: 'Republicados', data: repost, backgroundColor: colors.red, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { weight: 'bold', size: 10 }, anchor: 'center', align: 'center' } }
            ]
        },
        options: {
            ...getChartDefaults(),
            scales: {
                x: { stacked: true, ticks: { color: colors.textMuted, font: { size: 10 } }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, max: maxEixo, ticks: { color: colors.textMuted, precision: 0, stepSize: Math.max(1, Math.ceil(maxEixo / 5)) }, grid: { color: `rgba(${colors.textMuted === '#1a1a1a' ? '0,0,0' : '255,255,255'},0.05)` } }
            }
        }
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// HAMBURGER MENU - Mobile Sidebar Toggle
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// THEME SWITCHING
// ═══════════════════════════════════════════════════════════════════════════
function initTheme() {
    const themeToggle = document.getElementById('theme-toggle');
    const savedTheme = localStorage.getItem('theme') || 'light';

    // Set initial theme
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }

    themeToggle?.addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const isDarkMode = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    updateThemeIcon(isDarkMode);
    showToast(`Tema alterado para ${isDarkMode ? 'escuro' : 'claro'}`, 'info');

    // Redraw charts with new colors
    const nutricionista = document.getElementById('nutricionista').value;
    if (nutricionista && dadosPlanilha.data) {
        setTimeout(() => atualizarIndividual(), 300);
    }
}

function updateThemeIcon(isDarkMode) {
    const icon = document.querySelector('.theme-icon');
    if (icon) icon.textContent = isDarkMode ? '☀️' : '🌙';
}

let chartsNeedRedraw = false;

// ═══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || createToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');

    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" aria-label="Fechar notificação">×</button>
    `;

    container.appendChild(toast);

    // Auto remove after duration
    const timeout = setTimeout(() => removeToast(toast), duration);

    // Manual close
    toast.querySelector('.toast-close').addEventListener('click', () => {
        clearTimeout(timeout);
        removeToast(toast);
    });

    return toast;
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Notificações');
    document.body.appendChild(container);
    return container;
}

function removeToast(toast) {
    toast.style.animation = 'slideOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
}

// ═══════════════════════════════════════════════════════════════════════════
// PDF EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
async function exportToPDF() {
    const nutricionista = document.getElementById('nutricionista').value;
    if (!nutricionista) {
        showToast('Selecione uma nutricionista para exportar', 'warning');
        return;
    }

    const element = document.getElementById('individual-content');
    if (!element || element.style.display === 'none') {
        showToast('Nenhum dado disponível para exportar', 'error');
        return;
    }

    showToast('Preparando PDF para exportar...', 'info');

    try {
        // Check if libraries are loaded
        if (typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
            showToast('Bibliotecas não carregadas. Tente novamente.', 'error');
            return;
        }

        // Create canvas from the element
        const canvas = await html2canvas(element, {
            backgroundColor: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
            scale: 2
        });

        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        // Add image to PDF with pagination
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
            position = heightLeft - imgHeight;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
            heightLeft -= pdfHeight;
        }

        pdf.save(`${nutricionista}-relatorio-${new Date().toISOString().split('T')[0]}.pdf`);
        showToast('PDF exportado com sucesso!', 'success');
    } catch (error) {
        console.error('Erro ao exportar PDF:', error);
        showToast('Erro ao exportar PDF. Tente novamente.', 'error');
    }
}

// Add export button listener if it exists
function addExportListener() {
    const exportBtn = document.getElementById('export-pdf-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToPDF);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// HAMBURGER MENU & INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    // Initialize theme
    initTheme();
    addExportListener();

    const hamburger = document.getElementById('hamburger-btn');
    const sidebar = document.getElementById('sidebar');
    const navItems = document.querySelectorAll('.nav-item');

    if (!hamburger) return;

    // Toggle hamburger
    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        sidebar.classList.toggle('open');
        document.body.classList.toggle('sidebar-open');
    });

    // Fechar sidebar ao clicar em nav item
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            hamburger.classList.remove('active');
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        });
    });

    // Fechar sidebar ao clicar fora (mobile)
    document.addEventListener('click', (e) => {
        if (window.innerWidth > 768) return;

        if (!sidebar.contains(e.target) && !hamburger.contains(e.target)) {
            hamburger.classList.remove('active');
            sidebar.classList.remove('open');
            document.body.classList.remove('sidebar-open');
        }
    });
});
