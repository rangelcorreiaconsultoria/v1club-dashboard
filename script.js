Chart.register(ChartDataLabels);

const API_URL = 'https://script.google.com/macros/s/AKfycbwW56AajbBpeTAHLw_e6GPf_36j-NlYg_NU6gUB8e-5zZzNE5ExhrGmcTCOr2mGrrqc2A/exec';

let dadosPlanilha = {};
let chartAtividade, chartPizza, chartEngajamento, chartStories;

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
    const fotoUrl = row && row['foto'] ? row['foto'] : '';

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
    const fotoUrl  = dados[dados.length - 1]?.['foto'] || '';
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

    const datasEng = [], valEng = [];
    dados.forEach(r => {
        const pub = parseInt(r['🗂️ Stories Publicados']) || 0;
        const rep = parseInt(r['🔁 Storys Repost']) || 0;
        if (pub > 0) { datasEng.push(formataData(r)); valEng.push(Math.round((rep / pub) * 100)); }
    });

    const datasS  = dados.map(formataData);
    const storiesD = dados.map(r => parseInt(r['🗂️ Stories Publicados']) || 0);
    const repostD  = dados.map(r => parseInt(r['🔁 Storys Repost']) || 0);

    graficoAtividade(datas, posts, reels);
    graficoPizza(totalPosts, totalReels, totalStories);
    graficoEngajamento(datasEng, valEng);
    graficoStories(datasS, storiesD, repostD);
}

const CORES = { primary: '#eab308', dark: '#ca8a04', black: '#000000' };

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
        legend: { labels: { color: '#888', font: { size: 11 }, boxWidth: 12, padding: 12 } },
        datalabels: { display: false }
    }
};

function graficoAtividade(datas, posts, reels) {
    if (chartAtividade) chartAtividade.destroy();
    const somas   = datas.map((_, i) => (posts[i] || 0) + (reels[i] || 0));
    const maxEixo = Math.max(...somas, 1) + 1;

    chartAtividade = new Chart(document.getElementById('chart-atividade'), {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                { label: 'Posts', data: posts, backgroundColor: CORES.primary, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: true, color: '#000', font: { weight: 'bold', size: 8 }, anchor: 'center', align: 'center' } },
                { label: 'Reels', data: reels, backgroundColor: CORES.black, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: true, color: '#fff', font: { weight: 'bold', size: 8 }, anchor: 'center', align: 'center' } }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                x: { stacked: true, ticks: { color: '#666', font: { size: 10 } }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, max: maxEixo, ticks: { color: '#666', precision: 0, stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function graficoPizza(totalPosts, totalReels, totalStories) {
    if (chartPizza) chartPizza.destroy();
    const total = totalPosts + totalReels + totalStories;

    chartPizza = new Chart(document.getElementById('chart-pizza'), {
        type: 'doughnut',
        data: {
            labels: ['Posts', 'Reels', 'Stories'],
            datasets: [{ data: [totalPosts, totalReels, totalStories],
                backgroundColor: [CORES.primary, CORES.black, CORES.dark],
                borderColor: '#1a1a1a', borderWidth: 3, hoverOffset: 8 }]
        },
        options: {
            ...chartDefaults,
            cutout: '62%',
            plugins: {
                ...chartDefaults.plugins,
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

function graficoEngajamento(datas, valores) {
    if (chartEngajamento) chartEngajamento.destroy();

    chartEngajamento = new Chart(document.getElementById('chart-engajamento'), {
        type: 'line',
        data: {
            labels: datas,
            datasets: [{ label: '% Republicados', data: valores,
                borderColor: CORES.primary, backgroundColor: 'rgba(234,179,8,0.08)',
                pointRadius: 0, tension: 0.4, fill: true, borderWidth: 2 }]
        },
        options: {
            ...chartDefaults,
            layout: { padding: { top: 24 } },
            plugins: {
                ...chartDefaults.plugins,
                datalabels: {
                    display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                    color: '#888', font: { weight: 'bold', size: 10 },
                    anchor: 'center', align: 'top', offset: 6,
                    formatter: v => v + '%'
                }
            },
            scales: {
                x: { ticks: { color: '#666', font: { size: 10 } }, grid: { display: false } },
                y: { beginAtZero: true, max: 100, ticks: { color: '#666', callback: v => v + '%', stepSize: 25 }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}

function graficoStories(datas, stories, repost) {
    if (chartStories) chartStories.destroy();
    const somas   = datas.map((_, i) => (stories[i] || 0) + (repost[i] || 0));
    const maxEixo = Math.max(...somas, 1) + Math.ceil(Math.max(...somas, 1) * 0.2);

    chartStories = new Chart(document.getElementById('chart-stories'), {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                { label: 'Publicados', data: stories, backgroundColor: CORES.primary, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#000', font: { weight: 'bold', size: 10 }, anchor: 'center', align: 'center' } },
                { label: 'Republicados', data: repost, backgroundColor: CORES.black, borderRadius: 0, borderSkipped: false,
                  datalabels: { display: ctx => ctx.dataset.data[ctx.dataIndex] > 0, color: '#fff', font: { weight: 'bold', size: 10 }, anchor: 'center', align: 'center' } }
            ]
        },
        options: {
            ...chartDefaults,
            scales: {
                x: { stacked: true, ticks: { color: '#666', font: { size: 10 } }, grid: { display: false } },
                y: { stacked: true, beginAtZero: true, max: maxEixo, ticks: { color: '#666', precision: 0, stepSize: Math.max(1, Math.ceil(maxEixo / 5)) }, grid: { color: 'rgba(255,255,255,0.05)' } }
            }
        }
    });
}
