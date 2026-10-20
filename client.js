const state = {
  session: null,
  mode: 'daily',
  level: 'regular',
  view: 'game',
  archiveDate: null,
  busy: false
};

const elements = {
  gameShell: document.querySelector('.game-shell'),
  gameTitle: document.querySelector('#game-title'),
  gameDate: document.querySelector('#game-date'),
  wordLength: document.querySelector('#word-length'),
  attemptCount: document.querySelector('#attempt-count'),
  streakCount: document.querySelector('#streak-count'),
  level: document.querySelector('#level-select'),
  board: document.querySelector('#board'),
  input: document.querySelector('#guess-input'),
  form: document.querySelector('#guess-form'),
  submit: document.querySelector('.submit-button'),
  message: document.querySelector('#game-message'),
  feedback: document.querySelector('#guess-feedback'),
  help: document.querySelector('#guess-help'),
  share: document.querySelector('#share-button'),
  newPractice: document.querySelector('#new-practice-button'),
  backToday: document.querySelector('#back-to-today-button'),
  archiveDays: document.querySelector('#archive-days'),
  toast: document.querySelector('#toast')
};

let toastTimer;
let pendingGuessRequest = null;

async function requestJson(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body) headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin', cache: 'no-store' });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error?.message || 'Não foi possível concluir a solicitação.');
    error.code = payload.error?.code || 'REQUEST_FAILED';
    error.status = response.status;
    throw error;
  }
  return payload;
}

function normalizeGuess(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase('pt-BR').trim();
}

function announce(text, kind = '') {
  elements.message.textContent = text;
  elements.message.dataset.kind = kind;
}

function showToast(text) {
  elements.toast.textContent = text;
  elements.toast.classList.add('is-visible');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove('is-visible'), 2400);
}

function setBusy(busy) {
  state.busy = busy;
  elements.gameShell.dataset.loading = String(busy);
  elements.input.disabled = busy || state.session?.status !== 'active';
  elements.submit.disabled = busy || state.session?.status !== 'active';
  elements.level.disabled = busy || state.mode === 'archive' || Boolean(state.session?.attemptsUsed);
  document.querySelectorAll('.mode-button').forEach((button) => {
    button.disabled = busy;
  });
}

function formatDate(dateString, options = {}) {
  const date = new Date(`${dateString}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(date);
}

function updateNavigation(view) {
  state.view = view;
  document.querySelectorAll('.nav-button').forEach((button) => {
    const selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  document.querySelectorAll('[data-view-panel]').forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
  if (view === 'archive') loadArchive();
  if (view === 'stats') loadStats();
}

function updateSessionView() {
  const session = state.session;
  if (!session) return;
  const length = session.wordLength || 5;
  const rowsRemaining = Math.max(0, session.maxAttempts - session.guesses.length);
  elements.level.value = session.level;
  elements.wordLength.textContent = `${length} ${length === 1 ? 'letra' : 'letras'}`;
  elements.attemptCount.textContent = `${rowsRemaining} ${rowsRemaining === 1 ? 'palpite' : 'palpites'}`;
  elements.input.maxLength = length;
  elements.input.setAttribute('aria-label', `Palpite com ${length} letras`);
  elements.help.textContent = `Digite uma palavra de ${length} letras que esteja no vocabulário do jogo.`;
  elements.board.style.setProperty('--word-length', length);
  elements.board.setAttribute('aria-label', `Tabuleiro com ${session.maxAttempts} tentativas e ${length} letras por tentativa`);
  elements.gameTitle.textContent = state.mode === 'practice'
    ? 'Uma nova palavra'
    : state.mode === 'archive' ? 'Desafio anterior' : 'A palavra de hoje';
  elements.gameDate.textContent = state.mode === 'practice'
    ? 'PRÁTICA LIVRE · SEM LIMITE DIÁRIO'
    : `${formatDate(session.challengeDate, { weekday: 'long', day: '2-digit', month: 'short' }).toLocaleUpperCase('pt-BR')} · ${state.mode === 'archive' ? 'ARQUIVO' : 'DESAFIO DIÁRIO'}`;
  document.querySelector('#footer-challenge').textContent = state.mode === 'practice'
    ? 'PRÁTICA LIVRE'
    : `${state.mode === 'archive' ? 'ARQUIVO' : 'DESAFIO'} ${session.challengeDate}`;
  document.querySelectorAll('.mode-button').forEach((button) => {
    const selected = button.dataset.mode === state.mode;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  elements.newPractice.hidden = state.mode !== 'practice' || session.status === 'active';
  elements.backToday.hidden = state.mode !== 'archive';
  renderBoard();
  const latestGuess = session.guesses.at(-1);
  elements.feedback.textContent = latestGuess ? formatGuessFeedback(latestGuess) : '';

  if (session.status === 'won') {
    announce(`Boa! Você acertou em ${session.attemptsUsed} ${session.attemptsUsed === 1 ? 'palpite' : 'palpites'}.`, 'success');
  } else if (session.status === 'lost') {
    announce(`Fim de jogo. A palavra era ${session.revealedAnswer}.`);
  } else if (session.attemptsUsed > 0) {
    const remaining = session.maxAttempts - session.attemptsUsed;
    announce(`${remaining} ${remaining === 1 ? 'palpite restante' : 'palpites restantes'}.`);
  } else {
    announce(state.mode === 'practice' ? 'Prática livre: tente quantas rodadas quiser.' : 'Seu desafio está pronto.');
  }
  setBusy(state.busy);
}

function renderBoard() {
  const session = state.session;
  if (!session) return;
  const length = session.wordLength || 5;
  const fragment = document.createDocumentFragment();
  const stateLabels = {
    correct: 'posição correta',
    present: 'na palavra, em outra posição',
    absent: 'não está na palavra'
  };
  for (let rowIndex = 0; rowIndex < session.maxAttempts; rowIndex += 1) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.setAttribute('role', 'row');
    row.setAttribute('aria-label', `Palpite ${rowIndex + 1}`);
    const guess = session.guesses[rowIndex];
    for (let letterIndex = 0; letterIndex < length; letterIndex += 1) {
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('role', 'cell');
      if (guess) {
        const letter = Array.from(guess.guess)[letterIndex];
        const result = guess.feedback[letterIndex];
        tile.textContent = letter;
        tile.dataset.state = result;
        tile.setAttribute('aria-label', `${letter}, ${stateLabels[result]}`);
      } else {
        tile.setAttribute('aria-label', 'Vazio');
      }
      row.append(tile);
    }
    fragment.append(row);
  }
  elements.board.replaceChildren(fragment);
}

async function loadDaily(level = state.level) {
  setBusy(true);
  try {
    const session = await requestJson(`/api/v1/challenges/today?level=${encodeURIComponent(level)}`);
    state.session = session;
    state.mode = 'daily';
    state.archiveDate = null;
    state.level = level;
    pendingGuessRequest = null;
    updateNavigation('game');
    updateSessionView();
  } catch (error) {
    elements.level.value = state.level;
    announce(error.message, 'error');
    showToast('Confira sua conexão e tente recarregar a página.');
  } finally {
    setBusy(false);
  }
}

async function startPractice(level = state.level) {
  setBusy(true);
  try {
    const session = await requestJson('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ mode: 'practice', level })
    });
    state.session = session;
    state.mode = 'practice';
    state.archiveDate = null;
    state.level = level;
    pendingGuessRequest = null;
    updateNavigation('game');
    updateSessionView();
  } catch (error) {
    elements.level.value = state.level;
    announce(error.message, 'error');
  } finally {
    setBusy(false);
  }
}

async function openArchiveDay(date, level) {
  setBusy(true);
  try {
    const session = await requestJson('/api/v1/sessions', {
      method: 'POST',
      body: JSON.stringify({ mode: 'archive', level, date })
    });
    state.session = session;
    state.mode = 'archive';
    state.archiveDate = date;
    state.level = level;
    pendingGuessRequest = null;
    updateNavigation('game');
    updateSessionView();
  } catch (error) {
    showToast(error.message);
  } finally {
    setBusy(false);
  }
}

async function loadArchive() {
  elements.archiveDays.setAttribute('aria-busy', 'true');
  elements.archiveDays.replaceChildren(Object.assign(document.createElement('p'), {
    className: 'empty-state', textContent: 'Carregando desafios anteriores...'
  }));
  try {
    const { days } = await requestJson('/api/v1/challenges/archive');
    const fragment = document.createDocumentFragment();
    for (const day of days) {
      const row = document.createElement('article');
      row.className = 'archive-row';
      const date = document.createElement('div');
      date.className = 'archive-date';
      const title = document.createElement('strong');
      title.textContent = formatDate(day.date, { weekday: 'long', day: '2-digit', month: 'short' });
      const detail = document.createElement('small');
      detail.textContent = day.played ? 'Partida iniciada' : 'Ainda não jogado';
      date.append(title, detail);
      const levelActions = document.createElement('div');
      levelActions.className = 'archive-levels';
      for (const [level, label] of Object.entries({ leve: 'Leve', regular: 'Regular', afiado: 'Afiado' })) {
        const result = day.levels.find((entry) => entry.level === level);
        const status = result?.archiveStatus === 'active' ? 'Continuar arquivo'
          : result?.archiveStatus === 'won' ? 'Arquivo: vitória'
            : result?.archiveStatus === 'lost' ? 'Arquivo: derrota'
              : result?.dailyStatus === 'won' ? 'Diário: vitória'
                : result?.dailyStatus === 'lost' ? 'Diário: derrota'
                  : result?.dailyStatus === 'active' ? 'Desafio em andamento' : 'Jogar';
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'archive-level';
        button.setAttribute('aria-label', `${formatDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}, nível ${label}: ${status}`);
        const levelName = document.createElement('strong');
        levelName.textContent = label;
        const resultName = document.createElement('small');
        resultName.textContent = status;
        button.append(levelName, resultName);
        button.addEventListener('click', () => openArchiveDay(day.date, level));
        levelActions.append(button);
      }
      row.append(date, levelActions);
      fragment.append(row);
    }
    elements.archiveDays.replaceChildren(fragment);
  } catch (error) {
    elements.archiveDays.replaceChildren(Object.assign(document.createElement('p'), {
      className: 'empty-state', textContent: error.message
    }));
  } finally {
    elements.archiveDays.setAttribute('aria-busy', 'false');
  }
}

async function loadStats() {
  try {
    const stats = await requestJson('/api/v1/stats');
    document.querySelector('#stat-played').textContent = stats.played;
    document.querySelector('#stat-winrate').textContent = `${stats.winRate}%`;
    document.querySelector('#stat-streak').textContent = stats.currentStreak;
    document.querySelector('#stat-best-streak').textContent = stats.bestStreak;
    document.querySelector('#stat-average').textContent = stats.averageWinningAttempts === null
      ? '—'
      : stats.averageWinningAttempts.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
    elements.streakCount.textContent = `${stats.currentStreak} ${stats.currentStreak === 1 ? 'dia' : 'dias'}`;

    const bars = document.querySelector('#distribution-bars');
    const max = Math.max(...stats.winsByAttempt, 1);
    const fragment = document.createDocumentFragment();
    stats.winsByAttempt.forEach((count, index) => {
      const row = document.createElement('div');
      row.className = 'bar-row';
      const attempt = document.createElement('span');
      attempt.textContent = String(index + 1);
      attempt.setAttribute('aria-label', `${index + 1} palpites`);
      const track = document.createElement('div');
      track.className = 'bar-track';
      const fill = document.createElement('div');
      fill.className = 'bar-fill';
      fill.style.width = count ? `${Math.max(count / max * 100, 8)}%` : '0%';
      fill.textContent = count ? String(count) : '';
      track.append(fill);
      const value = document.createElement('span');
      value.textContent = String(count);
      value.setAttribute('aria-label', `${count} vitórias`);
      row.append(attempt, track, value);
      fragment.append(row);
    });
    bars.replaceChildren(fragment);
  } catch (error) {
    showToast(`Estatísticas indisponíveis: ${error.message}`);
  }
}

function guessErrorMessage(error) {
  if (error.code === 'WORD_NOT_ALLOWED') return 'Essa palavra não está no vocabulário do jogo. Tente outra.';
  if (error.code === 'GAME_FINISHED') return 'Essa partida já terminou.';
  if (error.code === 'RATE_LIMITED') return 'Muitas tentativas em sequência. Aguarde um instante.';
  return error.message;
}

function formatGuessFeedback(guess) {
  const labels = {
    correct: 'posição correta',
    present: 'presente em outra posição',
    absent: 'ausente'
  };
  const details = Array.from(guess.guess).map((letter, index) => `${letter}: ${labels[guess.feedback[index]]}`);
  return `Resultado do palpite ${guess.guess}. ${details.join('; ')}.`;
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.session || state.session.status !== 'active' || state.busy) return;
  const guess = normalizeGuess(elements.input.value);
  const length = state.session.wordLength || 5;
  if (Array.from(guess).length !== length || !/^[A-Z]+$/.test(guess)) {
    announce(`Digite uma palavra com exatamente ${length} letras.`, 'error');
    elements.input.focus();
    return;
  }

  setBusy(true);
  if (pendingGuessRequest?.guess !== guess || pendingGuessRequest?.sessionId !== state.session.sessionId) {
    pendingGuessRequest = { guess, sessionId: state.session.sessionId, key: crypto.randomUUID() };
  }
  try {
    const result = await requestJson(`/api/v1/sessions/${state.session.sessionId}/guesses`, {
      method: 'POST',
      headers: { 'Idempotency-Key': pendingGuessRequest.key },
      body: JSON.stringify({ guess })
    });
    state.session = result;
    pendingGuessRequest = null;
    elements.input.value = '';
    updateSessionView();
    if (result.status !== 'active' && state.mode === 'daily') loadStats();
    if (result.status === 'active') elements.input.focus();
  } catch (error) {
    if (error.status && error.status < 500) pendingGuessRequest = null;
    announce(guessErrorMessage(error), 'error');
    elements.input.focus();
  } finally {
    setBusy(false);
  }
});

document.querySelectorAll('.mode-button').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.mode === 'daily') loadDaily();
    if (button.dataset.mode === 'practice') startPractice();
  });
});

document.querySelectorAll('.nav-button').forEach((button) => {
  button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view === 'game' && state.mode === 'archive') {
      loadDaily();
      return;
    }
    updateNavigation(view);
  });
});

elements.level.addEventListener('change', async (event) => {
  if (state.session?.attemptsUsed > 0 || state.mode === 'archive') {
    event.target.value = state.level;
    showToast('O nível fica fixo depois do primeiro palpite.');
    return;
  }
  const nextLevel = event.target.value;
  const previousLevel = state.level;
  if (state.mode === 'practice') await startPractice(nextLevel);
  else await loadDaily(nextLevel);
  if (state.level === previousLevel) event.target.value = previousLevel;
});

elements.newPractice.addEventListener('click', startPractice);
elements.backToday.addEventListener('click', loadDaily);

elements.share.addEventListener('click', async () => {
  const session = state.session;
  if (!session || session.status === 'active') {
    showToast('Conclua a partida para compartilhar o resultado.');
    return;
  }
  const score = session.status === 'won' ? session.attemptsUsed : 'X';
  const emoji = { correct: '🟩', present: '🟨', absent: '⬛' };
  const summary = session.guesses.map((guess) => guess.feedback.map((letter) => emoji[letter]).join('')).join('\n');
  try {
    await navigator.clipboard.writeText(`Entrelinhas ${score}/${session.maxAttempts}\n${summary}`);
    showToast('Resultado copiado sem revelar a palavra.');
  } catch {
    showToast('Não foi possível copiar neste navegador.');
  }
});

elements.level.value = state.level;
async function initializeGame() {
  const loadVisitorState = async () => {
    await loadDaily();
    if (state.session) await loadStats();
  };
  if (navigator.locks?.request) {
    await navigator.locks.request('entrelinhas-visitor-bootstrap', loadVisitorState);
  } else {
    await loadVisitorState();
  }
}
initializeGame();
