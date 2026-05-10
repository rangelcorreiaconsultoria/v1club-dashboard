Chart.register(ChartDataLabels);

const API_URL = 'https://script.google.com/macros/s/AKfycbwW56AajbBpeTAHLw_e6GPf_36j-NlYg_NU6gUB8e-5zZzNE5ExhrGmcTCOr2mGrrqc2A/exec';

let dadosPlanilha = {};
let nutricionistaSelecionado = null;
let periodoSelecionado = 4;

const nutricionistaInput = document.getElementById('nutricionista');
const nutricionistaList  = document.getElementById('nutricionista-list');
const periodoSelect      = document.getElementById('periodo');
const customDatesDiv     = document.getElementById('custom-dates');
const dataInicio         = document.getElementById('data-inicio');
const dataFim            = document.getElementById('data-fim');
const aplicarCustomBtn   = document.getElementById('aplicar-custom');
const loadingDiv         = document.getElementById('loading');
const errorDiv           = document.getElementById('error');

let chartAtividade, chartPizza, chartEngajamento, chartStories;

document.addEventListener('DOMContentLoaded', () => {
    carregarDados();
    configurarEventos();
});

async function carregarDados() {
    loadingDiv.style.display = 'block';
    errorDiv.style.display = 'none';
    try {
        const response = await fetch(API_URL);
        const data = await response.json();
        dadosPlanilha = data.data.BaseDeDatos;
        preencherListaNutricionistas();
        const params = new URLSearchParams(window.location.search);
        const nutriParams = params.get('nutricionista');
        if (nutriParams) selecionarNutricionista(decodeURIComponent(nutriParams));
        loadingDiv.style.display = 'none';
    } catch (error) {
        errorDiv.textContent = 'Erro ao carregar dados: ' + error.message;
        errorDiv.style.display = 'block';
        loadingDiv.style.display = 'none';
    }
}

function preencherListaNutricionistas() {
    const nutricionistas = [...new Set(dadosPlanilha.data.map(r => r['membros']))].filter(Boolean).sort();

    nutricionistaInput.addEventListener('focus', () => {
        nutricionistaList.style.display = 'block';
        renderizarLista(nutricionistas);
    });

    nutricionistaInput.addEventListener('input', e => {
        const filtro = e.target.value.toLowerCase();
        renderizarLista(nutricionistas.filter(n => n.toLowerCase().includes(filtro)));
        nutricionistaList.style.display = 'block';
    });

    document.addEventListener('click', e => {
        if (e.target !== nutricionistaInput) nutricionistaList.style.display = 'none';
    });
}

function renderizarLista(lista) {
    nutricionistaList.innerHTML = lista
        .map(n => `<div class="nutricionista-item" onclick="selecionarNutricionista('${n}')">${n}</div>`)
        .join('');
}

function selecionarNutricionista(nome) {
    nutricionistaInput.value = nome;
    nutricionistaSelecionado = nome;
    nutricionistaList.style.display = 'none';
    window.history.pushState({}, '', `?nutricionista=${encodeURIComponent(nome)}`);
    atualizarDashboard();
}

function configurarEventos() {
    periodoSelect.addEventListener('change', e => {
        if (e.target.value === 'custom') {
            customDatesDiv.style.display = 'flex';
        } else {
            customDatesDiv.style.display = 'none';
            periodoSelecionado = parseInt(e.target.value);
            if (nutricionistaSelecionado) atualizarDashboard();
        }
    });

    aplicarCustomBtn.addEventListener('click', () => {
        if (dataInicio.value && dataFim.value && nutricionistaSelecionado) atualizarDashboard();
    });
}

function atualizarDashboard() {
    errorDiv.style.display = 'none';
    const dados = filtrarDados();

    if (dados.length === 0) {
        errorDiv.textContent = 'Nenhum dado encontrado para o período selecionado.';
        errorDiv.style.display = 'block';
        document.getElementById('charts-grid').style.display = 'none';
        return;
    }

    atualizarMetricas(dados);
    atualizarGraficos(dados);
    document.getElementById('charts-grid').style.display = 'grid';
}

function filtrarDados() {
    let dados = dadosPlanilha.data.filter(r => r['membros'] === nutricionistaInput.value);

    if (periodoSelect.value === 'custom') {
        const inicio = new Date(dataInicio.value);
        const fim    = new Date(dataFim.value);
        dados = dados.filter(r => {
            const d = new Date(r['📅 Data']);
            return d >= inicio && d <= fim;
        });
    } else {
        const diasAtras  = periodoSelecionado * 7;
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - diasAtras);
        dados = dados.filter(r => new Date(r['📅 Data']) >= dataLimite);
    }

    return dados.sort((a, b) => new Date(a['📅 Data']) - new Date(b['📅 Data']));
}

function atualizarMetricas(dados) {
    const postsUnicos  = [...new Set(dados.map(r => r['📤 Último post']).filter(v => v && v !== ''))].length;
    const reelsUnicos  = [...new Set(dados.map(r => r['🎞️ Último Reel']).filter(v => v && v !== ''))].length;
    const totalStories = dados.reduce((s, r) => s + (parseInt(r['🗂️ Stories Publicados']) || 0), 0);

    let ultimoPost = null;
    dados.forEach(r => {
        if (r['📤 Último post'] && r['📤 Último post'] !== '') {
            const d = new Date(r['📤 Último post']);
            if (!ultimoPost || d > ultimoPost) ultimoPost = d;
        }
    });

    const diasInativo = ultimoPost
        ? Math.floor((new Date() - ultimoPost) / (1000 * 60 * 60 * 24))
        : null;

    document.getElementById('username').textContent   = nutricionistaInput.value;
    document.getElementById('stat-posts').textContent  = postsUnicos;
    document.getElementById('stat-reels').textContent  = reelsUnicos;
    document.getElementById('stat-stories').textContent = totalStories;
    document.getElementById('info-dias').textContent   = diasInativo !== null
        ? `Último post: há ${diasInativo} dias`
        : 'Nenhum post registrado';
}

function formataData(row) {
    return new Date(row['📅 Data']).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
}

function atualizarGraficos(dados) {
    // Atividade: últimos 7, apenas Posts e Reels com data igual à data de rastreamento
    const dadosAtividade = dados.slice(-7);
    const datas = dadosAtividade.map(formataData);
    const posts = dadosAtividade.map(r => r['📤 Último post'] === r['📅 Data'] ? 1 : 0);
    const reels = dadosAtividade.map(r => r['🎞️ Último Reel'] === r['📅 Data'] ? 1 : 0);

    // Pizza: contagem única de datas e soma de stories
    const totalPosts   = [...new Set(dados.map(r => r['📤 Último post']).filter(v => v && v !== ''))].length;
    const totalReels   = [...new Set(dados.map(r => r['🎞️ Último Reel']).filter(v => v && v !== ''))].length;
    const totalStories = dados.reduce((s, r) => s + (parseInt(r['🗂️ Stories Publicados']) || 0), 0);

    // Engajamento: apenas entradas com stories publicados > 0
    const datasEng = [], valoresEng = [];
    dados.forEach(r => {
        const pub = parseInt(r['🗂️ Stories Publicados']) || 0;
        const rep = parseInt(r['🔁 Storys Repost']) || 0;
        if (pub > 0) {
            datasEng.push(formataData(r));
            valoresEng.push(Math.round((rep / pub) * 100));
        }
    });

    // Stories: todos os dados do período
    const datasStories  = dados.map(formataData);
    const storiesTodos  = dados.map(r => parseInt(r['🗂️ Stories Publicados']) || 0);
    const repostTodos   = dados.map(r => parseInt(r['🔁 Storys Repost']) || 0);

    criarGraficoAtividade(datas, posts, reels);
    criarGraficoPizza(totalPosts, totalReels, totalStories);
    criarGraficoEngajamento(datasEng, valoresEng);
    criarGraficoBarrasStories(datasStories, storiesTodos, repostTodos);
}

function ehMobile() {
    return window.innerWidth < 768;
}

function opcoesBase(extra = {}) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        layout: {
            padding: { top: 28, right: 16, bottom: 8, left: 8 }
        },
        plugins: {
            legend: {
                labels: { color: '#262626', font: { size: 11 }, boxWidth: 12, padding: 12 }
            },
            ...extra
        }
    };
}

function criarGraficoAtividade(datas, posts, reels) {
    const ctx = document.getElementById('linha-atividade').getContext('2d');
    if (chartAtividade) chartAtividade.destroy();

    const somasPorColuna = datas.map((_, i) => (Number(posts[i]) || 0) + (Number(reels[i]) || 0));
    const maxSoma   = Math.max(...somasPorColuna, 1);
    const maxEixoY  = maxSoma + Math.ceil(maxSoma * 0.4);

    chartAtividade = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                {
                    label: 'Posts',
                    data: posts,
                    backgroundColor: '#eab308',
                    borderRadius: 0,
                    borderSkipped: false,
                    datalabels: {
                        display: true,
                        color: 'white',
                        font: { weight: 'bold', size: 7 },
                        anchor: 'center',
                        align: 'center',
                        clamp: false,
                        clip: false
                    }
                },
                {
                    label: 'Reels',
                    data: reels,
                    backgroundColor: '#000000',
                    borderRadius: 0,
                    borderSkipped: false,
                    datalabels: {
                        display: true,
                        color: 'white',
                        font: { weight: 'bold', size: 7 },
                        anchor: 'center',
                        align: 'center',
                        clamp: false,
                        clip: false
                    }
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            clip: false,
            layout: { padding: { top: 20, right: 16, bottom: 8, left: 8 } },
            plugins: {
                legend: {
                    labels: { color: '#262626', font: { size: 11 }, boxWidth: 12, padding: 12 }
                },
                datalabels: { display: true }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#8e8e8e' }, grid: { display: false } },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: maxEixoY,
                    ticks: { color: '#8e8e8e', precision: 0, stepSize: Math.max(1, Math.ceil(maxEixoY / 5)) },
                    grid: { color: '#f0f0f0' }
                }
            }
        }
    });
}

function criarGraficoPizza(totalPosts, totalReels, totalStories) {
    const ctx = document.getElementById('pizza-conteudo').getContext('2d');
    if (chartPizza) chartPizza.destroy();

    const total    = totalPosts + totalReels + totalStories;
    const fontSize = ehMobile() ? 10 : 12;

    chartPizza = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Posts', 'Reels', 'Stories'],
            datasets: [{
                data: [totalPosts, totalReels, totalStories],
                backgroundColor: ['#eab308', '#000000', '#ca8a04'],
                borderColor: 'white',
                borderWidth: 3,
                hoverOffset: 8
            }]
        },
        options: {
            ...opcoesBase({
                datalabels: {
                    display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                    color: 'white',
                    font: { weight: 'bold', size: fontSize },
                    formatter: value => total > 0 ? ((value / total) * 100).toFixed(0) + '%' : '0%'
                }
            }),
            cutout: '60%'
        }
    });
}

function criarGraficoEngajamento(datas, engajamento) {
    const ctx = document.getElementById('engajamento-stories').getContext('2d');
    if (chartEngajamento) chartEngajamento.destroy();

    const fontSize = ehMobile() ? 10 : 12;

    chartEngajamento = new Chart(ctx, {
        type: 'line',
        data: {
            labels: datas,
            datasets: [{
                label: '% Republicados',
                data: engajamento,
                borderColor: '#eab308',
                backgroundColor: 'rgba(234, 179, 8, 0.1)',
                pointRadius: 0,
                pointHoverRadius: 0,
                tension: 0.4,
                fill: true,
                borderWidth: 2
            }]
        },
        options: {
            ...opcoesBase({
                legend: {
                    position: 'top',
                    labels: { color: '#262626', font: { size: 11 }, boxWidth: 12, padding: 16 }
                },
                datalabels: {
                    display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                    color: '#262626',
                    font: { weight: 'bold', size: fontSize },
                    anchor: 'center',
                    align: 'top',
                    offset: 8,
                    formatter: v => v + '%',
                    clamp: true,
                    clip: false
                }
            }),
            layout: { padding: { top: 40, right: 16, bottom: 8, left: 8 } },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { color: '#8e8e8e', callback: v => v + '%', stepSize: 25, font: { size: 11 } },
                    grid: { color: '#f0f0f0' }
                },
                x: {
                    ticks: { color: '#8e8e8e', font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
}

function criarGraficoBarrasStories(datas, stories, repost) {
    const ctx = document.getElementById('barras-stories').getContext('2d');
    if (chartStories) chartStories.destroy();

    const somasPorColuna = datas.map((_, i) => (Number(stories[i]) || 0) + (Number(repost[i]) || 0));
    const maxSoma  = Math.max(...somasPorColuna, 1);
    const maxEixoY = maxSoma + Math.ceil(maxSoma * 0.3);

    chartStories = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: datas,
            datasets: [
                {
                    label: 'Publicados',
                    data: stories,
                    backgroundColor: '#eab308',
                    borderRadius: 0,
                    borderSkipped: false,
                    datalabels: {
                        display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: 'white',
                        font: { weight: 'bold', size: 11 },
                        anchor: 'center',
                        align: 'center',
                        clamp: true,
                        clip: false
                    }
                },
                {
                    label: 'Republicados',
                    data: repost,
                    backgroundColor: '#000000',
                    borderRadius: 0,
                    borderSkipped: false,
                    datalabels: {
                        display: ctx => ctx.dataset.data[ctx.dataIndex] > 0,
                        color: 'white',
                        font: { weight: 'bold', size: 11 },
                        anchor: 'center',
                        align: 'center',
                        clamp: true,
                        clip: false
                    }
                }
            ]
        },
        options: {
            ...opcoesBase(),
            scales: {
                x: { stacked: true, ticks: { color: '#8e8e8e', font: { size: 11 } }, grid: { display: false } },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    max: maxEixoY,
                    ticks: { color: '#8e8e8e', precision: 0, stepSize: Math.max(1, Math.ceil(maxEixoY / 5)), font: { size: 11 } },
                    grid: { color: '#f0f0f0' }
                }
            }
        }
    });
}
