import { randomInt, randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const gameTimeZone = 'America/Sao_Paulo';
const maxAttempts = 7;
const wordLength = 5;
const archiveLimit = 30;
const allowedLevels = new Set(['leve', 'regular', 'afiado']);

export const answerWords = {
  leve: ['AMIGO', 'BANCO', 'BOLSA', 'BRISA', 'CAMPO', 'CANTO', 'CERTO', 'CHUVA', 'CLARO', 'CORPO', 'FESTA', 'FLOCO', 'FORTE', 'JUNTO', 'LAPIS', 'LIVRO', 'MUNDO', 'NINHO', 'PRAIA', 'PRATO', 'QUASE', 'ROCHA', 'TEMPO', 'VENTO', 'VISTA', 'ZEBRA'],
  regular: ['ANEXO', 'BRAVO', 'CUSTO', 'FONTE', 'GRITO', 'GRUPO', 'LARGO', 'LIMPO', 'MORAL', 'NORTE', 'PLUMA', 'PRIMO', 'RISCO', 'SABOR', 'TRAMA', 'TRIGO', 'TROCA', 'VASTO'],
  afiado: ['APEGO', 'ATROZ', 'CAQUI', 'FUGAZ', 'NOBRE', 'OPACO', 'SUTIL', 'TENAZ', 'VIGOR', 'ALADO', 'BRUTO', 'CISMA', 'DENSO', 'FAUNA', 'HASTE', 'NEXOS', 'PUDOR', 'ZELAR']
};

const additionalGuesses = [
  'ABRIR', 'ACASO', 'ACENO', 'ACIMA', 'ACORD', 'AGORA', 'ALGUM', 'ALTAR', 'AMORA', 'ANDAR',
  'ANTES', 'AREIA', 'AROMA', 'ASSIM', 'ATLAS', 'ATUAL', 'AVISO', 'BAIXO', 'BALAO', 'BARCO',
  'BARRA', 'BEBER', 'BEIJO', 'BICHO', 'BLOCO', 'BOATO', 'BOCAO', 'BOMBA', 'BORDA', 'BOTAO',
  'BRACO', 'BREVE', 'CABER', 'CABOS', 'CACAR', 'CAIXA', 'CALMA', 'CALOR', 'CARGA', 'CARNE',
  'CARRO', 'CARTA', 'CASAL', 'CAUSA', 'CEDRO', 'CERCA', 'CESTA', 'CHAVE', 'CHEIO', 'CICLO',
  'CINCO', 'CIVIL', 'COISA', 'COLAR', 'CONTA', 'CORAL', 'CORTA', 'CRIME', 'CULTO', 'CURSO',
  'DANCA', 'DEDOS', 'DENTE', 'DESDE', 'DOBRA', 'DOIDO', 'DOLAR', 'DONOS', 'DRAMA', 'DUNAS',
  'EIXOS', 'ELITE', 'ERROS', 'ESSAS', 'ESTAR', 'ETAPA', 'EXATO', 'FACIL', 'FALHA', 'FARDO',
  'FAVOR', 'FEIRA', 'FEIXE', 'FERRO', 'FILHO', 'FINAL', 'FLORA', 'FOCAR', 'FOLHA', 'FORMA',
  'FREIO', 'FRUTA', 'FUNDO', 'GALHO', 'GANHO', 'GASTO', 'GENIO', 'GERAL', 'GIRAR', 'GOLPE',
  'GOSTO', 'GRACA', 'GRAUS', 'HONRA', 'HORAS', 'IDEAL', 'IGUAL', 'IMPAR', 'INDIO', 'JANTA',
  'JOGOS', 'JOVEM', 'JULHO', 'LACRE', 'LADRA', 'LENTE', 'LINHA', 'LISTA', 'LUGAR', 'LUTAR',
  'MACIO', 'MAGIA', 'MALHA', 'MALTA', 'MANGA', 'MARCA', 'MARCO', 'MASSA', 'MELAO', 'MENOS',
  'METRO', 'MINHA', 'MOEDA', 'MOLHO', 'MONTE', 'MORRO', 'MOSTRA', 'MUDAR', 'NACAO', 'NAVIO',
  'NEVOA', 'NIVEL', 'NOITE', 'NOVOS', 'OBRAS', 'OCUPA', 'OLHAR', 'ONCA', 'ORDEM', 'OUVIR',
  'PALCO', 'PAPEL', 'PARTE', 'PASSO', 'PEDRA', 'PEIXE', 'PERTO', 'PILHA', 'PINTA', 'PLANO',
  'POBRE', 'PODER', 'PONTO', 'PORTE', 'POSSE', 'POSTO', 'POUCO', 'PRECO', 'PRESA', 'PROSA',
  'QUEDA', 'RADAR', 'RAIVA', 'RAMOS', 'RASGO', 'RAZAO', 'REGRA', 'REINO', 'RESTA', 'RETRO',
  'REVES', 'RITMO', 'ROSTO', 'SABER', 'SALTO', 'SAUDE', 'SECAR', 'SEGUE', 'SEIVA', 'SENHA',
  'SINAL', 'SITIO', 'SOBRE', 'SONHO', 'SORTE', 'SUBIR', 'SUCOS', 'TARDE', 'TECLA', 'TELHA',
  'TERRA', 'TESTE', 'TEXTO', 'TIGRE', 'TINTA', 'TOMAR', 'TORRE', 'TRATO', 'TREVO', 'TURMA',
  'UNIAO', 'UNICO', 'USINA', 'VALOR', 'VAPOR', 'VERAO', 'VERDE', 'VIDRO', 'VIRAR', 'VOLTA'
];

export function normalizeWord(value) {
  return Array.from(String(value).trim().normalize('NFD').replace(/\p{M}/gu, '').toLocaleUpperCase('pt-BR')).join('');
}

export function evaluateGuess(guessValue, targetValue) {
  const guess = normalizeWord(guessValue);
  const target = normalizeWord(targetValue);
  if (Array.from(guess).length !== Array.from(target).length) {
    throw new RangeError('Palpite e resposta precisam ter o mesmo número de letras.');
  }

  const result = Array(guess.length).fill('absent');
  const remaining = new Map();
  for (let index = 0; index < target.length; index += 1) {
    if (guess[index] === target[index]) result[index] = 'correct';
    else remaining.set(target[index], (remaining.get(target[index]) || 0) + 1);
  }
  for (let index = 0; index < guess.length; index += 1) {
    if (result[index] === 'correct') continue;
    const occurrences = remaining.get(guess[index]) || 0;
    if (occurrences > 0) {
      result[index] = 'present';
      remaining.set(guess[index], occurrences - 1);
    }
  }
  return result;
}

export function gameDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: gameTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const fields = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${fields.year}-${fields.month}-${fields.day}`;
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function dayOrdinal(dateString) {
  return Math.floor(new Date(`${dateString}T00:00:00Z`).getTime() / 86400000);
}

function isValidDate(dateString) {
  if (typeof dateString !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const date = new Date(`${dateString}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === dateString;
}

export function createRateLimiter(limit, windowMs, clock = () => Date.now()) {
  const buckets = new Map();
  let requestsSeen = 0;
  return (key) => {
    const now = clock();
    requestsSeen += 1;
    if (requestsSeen % 256 === 0) {
      for (const [storedKey, stored] of buckets) {
        if (now - stored.startedAt >= windowMs) buckets.delete(storedKey);
      }
    }
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.startedAt >= windowMs) {
      if (!bucket && buckets.size >= 10000) {
        for (const [storedKey, stored] of buckets) {
          if (now - stored.startedAt >= windowMs) buckets.delete(storedKey);
        }
      }
      if (!bucket && buckets.size >= 10000) return false;
      bucket = { startedAt: now, count: 0 };
      buckets.set(key, bucket);
    }
    if (bucket.count >= limit) return false;
    bucket.count += 1;
    return true;
  };
}

function seedWordEntries(database) {
  const insert = database.prepare(`
    INSERT OR IGNORE INTO word_entries
      (locale, normalized_word, display_word, length, difficulty, answer_allowed, guess_allowed, editorial_status)
    VALUES ('pt-BR', ?, ?, ?, ?, ?, 1, 'approved')
  `);
  const insertGuess = database.prepare(`
    INSERT OR IGNORE INTO word_entries
      (locale, normalized_word, display_word, length, difficulty, answer_allowed, guess_allowed, editorial_status)
    VALUES ('pt-BR', ?, ?, ?, 'regular', 0, 1, 'approved')
  `);

  for (const [level, words] of Object.entries(answerWords)) {
    for (const word of words) {
      const normalized = normalizeWord(word);
      insert.run(normalized, word, Array.from(normalized).length, level, 1);
    }
  }
  for (const word of additionalGuesses) {
    const normalized = normalizeWord(word);
    if (Array.from(normalized).length === wordLength && /^[A-Z]+$/.test(normalized)) {
      insertGuess.run(normalized, word, wordLength);
    }
  }
}

function initializeDatabase(database) {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS word_entries (
      id INTEGER PRIMARY KEY,
      locale TEXT NOT NULL,
      normalized_word TEXT NOT NULL,
      display_word TEXT NOT NULL,
      length INTEGER NOT NULL,
      difficulty TEXT NOT NULL,
      answer_allowed INTEGER NOT NULL CHECK (answer_allowed IN (0, 1)),
      guess_allowed INTEGER NOT NULL CHECK (guess_allowed IN (0, 1)),
      editorial_status TEXT NOT NULL CHECK (editorial_status IN ('draft', 'approved', 'blocked')),
      UNIQUE(locale, normalized_word, difficulty)
    );
    CREATE INDEX IF NOT EXISTS word_entries_guesses
      ON word_entries(locale, normalized_word, guess_allowed, editorial_status);
    CREATE TABLE IF NOT EXISTS daily_challenges (
      id TEXT PRIMARY KEY,
      challenge_date TEXT NOT NULL,
      locale TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      word_entry_id INTEGER NOT NULL REFERENCES word_entries(id),
      UNIQUE(challenge_date, locale, difficulty)
    );
    CREATE TABLE IF NOT EXISTS visitors (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      visitor_id TEXT NOT NULL REFERENCES visitors(id),
      mode TEXT NOT NULL CHECK (mode IN ('daily', 'practice', 'archive')),
      challenge_id TEXT REFERENCES daily_challenges(id),
      challenge_date TEXT,
      difficulty TEXT NOT NULL,
      target_word TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'won', 'lost')),
      attempts_used INTEGER NOT NULL DEFAULT 0 CHECK (attempts_used BETWEEN 0 AND 7),
      started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      finished_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS one_daily_session_per_level
      ON game_sessions(visitor_id, challenge_date, difficulty) WHERE mode = 'daily';
    CREATE UNIQUE INDEX IF NOT EXISTS one_archive_session_per_level
      ON game_sessions(visitor_id, challenge_date, difficulty) WHERE mode = 'archive';
    CREATE INDEX IF NOT EXISTS game_sessions_daily_stats
      ON game_sessions(visitor_id, mode, status, challenge_date);
    CREATE TABLE IF NOT EXISTS guesses (
      id INTEGER PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      sequence INTEGER NOT NULL CHECK (sequence BETWEEN 1 AND 7),
      normalized_guess TEXT NOT NULL,
      feedback TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(session_id, sequence)
    );
    CREATE TABLE IF NOT EXISTS guess_requests (
      session_id TEXT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      idempotency_key TEXT NOT NULL,
      response_json TEXT NOT NULL,
      PRIMARY KEY(session_id, idempotency_key)
    );
  `);
  seedWordEntries(database);
}

function challengeIdentifier(date, level) {
  return `${date}-${level}`;
}

function ensureChallenge(database, date, level) {
  const id = challengeIdentifier(date, level);
  const existing = database.prepare(`
    SELECT dc.id, dc.challenge_date, dc.difficulty, we.display_word, we.length
    FROM daily_challenges dc JOIN word_entries we ON we.id = dc.word_entry_id
    WHERE dc.id = ?
  `).get(id);
  if (existing) return existing;

  const words = database.prepare(`
    SELECT id, display_word, length FROM word_entries
    WHERE locale = 'pt-BR' AND difficulty = ? AND answer_allowed = 1 AND editorial_status = 'approved'
    ORDER BY normalized_word
  `).all(level);
  if (!words.length) throw new Error(`Não há palavras aprovadas para o nível ${level}.`);
  const index = Math.abs(dayOrdinal(date) * 31 + level.length * 17) % words.length;
  const selected = words[index];
  database.prepare(`
    INSERT OR IGNORE INTO daily_challenges(id, challenge_date, locale, difficulty, word_entry_id)
    VALUES (?, ?, 'pt-BR', ?, ?)
  `).run(id, date, level, selected.id);
  return database.prepare(`
    SELECT dc.id, dc.challenge_date, dc.difficulty, we.display_word, we.length
    FROM daily_challenges dc JOIN word_entries we ON we.id = dc.word_entry_id
    WHERE dc.id = ?
  `).get(id);
}

function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (!key) continue;
    try {
      cookies[key] = decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      continue;
    }
  }
  return cookies;
}

function findVisitorId(database, request) {
  const cookieId = parseCookies(request.headers.cookie).entrelinhas_visitor;
  if (!cookieId) return null;
  return database.prepare('SELECT id FROM visitors WHERE id = ?').get(cookieId)?.id || null;
}

function sendJson(response, status, data, extraHeaders = {}) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extraHeaders
  });
  response.end(JSON.stringify(data));
}

function sendError(response, status, code, message) {
  sendJson(response, status, { error: { code, message } });
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) throw Object.assign(new Error('Corpo da solicitação muito grande.'), { status: 413, code: 'BODY_TOO_LARGE' });
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw Object.assign(new Error('O corpo precisa ser um objeto JSON.'), { status: 400, code: 'INVALID_JSON_OBJECT' });
    }
    return body;
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error('O corpo precisa ser JSON válido.'), { status: 400, code: 'INVALID_JSON' });
  }
}

function isLevel(value) {
  return allowedLevels.has(value);
}

function responseSession(database, session, includeAllGuesses = true) {
  const guesses = includeAllGuesses ? database.prepare(`
    SELECT normalized_guess, feedback FROM guesses WHERE session_id = ? ORDER BY sequence
  `).all(session.id).map((guess) => ({ guess: guess.normalized_guess, feedback: JSON.parse(guess.feedback) })) : [];
  return {
    sessionId: session.id,
    mode: session.mode,
    challengeDate: session.challenge_date,
    level: session.difficulty,
    wordLength: wordLength,
    maxAttempts,
    attemptsUsed: session.attempts_used,
    attemptsRemaining: maxAttempts - session.attempts_used,
    status: session.status,
    guesses,
    ...(session.status !== 'active' ? { revealedAnswer: session.target_word } : {})
  };
}

function createVisitor(database, request, response, production) {
  const existingVisitorId = findVisitorId(database, request);
  let visitorId = existingVisitorId;
  if (!existingVisitorId) {
    visitorId = randomUUID();
    database.prepare('INSERT INTO visitors(id) VALUES (?)').run(visitorId);
    const secure = production ? '; Secure' : '';
    response.setHeader('set-cookie', `entrelinhas_visitor=${encodeURIComponent(visitorId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`);
  } else {
    database.prepare('UPDATE visitors SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?').run(visitorId);
  }
  return visitorId;
}

function getOrCreateDailySession(database, visitorId, date, level) {
  const challenge = ensureChallenge(database, date, level);
  const existing = database.prepare(`
    SELECT * FROM game_sessions WHERE visitor_id = ? AND challenge_date = ? AND difficulty = ? AND mode = 'daily'
  `).get(visitorId, date, level);
  if (existing) return { challenge, session: existing };

  const sessionId = randomUUID();
  database.prepare(`
    INSERT INTO game_sessions(id, visitor_id, mode, challenge_id, challenge_date, difficulty, target_word, status)
    VALUES (?, ?, 'daily', ?, ?, ?, ?, 'active')
  `).run(sessionId, visitorId, challenge.id, date, level, challenge.display_word);
  const session = database.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
  return { challenge, session };
}

function makeStats(database, visitorId, today) {
  const results = database.prepare(`
    SELECT challenge_date, MAX(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won,
      COUNT(*) AS completed_count, SUM(CASE WHEN status = 'won' THEN attempts_used ELSE 0 END) AS winning_attempts
    FROM game_sessions
    WHERE visitor_id = ? AND mode = 'daily' AND status IN ('won', 'lost')
    GROUP BY challenge_date ORDER BY challenge_date DESC
  `).all(visitorId);
  const winsByAttempt = Array(maxAttempts).fill(0);
  const summary = database.prepare(`
    SELECT COUNT(*) AS played,
      SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN status = 'won' THEN attempts_used ELSE 0 END) AS winning_attempts
    FROM game_sessions WHERE visitor_id = ? AND mode = 'daily' AND status IN ('won', 'lost')
  `).get(visitorId);
  const perSessionWins = database.prepare(`
    SELECT attempts_used, COUNT(*) AS count FROM game_sessions
    WHERE visitor_id = ? AND mode = 'daily' AND status = 'won' GROUP BY attempts_used
  `).all(visitorId);
  for (const row of perSessionWins) winsByAttempt[row.attempts_used - 1] = row.count;

  let currentStreak = 0;
  let expectedDate = results[0]?.challenge_date === today ? today : addDays(today, -1);
  const winsByDate = new Map(results.map((row) => [row.challenge_date, Boolean(row.won)]));
  while (winsByDate.get(expectedDate) === true) {
    currentStreak += 1;
    expectedDate = addDays(expectedDate, -1);
  }

  let bestStreak = 0;
  let run = 0;
  let previousDate = null;
  for (const row of [...results].sort((first, second) => first.challenge_date.localeCompare(second.challenge_date))) {
    run = row.won && (!previousDate || row.challenge_date === addDays(previousDate, 1)) ? run + 1 : Number(Boolean(row.won));
    bestStreak = Math.max(bestStreak, run);
    previousDate = row.challenge_date;
  }

  const played = summary.played || 0;
  const wins = summary.wins || 0;
  return {
    played,
    wins,
    winRate: played ? Math.round(wins / played * 100) : 0,
    currentStreak,
    bestStreak,
    averageWinningAttempts: wins ? Number((summary.winning_attempts / wins).toFixed(1)) : null,
    winsByAttempt
  };
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function applySecurityHeaders(response) {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'strict-origin-when-cross-origin');
  response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
}

function sendStatic(response, pathname) {
  const files = new Map([
    ['/', 'index.html'],
    ['/index.html', 'index.html'],
    ['/styles.css', 'styles.css'],
    ['/client.js', 'client.js']
  ]);
  const filename = files.get(pathname);
  if (!filename) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Não encontrado.');
    return;
  }
  const filepath = resolve(projectRoot, filename);
  response.writeHead(200, {
    'content-type': mimeTypes[extname(filepath)],
    'cache-control': 'no-cache'
  });
  createReadStream(filepath).pipe(response);
}

export function createApplication({ databasePath = resolve(projectRoot, 'data/entrelinhas.sqlite'), production = process.env.NODE_ENV === 'production' } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  initializeDatabase(database);
  const limitGuessesByVisitor = createRateLimiter(40, 60000);
  const limitGuessesByAddress = createRateLimiter(200, 60000);
  const limitSessionsByVisitor = createRateLimiter(20, 60000);
  const limitSessionsByAddress = createRateLimiter(60, 60000);
  const limitDailyByVisitor = createRateLimiter(20, 60000);
  const limitDailyByAddress = createRateLimiter(60, 60000);
  const limitApiByAddress = createRateLimiter(300, 60000);

  const server = createServer(async (request, response) => {
    applySecurityHeaders(response);
    const url = new URL(request.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (!pathname.startsWith('/api/')) {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { allow: 'GET, HEAD' });
        response.end();
        return;
      }
      sendStatic(response, pathname);
      return;
    }

    try {
      if (request.method === 'GET' && pathname === '/api/v1/health') {
        sendJson(response, 200, { status: 'ok' });
        return;
      }
      const isSessionRoute = pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)$/i);
      const isGuessRoute = pathname.match(/^\/api\/v1\/sessions\/([0-9a-f-]+)\/guesses$/i);
      const supportedRoute = (request.method === 'GET' && [
        '/api/v1/challenges/today', '/api/v1/challenges/archive', '/api/v1/stats'
      ].includes(pathname))
        || (request.method === 'GET' && isSessionRoute)
        || (request.method === 'POST' && (pathname === '/api/v1/sessions' || isGuessRoute));
      if (!supportedRoute) return sendError(response, 404, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
      if ((request.method === 'GET' && isSessionRoute) || (request.method === 'POST' && isGuessRoute)) {
        const sessionId = (isGuessRoute || isSessionRoute)[1];
        const sessionExists = database.prepare('SELECT 1 FROM game_sessions WHERE id = ?').get(sessionId);
        if (!sessionExists) return sendError(response, 404, 'SESSION_NOT_FOUND', 'Partida não encontrada.');
      }
      const clientAddress = request.socket.remoteAddress || 'unknown';
      const existingVisitorId = findVisitorId(database, request);
      let idempotencyKey = null;
      if (isGuessRoute) {
        idempotencyKey = request.headers['idempotency-key'] || randomUUID();
        if (typeof idempotencyKey !== 'string' || idempotencyKey.length > 128) {
          return sendError(response, 400, 'INVALID_IDEMPOTENCY_KEY', 'Chave de envio inválida.');
        }
        if (existingVisitorId) {
          const previousRequest = database.prepare(`
            SELECT request.response_json
            FROM guess_requests request
            JOIN game_sessions session ON session.id = request.session_id
            WHERE request.session_id = ? AND request.idempotency_key = ? AND session.visitor_id = ?
          `).get(isGuessRoute[1], idempotencyKey, existingVisitorId);
          if (previousRequest) {
            sendJson(response, 200, JSON.parse(previousRequest.response_json));
            return;
          }
        }
      }
      if (((request.method === 'GET' && isSessionRoute) || isGuessRoute) && !existingVisitorId) {
        return sendError(response, 404, 'SESSION_NOT_FOUND', 'Partida não encontrada.');
      }
      if (isGuessRoute) {
        const session = database.prepare('SELECT status, attempts_used FROM game_sessions WHERE id = ? AND visitor_id = ?')
          .get(isGuessRoute[1], existingVisitorId);
        if (!session) return sendError(response, 404, 'SESSION_NOT_FOUND', 'Partida não encontrada.');
        if (session.status !== 'active' || session.attempts_used >= maxAttempts) {
          return sendError(response, 409, 'GAME_FINISHED', 'Essa partida já terminou.');
        }
      }
      if (request.method === 'GET' && pathname === '/api/v1/challenges/today' && !limitDailyByAddress(clientAddress)) {
        response.setHeader('retry-after', '60');
        return sendError(response, 429, 'RATE_LIMITED', 'Muitas solicitações de desafio. Aguarde um minuto.');
      }
      if (!limitApiByAddress(clientAddress)) {
        response.setHeader('retry-after', '60');
        return sendError(response, 429, 'RATE_LIMITED', 'Muitas solicitações. Aguarde um minuto.');
      }
      if (isGuessRoute && (!limitGuessesByAddress(clientAddress) || !limitGuessesByVisitor(existingVisitorId))) {
        response.setHeader('retry-after', '60');
        return sendError(response, 429, 'RATE_LIMITED', 'Muitos palpites em sequência. Aguarde um minuto.');
      }
      const visitorId = existingVisitorId || createVisitor(database, request, response, production);

      if (request.method === 'GET' && pathname === '/api/v1/challenges/today') {
        const level = url.searchParams.get('level') || 'regular';
        if (!isLevel(level)) return sendError(response, 400, 'INVALID_LEVEL', 'Selecione um nível válido.');
        if (!limitDailyByVisitor(visitorId)) {
          response.setHeader('retry-after', '60');
          return sendError(response, 429, 'RATE_LIMITED', 'Muitas solicitações de desafio. Aguarde um minuto.');
        }
        const date = gameDate();
        const { challenge, session } = getOrCreateDailySession(database, visitorId, date, level);
        sendJson(response, 200, {
          challengeId: challenge.id,
          date,
          level,
          wordLength: challenge.length,
          ...responseSession(database, session)
        });
        return;
      }

      if (request.method === 'GET' && pathname === '/api/v1/challenges/archive') {
        const today = gameDate();
        const days = [];
        for (let offset = 1; offset <= archiveLimit; offset += 1) {
          const date = addDays(today, -offset);
          const levels = database.prepare(`
            SELECT difficulty AS level,
              MAX(CASE WHEN mode = 'daily' THEN status END) AS dailyStatus,
              MAX(CASE WHEN mode = 'archive' THEN status END) AS archiveStatus,
              MAX(attempts_used) AS attemptsUsed
            FROM game_sessions WHERE visitor_id = ? AND challenge_date = ? AND mode IN ('daily', 'archive')
            GROUP BY difficulty ORDER BY difficulty
          `).all(visitorId, date);
          days.push({ date, played: levels.length > 0, levels });
        }
        sendJson(response, 200, { days });
        return;
      }

      if (request.method === 'POST' && pathname === '/api/v1/sessions') {
        const body = await readJson(request);
        const level = body.level || 'regular';
        if (!isLevel(level)) return sendError(response, 400, 'INVALID_LEVEL', 'Selecione um nível válido.');
        if (body.mode !== 'practice' && body.mode !== 'archive') {
          return sendError(response, 400, 'INVALID_MODE', 'O modo deve ser prática ou arquivo.');
        }
        let date = null;
        let target;
        let challengeId = null;
        if (body.mode === 'archive') {
          date = body.date;
          if (!isValidDate(date) || date >= gameDate()) {
            return sendError(response, 400, 'INVALID_ARCHIVE_DATE', 'Selecione um desafio anterior válido.');
          }
          const age = dayOrdinal(gameDate()) - dayOrdinal(date);
          if (age > archiveLimit) return sendError(response, 404, 'ARCHIVE_NOT_FOUND', 'Esse desafio não está disponível no arquivo.');
          const challenge = ensureChallenge(database, date, level);
          challengeId = challenge.id;
          target = challenge.display_word;
        } else {
          const words = database.prepare(`
            SELECT display_word FROM word_entries
            WHERE locale = 'pt-BR' AND difficulty = ? AND answer_allowed = 1 AND editorial_status = 'approved'
            ORDER BY normalized_word
          `).all(level);
          if (!words.length) return sendError(response, 503, 'NO_WORDS_AVAILABLE', 'Não há palavras disponíveis para esse nível.');
          target = words[randomInt(words.length)].display_word;
        }

        if (body.mode === 'archive') {
          const existing = database.prepare(`
            SELECT * FROM game_sessions WHERE visitor_id = ? AND challenge_date = ? AND difficulty = ? AND mode = 'archive'
          `).get(visitorId, date, level);
          if (existing) {
            sendJson(response, 200, responseSession(database, existing));
            return;
          }
        }

        if (!limitSessionsByAddress(clientAddress) || !limitSessionsByVisitor(visitorId)) {
          response.setHeader('retry-after', '60');
          return sendError(response, 429, 'RATE_LIMITED', 'Muitas partidas novas em sequência. Aguarde um minuto.');
        }

        const sessionId = randomUUID();
        database.prepare(`
          INSERT INTO game_sessions(id, visitor_id, mode, challenge_id, challenge_date, difficulty, target_word, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
        `).run(sessionId, visitorId, body.mode, challengeId, date, level, target);
        const session = database.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId);
        sendJson(response, 201, responseSession(database, session));
        return;
      }

      if (request.method === 'GET' && isSessionRoute) {
        const session = database.prepare('SELECT * FROM game_sessions WHERE id = ? AND visitor_id = ?').get(isSessionRoute[1], visitorId);
        if (!session) return sendError(response, 404, 'SESSION_NOT_FOUND', 'Partida não encontrada.');
        sendJson(response, 200, responseSession(database, session));
        return;
      }

      if (request.method === 'POST' && isGuessRoute) {
        const body = await readJson(request);
        const guess = normalizeWord(body.guess || '');
        if (!/^[A-Z]{5}$/.test(guess)) {
          return sendError(response, 400, 'INVALID_GUESS_FORMAT', 'Digite uma palavra com exatamente cinco letras.');
        }
        database.exec('BEGIN IMMEDIATE');
        try {
          const session = database.prepare('SELECT * FROM game_sessions WHERE id = ? AND visitor_id = ?').get(isGuessRoute[1], visitorId);
          if (!session) {
            database.exec('ROLLBACK');
            return sendError(response, 404, 'SESSION_NOT_FOUND', 'Partida não encontrada.');
          }
          const previousRequest = database.prepare(`
            SELECT response_json FROM guess_requests WHERE session_id = ? AND idempotency_key = ?
          `).get(session.id, idempotencyKey);
          if (previousRequest) {
            database.exec('ROLLBACK');
            sendJson(response, 200, JSON.parse(previousRequest.response_json));
            return;
          }
          if (session.status !== 'active') {
            database.exec('ROLLBACK');
            return sendError(response, 409, 'GAME_FINISHED', 'Essa partida já terminou.');
          }
          if (session.attempts_used >= maxAttempts) {
            database.exec('ROLLBACK');
            return sendError(response, 409, 'GAME_FINISHED', 'Você já usou os sete palpites.');
          }
          const accepted = database.prepare(`
            SELECT id FROM word_entries
            WHERE locale = 'pt-BR' AND normalized_word = ? AND length = ? AND guess_allowed = 1 AND editorial_status = 'approved'
            LIMIT 1
          `).get(guess, wordLength);
          if (!accepted) {
            database.exec('ROLLBACK');
            return sendError(response, 422, 'WORD_NOT_ALLOWED', 'Essa palavra não está no vocabulário do jogo.');
          }

          const feedback = evaluateGuess(guess, session.target_word);
          const attemptsUsed = session.attempts_used + 1;
          const won = guess === normalizeWord(session.target_word);
          const status = won ? 'won' : attemptsUsed === maxAttempts ? 'lost' : 'active';
          database.prepare(`
            INSERT INTO guesses(session_id, sequence, normalized_guess, feedback) VALUES (?, ?, ?, ?)
          `).run(session.id, attemptsUsed, guess, JSON.stringify(feedback));
          database.prepare(`
            UPDATE game_sessions SET attempts_used = ?, status = ?, finished_at = CASE WHEN ? = 'active' THEN NULL ELSE CURRENT_TIMESTAMP END
            WHERE id = ?
          `).run(attemptsUsed, status, status, session.id);
          const updated = database.prepare('SELECT * FROM game_sessions WHERE id = ?').get(session.id);
          const result = {
            ...responseSession(database, updated),
            lastFeedback: feedback,
            ...(status !== 'active' ? { result: status } : {})
          };
          database.prepare(`
            INSERT INTO guess_requests(session_id, idempotency_key, response_json) VALUES (?, ?, ?)
          `).run(session.id, idempotencyKey, JSON.stringify(result));
          database.exec('COMMIT');
          sendJson(response, 200, result);
        } catch (error) {
          database.exec('ROLLBACK');
          throw error;
        }
        return;
      }

      if (request.method === 'GET' && pathname === '/api/v1/stats') {
        sendJson(response, 200, makeStats(database, visitorId, gameDate()));
        return;
      }

      sendError(response, 404, 'ROUTE_NOT_FOUND', 'Rota não encontrada.');
    } catch (error) {
      if (error.status) {
        sendError(response, error.status, error.code || 'REQUEST_ERROR', error.message);
        return;
      }
      console.error('Falha na API:', error.message);
      sendError(response, 500, 'INTERNAL_ERROR', 'Não foi possível concluir a solicitação.');
    }
  });

  server.on('close', () => database.close());
  return server;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const server = createApplication();
  const port = Number(process.env.PORT || 4174);
  server.listen(port, process.env.HOST || '127.0.0.1', () => {
    console.log(`Entrelinhas disponível em http://localhost:${port}`);
  });
  const shutdown = () => server.close(() => process.exit(0));
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}