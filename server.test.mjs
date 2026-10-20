import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { answerWords, createApplication, createRateLimiter, evaluateGuess, gameDate, normalizeWord } from './server.mjs';

const runningServers = [];

async function startTestServer() {
  const directory = mkdtempSync(join(tmpdir(), 'entrelinhas-'));
  const server = createApplication({ databasePath: join(directory, 'test.sqlite') });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const cookie = { value: '' };
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const request = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    if (cookie.value) headers.set('cookie', cookie.value);
    const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie.value = setCookie.split(';')[0];
    return response;
  };
  runningServers.push({ server, directory });
  return { request, baseUrl };
}

afterEach(async () => {
  await Promise.all(runningServers.splice(0).map(async ({ server, directory }) => {
    await new Promise((resolve) => server.close(resolve));
    rmSync(directory, { recursive: true, force: true });
  }));
});

test('normaliza acentos sem alterar a quantidade de letras', () => {
  assert.equal(normalizeWord('  ação '), 'ACAO');
  assert.equal(Array.from(normalizeWord('maçã')).length, 4);
});

test('limita chamadas por janela e reinicia quando a janela expira', () => {
  let now = 100;
  const allowRequest = createRateLimiter(2, 1000, () => now);
  assert.equal(allowRequest('visitor'), true);
  assert.equal(allowRequest('visitor'), true);
  assert.equal(allowRequest('visitor'), false);
  now += 1000;
  assert.equal(allowRequest('visitor'), true);
});

test('limite por endereço bloqueia sessões mesmo com cookies rotacionados', async () => {
  const { baseUrl } = await startTestServer();
  for (let attempt = 0; attempt < 61; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'practice', level: 'leve' })
    });
    assert.equal(response.status, attempt < 60 ? 201 : 429);
  }
});

test('limite diário por endereço bloqueia criação de visitantes sem cookie', async () => {
  const { baseUrl } = await startTestServer();
  for (let attempt = 0; attempt < 61; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/v1/challenges/today`);
    assert.equal(response.status, attempt < 60 ? 200 : 429);
    if (attempt === 60) assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('avalia letras repetidas sem marcar ocorrências excedentes', () => {
  assert.deepEqual(evaluateGuess('LLLAA', 'ALALA'), ['present', 'correct', 'absent', 'present', 'correct']);
});

test('cria desafio diário sem expor a resposta antes do fim', async () => {
  const { request } = await startTestServer();
  const response = await request('/api/v1/challenges/today');
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.attemptsRemaining, 7);
  assert.equal(payload.status, 'active');
  assert.equal('revealedAnswer' in payload, false);
});

test('cookie malformado não derruba a rota nem impede criar visitante', async () => {
  const { request } = await startTestServer();
  const response = await request('/api/v1/challenges/today', { headers: { cookie: 'broken=%' } });
  assert.equal(response.status, 200);
  assert.ok((await response.json()).sessionId);
  assert.ok(response.headers.get('set-cookie'));
});

test('ID de sessão inexistente retorna 404 sem criar visitante', async () => {
  const { baseUrl } = await startTestServer();
  const response = await fetch(`${baseUrl}/api/v1/sessions/00000000-0000-4000-8000-000000000000`);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('set-cookie'), null);
});

test('palpite inválido e palavra não permitida não gastam tentativas', async () => {
  const { request } = await startTestServer();
  const daily = await request('/api/v1/challenges/today');
  const { sessionId } = await daily.json();
  const malformed = await request(`/api/v1/sessions/${sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guess: 'ABC' })
  });
  assert.equal(malformed.status, 400);
  assert.equal((await malformed.json()).error.code, 'INVALID_GUESS_FORMAT');
  const unknown = await request(`/api/v1/sessions/${sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guess: 'ZZZZZ' })
  });
  assert.equal(unknown.status, 422);
  const restored = await request(`/api/v1/sessions/${sessionId}`);
  assert.equal((await restored.json()).attemptsUsed, 0);
});

test('palavras fora do vocabulário também são limitadas sem gastar palpites', async () => {
  const { request } = await startTestServer();
  const daily = await (await request('/api/v1/challenges/today')).json();
  for (let attempt = 0; attempt < 41; attempt += 1) {
    const response = await request(`/api/v1/sessions/${daily.sessionId}/guesses`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ guess: 'ZZZZZ' })
    });
    assert.equal(response.status, attempt < 40 ? 422 : 429);
  }
  const restored = await request(`/api/v1/sessions/${daily.sessionId}`);
  assert.equal((await restored.json()).attemptsUsed, 0);
});

test('payload JSON null é rejeitado com 400 em vez de erro interno', async () => {
  const { request } = await startTestServer();
  const response = await request('/api/v1/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null'
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_JSON_OBJECT');

  const session = await request('/api/v1/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'practice', level: 'leve' })
  });
  const { sessionId } = await session.json();
  const malformedGuess = await request(`/api/v1/sessions/${sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: 'null'
  });
  assert.equal(malformedGuess.status, 400);
  assert.equal((await malformedGuess.json()).error.code, 'INVALID_JSON_OBJECT');
  const restored = await request(`/api/v1/sessions/${sessionId}`);
  assert.equal((await restored.json()).attemptsUsed, 0);
});

test('palpite aceito persiste feedback e pode ser restaurado', async () => {
  const { request } = await startTestServer();
  const daily = await request('/api/v1/challenges/today');
  const { sessionId } = await daily.json();
  const response = await request(`/api/v1/sessions/${sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'guess-1' }, body: JSON.stringify({ guess: 'LAPIS' })
  });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.attemptsUsed, 1);
  assert.equal(result.attemptsRemaining, 6);
  assert.equal(result.lastFeedback.length, 5);
  assert.equal('revealedAnswer' in result, false);
  const replay = await request(`/api/v1/sessions/${sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'idempotency-key': 'guess-1' }, body: JSON.stringify({ guess: 'LAPIS' })
  });
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).attemptsUsed, 1);
  const restored = await request(`/api/v1/sessions/${sessionId}`);
  assert.equal((await restored.json()).guesses.length, 1);
});

test('vitória registra estatísticas uma vez e revela a resposta só ao encerrar', async () => {
  const { request } = await startTestServer();
  const dailyResponse = await request('/api/v1/challenges/today?level=regular');
  const daily = await dailyResponse.json();
  const ordinal = Math.floor(new Date(`${daily.date}T00:00:00Z`).getTime() / 86400000);
  const candidates = [...answerWords.regular].sort();
  const answer = candidates[Math.abs(ordinal * 31 + 'regular'.length * 17) % candidates.length];
  const winResponse = await request(`/api/v1/sessions/${daily.sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guess: answer })
  });
  const win = await winResponse.json();
  assert.equal(win.status, 'won');
  assert.equal(win.revealedAnswer, answer);
  const retry = await request(`/api/v1/sessions/${daily.sessionId}/guesses`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guess: answer })
  });
  assert.equal(retry.status, 409);
  const stats = await (await request('/api/v1/stats')).json();
  assert.equal(stats.played, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.winRate, 100);
  assert.equal(stats.winsByAttempt[0], 1);
});

test('encerra em derrota após sete palpites e registra a resposta final', async () => {
  const { request } = await startTestServer();
  const daily = await (await request('/api/v1/challenges/today?level=regular')).json();
  const wrongGuesses = ['AMIGO', 'BANCO', 'BOLSA', 'BRISA', 'CHUVA', 'CLARO', 'FLOCO'];
  let result;
  for (const guess of wrongGuesses) {
    const response = await request(`/api/v1/sessions/${daily.sessionId}/guesses`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ guess })
    });
    result = await response.json();
  }
  assert.equal(result.attemptsUsed, 7);
  assert.equal(result.attemptsRemaining, 0);
  assert.equal(result.status, 'lost');
  assert.ok(result.revealedAnswer);
  const stats = await (await request('/api/v1/stats')).json();
  assert.equal(stats.played, 1);
  assert.equal(stats.wins, 0);
  assert.equal(stats.currentStreak, 0);
});

test('prática e arquivo não entram nas estatísticas diárias', async () => {
  const { request } = await startTestServer();
  const practice = await request('/api/v1/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'practice', level: 'leve' })
  });
  assert.equal(practice.status, 201);
  const today = gameDate();
  const previous = new Date(`${today}T12:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  const archive = await request('/api/v1/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'archive', level: 'leve', date: previous.toISOString().slice(0, 10) })
  });
  assert.equal(archive.status, 201);
  assert.equal((await (await request('/api/v1/stats')).json()).played, 0);
});

test('rejeita data impossível no arquivo', async () => {
  const { request } = await startTestServer();
  const previousDate = new Date(`${gameDate()}T00:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const invalidDate = `${previousDate.toISOString().slice(0, 8)}32`;
  const response = await request('/api/v1/sessions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'archive', level: 'regular', date: invalidDate })
  });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error.code, 'INVALID_ARCHIVE_DATE');
});

test('reabrir o mesmo desafio de arquivo não gasta limite de novas sessões', async () => {
  const { request } = await startTestServer();
  const previousDate = new Date(`${gameDate()}T00:00:00Z`);
  previousDate.setUTCDate(previousDate.getUTCDate() - 1);
  const date = previousDate.toISOString().slice(0, 10);
  for (let attempt = 0; attempt < 21; attempt += 1) {
    const response = await request('/api/v1/sessions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'archive', level: 'leve', date })
    });
    assert.equal(response.status, attempt === 0 ? 201 : 200);
  }
  const archive = await (await request('/api/v1/challenges/archive')).json();
  const archivedDay = archive.days.find((day) => day.date === date);
  const archivedLevel = archivedDay.levels.find((level) => level.level === 'leve');
  assert.equal(archivedLevel.dailyStatus, null);
  assert.equal(archivedLevel.archiveStatus, 'active');
});