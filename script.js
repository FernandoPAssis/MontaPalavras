let bancoPalavras = {};
let elementoArrastado = null;

// Web Audio API com suporte retrocompatível
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioContext ? new AudioContext() : null;

function tocarSom(frequencia, tipo, duracao) {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = tipo;
    osc.frequency.value = frequencia;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duracao);
    osc.stop(audioCtx.currentTime + duracao);
}

function somAcertoSilaba() { tocarSom(523.25, 'sine', 0.15); }
function somErro() { tocarSom(180, 'sawtooth', 0.2); }
function somVitoria() {
    const notas = [261.63, 329.63, 392.00, 523.25];
    notas.forEach((n, i) => setTimeout(() => tocarSom(n, 'triangle', 0.25), i * 120));
}

function falarPalavra(texto) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        // Remove sufixos numéricos de teste (ex: "BOLA_67" vira "BOLA")
        const palavraLimpa = texto.replace(/_\d+$/, '').toLowerCase();
        const utt = new SpeechSynthesisUtterance(palavraLimpa);
        utt.lang = 'pt-BR';
        utt.rate = 0.9;
        window.speechSynthesis.speak(utt);
    }
}

// Converte o array vindo do palavras.js para a estrutura chaveada { 1: [...], 2: [...] }
function processarBancoPalavras() {
    bancoPalavras = {};
    if (typeof bancoDePalavras !== 'undefined' && Array.isArray(bancoDePalavras)) {
        bancoDePalavras.forEach(item => {
            const niv = item.nivel || 1;
            if (!bancoPalavras[niv]) {
                bancoPalavras[niv] = [];
            }
            bancoPalavras[niv].push(item);
        });
    }
}

function obterPalavrasAcumuladas(nivel) {
    let palavras = [];
    for (let i = 1; i <= nivel; i++) {
        if (bancoPalavras[i]) {
            palavras = palavras.concat(bancoPalavras[i]);
        }
    }
    return palavras;
}

function embaralharArray(arr) {
    return [...arr].sort(() => Math.random() - 0.5);
}

function iniciarRodada() {
    const levelSelect = document.getElementById('levelSelect');
    const nivel = levelSelect ? parseInt(levelSelect.value) : 1;
    const container = document.getElementById('gameContainer');
    if (!container) return;

    container.innerHTML = '';

    const listaDisponivel = obterPalavrasAcumuladas(nivel);
    if (!listaDisponivel.length) return;

    const palavrasSorteadas = embaralharArray(listaDisponivel).slice(0, 3);

    palavrasSorteadas.forEach((item, index) => {
        const card = criarCardPalavra(item, index, nivel);
        container.appendChild(card);
    });
}

function criarCardPalavra(item, index, nivel) {
    const card = document.createElement('div');
    card.className = 'card';
    card.id = `card-${index}`;
    card.dataset.completo = "false";

    const emojiBox = document.createElement('div');
    emojiBox.className = 'emoji-box';

    const spanEmoji = document.createElement('span');
    spanEmoji.textContent = item.emoji;

    const btnAudio = document.createElement('button');
    btnAudio.className = 'audio-btn';
    btnAudio.title = 'Ouvir palavra';
    btnAudio.textContent = '🔊';
    btnAudio.onclick = () => falarPalavra(item.palavra);

    emojiBox.appendChild(spanEmoji);
    emojiBox.appendChild(btnAudio);
    card.appendChild(emojiBox);

    const slotsContainer = document.createElement('div');
    slotsContainer.className = 'slots-container';
    item.silabas.forEach((silaba) => {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.esperado = silaba;
        slot.dataset.cardId = index;

        slot.addEventListener('dragover', e => e.preventDefault());
        slot.addEventListener('dragenter', () => slot.classList.add('drag-over'));
        slot.addEventListener('dragleave', () => slot.classList.remove('drag-over'));
        slot.addEventListener('drop', e => tratarDrop(e, slot, item, nivel));
        slot.addEventListener('click', () => tratarCliqueSlot(slot, item, nivel));

        slotsContainer.appendChild(slot);
    });
    card.appendChild(slotsContainer);

    const pool = document.createElement('div');
    pool.className = 'syllables-pool';
    pool.id = `pool-${index}`;

    const silabasEmbaralhadas = embaralharArray(item.silabas);
    silabasEmbaralhadas.forEach((silaba, sIndex) => {
        const silabaEl = document.createElement('div');
        silabaEl.className = 'syllable';
        silabaEl.textContent = silaba;
        silabaEl.draggable = true;
        silabaEl.id = `syl-${index}-${sIndex}`;

        silabaEl.addEventListener('dragstart', e => {
            elementoArrastado = silabaEl;
            if (e.dataTransfer) {
                e.dataTransfer.setData('text/plain', silaba);
            }
        });

        silabaEl.addEventListener('click', () => {
            if (silabaEl.parentElement.classList.contains('syllables-pool')) {
                selecionarSilabaPorClique(silabaEl, index, item, nivel);
            }
        });

        pool.appendChild(silabaEl);
    });
    card.appendChild(pool);

    return card;
}

function tratarDrop(e, slot, item, nivel) {
    e.preventDefault();
    slot.classList.remove('drag-over');
    if (slot.children.length > 0) return;

    if (elementoArrastado) {
        encaixarSilaba(elementoArrastado, slot, item, nivel);
    }
}

function selecionarSilabaPorClique(silabaEl, cardIndex, item, nivel) {
    const slots = document.querySelectorAll(`#card-${cardIndex} .slot`);
    for (let i = 0; i < slots.length; i++) {
        if (slots[i].children.length === 0) {
            encaixarSilaba(silabaEl, slots[i], item, nivel);
            break;
        }
    }
}

function tratarCliqueSlot(slot, item, nivel) {
    if (slot.children.length > 0) {
        const silabaEl = slot.children[0];
        const cardIndex = slot.dataset.cardId;
        document.getElementById(`pool-${cardIndex}`).appendChild(silabaEl);
        verificarConclusaoPalavra(cardIndex, item, nivel);
    }
}

function encaixarSilaba(silabaEl, slot, item, nivel) {
    slot.appendChild(silabaEl);
    const cardIndex = slot.dataset.cardId;

    if (nivel === 1 && silabaEl.textContent === slot.dataset.esperado) {
        somAcertoSilaba();
    }

    verificarConclusaoPalavra(cardIndex, item, nivel);
}

function verificarConclusaoPalavra(cardIndex, item, nivel) {
    const card = document.getElementById(`card-${cardIndex}`);
    const slots = card.querySelectorAll('.slot');
    let palavraFormada = '';
    let preenchido = true;

    slots.forEach(slot => {
        if (slot.children.length > 0) {
            palavraFormada += slot.children[0].textContent;
        } else {
            preenchido = false;
        }
    });

    if (preenchido) {
        // Validação aceita a palavra configurada no objeto
        if (palavraFormada === item.silabas.join('')) {
            card.classList.add('correct');
            card.dataset.completo = "true";

            if (nivel > 1) somAcertoSilaba();
            falarPalavra(item.palavra);

            const todosCards = document.querySelectorAll('.card');
            const todosCompletos = Array.from(todosCards).every(c => c.dataset.completo === "true");

            if (todosCompletos) {
                setTimeout(() => {
                    somVitoria();
                    dispararConfetes();
                }, 600);
            }
        } else {
            somErro();
            card.classList.remove('correct');
            card.dataset.completo = "false";
        }
    } else {
        card.classList.remove('correct');
        card.dataset.completo = "false";
    }
}

function dispararConfetes() {
    const canvas = document.getElementById('confetti');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particulas = Array.from({ length: 80 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height - canvas.height,
        cor: `hsl(${Math.random() * 360}, 100%, 50%)`,
        tamanho: Math.random() * 8 + 4,
        velocidadeY: Math.random() * 3 + 2
    }));

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particulas.forEach(p => {
            p.y += p.velocidadeY;
            ctx.fillStyle = p.cor;
            ctx.fillRect(p.x, p.y, p.tamanho, p.tamanho);
        });

        if (particulas.some(p => p.y < canvas.height)) {
            requestAnimationFrame(render);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    render();
}

document.addEventListener('DOMContentLoaded', () => {
    const levelSelect = document.getElementById('levelSelect');
    const btnNovasPalavras = document.getElementById('btnNovasPalavras');

    if (levelSelect) levelSelect.addEventListener('change', iniciarRodada);
    if (btnNovasPalavras) btnNovasPalavras.addEventListener('click', iniciarRodada);

    processarBancoPalavras();
    iniciarRodada();
});