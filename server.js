import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateSpread, quoteAgeMinutes } from './calculator.js';

const PORT = Number(process.env.PORT) || 3000;
const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), 'public');
const SYMBOLS = Object.freeze({ adr: 'SKHY', krx: '000660.KS', fx: 'KRW=X' });
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

let cache = { expiresAt: 0, payload: null };

async function yahooQuote(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HynixSpreadMonitor/1.0)' },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`${symbol}: data provider returned ${response.status}`);
  const json = await response.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  if (!meta || !Number.isFinite(meta.regularMarketPrice)) {
    throw new Error(`${symbol}: no current quote available`);
  }
  const timestamps = result.timestamp || [];
  return {
    symbol,
    price: meta.regularMarketPrice,
    previousClose: meta.chartPreviousClose ?? meta.previousClose ?? null,
    currency: meta.currency,
    exchange: meta.fullExchangeName ?? meta.exchangeName,
    marketState: meta.marketState ?? 'UNKNOWN',
    timestamp: timestamps.at(-1) ?? meta.regularMarketTime ?? null
  };
}

async function getSpreadPayload(threshold) {
  const now = Date.now();
  if (cache.payload && cache.expiresAt > now) {
    return { ...cache.payload, thresholdPct: threshold, alert: Math.abs(cache.payload.spread.premiumPct) >= threshold };
  }

  const [adr, krx, fx] = await Promise.all([
    yahooQuote(SYMBOLS.adr),
    yahooQuote(SYMBOLS.krx),
    yahooQuote(SYMBOLS.fx)
  ]);
  const spread = calculateSpread({ adrUsd: adr.price, krxKrw: krx.price, usdKrw: fx.price });
  const oldestTimestamp = Math.min(...[adr.timestamp, krx.timestamp, fx.timestamp].filter(Number.isFinite));
  const payload = {
    symbols: SYMBOLS,
    ratio: { adrPerOrdinaryShare: 10, ordinarySharePerAdr: 0.1 },
    quotes: { adr, krx, fx },
    spread,
    quoteAgeMinutes: quoteAgeMinutes(oldestTimestamp),
    fetchedAt: new Date().toISOString()
  };
  cache = { expiresAt: now + 15_000, payload };
  return { ...payload, thresholdPct: threshold, alert: Math.abs(spread.premiumPct) >= threshold };
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const safePath = normalize(relative).replace(/^(\.\.(\/|\\|$))+/, '');
  const file = join(ROOT, safePath);
  if (!file.startsWith(ROOT)) return false;
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname === '/api/health') return sendJson(res, 200, { ok: true });
    if (url.pathname === '/api/spread') {
      const rawThreshold = Number(url.searchParams.get('threshold') ?? 10);
      const threshold = Number.isFinite(rawThreshold) ? Math.min(100, Math.max(0, rawThreshold)) : 10;
      return sendJson(res, 200, await getSpreadPayload(threshold));
    }
    if (await serveStatic(url.pathname, res)) return;
    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 502, {
      error: '暂时无法取得完整行情，请切换到手动输入。',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SK hynix spread monitor listening on :${PORT}`);
});
