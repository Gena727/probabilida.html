// --- Global State ---
let currentData = [];
let mainChart = null;
let currentChartType = 'histogram';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    // Bind Buttons
    document.getElementById('btn-process-manual').addEventListener('click', processManualData);
    document.getElementById('btn-generate-random').addEventListener('click', generateRandomData);
    document.getElementById('btn-clear').addEventListener('click', clearAll);
    
    // Initialize empty chart
    initChart();
});

// --- Data Input Logic ---
function processManualData() {
    const rawValue = document.getElementById('manual-data').value;
    const data = rawValue.split(',')
        .map(n => parseFloat(n.trim()))
        .filter(n => !isNaN(n));

    if (data.length < 20) {
        alert("Por favor ingrese al menos 20 datos numéricos.");
        return;
    }
    updateApp(data);
}

function generateRandomData() {
    const data = Array.from({ length: 20 }, () => Math.floor(Math.random() * 100));
    document.getElementById('manual-data').value = data.join(', ');
    updateApp(data);
}

function clearAll() {
    currentData = [];
    document.getElementById('manual-data').value = '';
    document.getElementById('stats-output').innerHTML = '<p>Esperando datos...</p>';
    document.querySelector('#frequency-table tbody').innerHTML = '';
    if (mainChart) mainChart.destroy();
    initChart();
}

// --- Main Update Flow ---
function updateApp(data) {
    currentData = data.sort((a, b) => a - b);
    renderStats();
    const freqTable = calculateFrequencyTable(currentData);
    renderFrequencyTable(freqTable);
    updateVisualizations(freqTable);
}

// --- Math Functions ---
function calculateStats(data) {
    const n = data.length;
    const sum = data.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    
    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? data[mid] : (data[mid - 1] + data[mid]) / 2;
    
    const counts = {};
    data.forEach(x => counts[x] = (counts[x] || 0) + 1);
    let maxFreq = 0;
    let mode = [];
    for (let key in counts) {
        if (counts[key] > maxFreq) {
            maxFreq = counts[key];
            mode = [key];
        } else if (counts[key] === maxFreq) {
            mode.push(key);
        }
    }
    
    const min = data[0];
    const max = data[n - 1];
    const range = max - min;

    return { mean, median, mode: mode.join(', '), min, max, range };
}

function renderStats() {
    const stats = calculateStats(currentData);
    const container = document.getElementById('stats-output');
    container.innerHTML = `
        <p><strong>Media:</strong> ${stats.mean.toFixed(2)}</p>
        <p><strong>Mediana:</strong> ${stats.median}</p>
        <p><strong>Moda:</strong> ${stats.mode}</p>
        <p><strong>Mínimo:</strong> ${stats.min}</p>
        <p><strong>Máximo:</strong> ${stats.max}</p>
        <p><strong>Rango:</strong> ${stats.range}</p>
    `;
}

// --- Frequency Table Logic ---
function calculateFrequencyTable(data) {
    const n = data.length;
    const min = data[0];
    const max = data[n - 1];
    const k = Math.ceil(1 + 3.322 * Math.log10(n)); // Sturges
    const range = max - min;
    const amplitude = range / k;
    
    let intervals = [];
    let fi = [];
    let Fi = [];
    let fr = [];
    let Fr = [];
    
    let currentFi = 0;
    let currentFr = 0;

    for (let i = 0; i < k; i++) {
        let lower = min + (i * amplitude);
        let upper = lower + amplitude;
        intervals.push(`${lower.toFixed(1)} - ${upper.toFixed(1)}`);
        
        let count = data.filter(x => (i === k - 1) ? (x >= lower && x <= upper) : (x >= lower && x < upper)).length;
        fi.push(count);
        
        currentFi += count;
        Fi.push(currentFi);
        
        let rel = count / n;
        fr.push(rel);
        
        currentFr += rel;
        Fr.push(currentFr);
    }

    return { intervals, fi, Fi, fr, Fr };
}

function renderFrequencyTable(table) {
    const tbody = document.querySelector('#frequency-table tbody');
    tbody.innerHTML = '';
    table.intervals.forEach((interval, i) => {
        const row = `<tr>
            <td>${interval}</td>
            <td>${table.fi[i]}</td>
            <td>${table.fr[i].toFixed(3)}</td>
            <td>${table.Fi[i]}</td>
            <td>${table.Fr[i].toFixed(3)}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

// --- Charting Logic ---
function initChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');
    mainChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: [], datasets: [] },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function showChart(type) {
    currentChartType = type;
    document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    if (currentData.length > 0) {
        updateVisualizations(calculateFrequencyTable(currentData));
    }
}

function updateVisualizations(table) {
    if (!mainChart) return;

    let config = {};
    
    if (currentChartType === 'histogram') {
        config = {
            labels: table.intervals,
            datasets: [
                {
                    label: 'Frecuencia (fi) - Histograma',
                    data: table.fi,
                    backgroundColor: 'rgba(74, 144, 226, 0.5)',
                    borderColor: 'rgba(74, 144, 226, 1)',
                    borderWidth: 1,
                    type: 'bar',
                    barPercentage: 1,
                    categoryPercentage: 1
                },
                {
                    label: 'Polígono de Frecuencias',
                    data: table.fi,
                    borderColor: 'rgba(80, 227, 194, 1)',
                    backgroundColor: 'transparent',
                    type: 'line',
                    tension: 0.1
                }
            ]
        };
    } else if (currentChartType === 'ojiva') {
        config = {
            labels: table.intervals,
            datasets: [{
                label: 'Frecuencia Acumulada (Fi) - Ojiva',
                data: table.Fi,
                borderColor: '#ff4757',
                backgroundColor: 'rgba(255, 71, 87, 0.1)',
                fill: true,
                type: 'line',
                tension: 0.3
            }]
        };
    } else if (currentChartType === 'pareto') {
        // Pareto require sorted data by frequency
        let paretoData = table.intervals.map((label, i) => ({ label, val: table.fi[i] }))
            .sort((a, b) => b.val - a.val);
        
        let sortedLabels = paretoData.map(d => d.label);
        let sortedFi = paretoData.map(d => d.val);
        let cumSum = 0;
        let total = sortedFi.reduce((a,b) => a+b, 0);
        let sortedFrAcum = sortedFi.map(v => {
            cumSum += v;
            return (cumSum / total) * 100;
        });

        config = {
            labels: sortedLabels,
            datasets: [
                {
                    label: 'Frecuencia',
                    data: sortedFi,
                    backgroundColor: 'rgba(74, 144, 226, 0.7)',
                    yAxisID: 'y'
                },
                {
                    label: '% Acumulado',
                    data: sortedFrAcum,
                    borderColor: '#ff4757',
                    type: 'line',
                    yAxisID: 'y1'
                }
            ]
        };
    }

    mainChart.data = config;
    mainChart.options.scales = (currentChartType === 'pareto') ? {
        y: { type: 'linear', position: 'left' },
        y1: { type: 'linear', position: 'right', max: 100, grid: { drawOnChartArea: false } }
    } : { y: { beginAtZero: true } };
    
    mainChart.update();
}

// --- Sets Logic ---
function calculateSets() {
    const setA = new Set(document.getElementById('set-a').value.split(',').map(s => s.trim()));
    const setB = new Set(document.getElementById('set-b').value.split(',').map(s => s.trim()));
    
    const union = new Set([...setA, ...setB]);
    const intersection = new Set([...setA].filter(x => setB.has(x)));
    const diffAB = new Set([...setA].filter(x => !setB.has(x)));

    document.getElementById('set-results').innerHTML = `
        A ∪ B: {${[...union].join(', ')}}<br>
        A ∩ B: {${[...intersection].join(', ')}}<br>
        A - B: {${[...diffAB].join(', ')}}
    `;
}

// --- Combinatorics Logic ---
const factorial = (n) => (n <= 1) ? 1 : n * factorial(n - 1);

function calculatePerm() {
    const n = parseInt(document.getElementById('comb-n').value);
    const r = parseInt(document.getElementById('comb-r').value);
    if (isNaN(n) || isNaN(r) || n < r) return alert("Datos inválidos");
    const result = factorial(n) / factorial(n - r);
    document.getElementById('comb-results').innerText = `nPr = ${result.toLocaleString()}`;
}

function calculateComb() {
    const n = parseInt(document.getElementById('comb-n').value);
    const r = parseInt(document.getElementById('comb-r').value);
    if (isNaN(n) || isNaN(r) || n < r) return alert("Datos inválidos");
    const result = factorial(n) / (factorial(r) * factorial(n - r));
    document.getElementById('comb-results').innerText = `nCr = ${result.toLocaleString()}`;
}

function calculateBasicProb() {
    const fav = parseInt(document.getElementById('prob-fav').value);
    const total = parseInt(document.getElementById('prob-total').value);
    if (isNaN(fav) || isNaN(total) || total === 0) return;
    const p = (fav / total) * 100;
    document.getElementById('prob-result').innerText = `P(A) = ${p.toFixed(2)}%`;
}

// --- Tree Diagram Sim ---
function generateTreeText() {
    const stages = document.getElementById('tree-stages').value.split(',').map(Number);
    let output = "Raíz\n";
    
    function buildBranch(prefix, stageIdx) {
        if (stageIdx >= stages.length) return;
        const branches = stages[stageIdx];
        for (let i = 1; i <= branches; i++) {
            const line = prefix + "└── Opcion " + i + "\n";
            output += line;
            buildBranch(prefix + "    ", stageIdx + 1);
        }
    }
    
    buildBranch("", 0);
    document.getElementById('tree-output').innerText = output;
}
