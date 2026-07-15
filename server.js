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

async function fetchJson(url, headers = {}, timeoutMs = 25_000) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HynixSpreadMonitor/1.0)', ...headers },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`${new URL(url).hostname}: HTTP ${response.status}`);
  return response.json();
}

function numericPrice(value) {
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`Invalid price: ${value}`);
  return parsed;
}

async function nasdaqQuote() {
  const json = await fetchJson('https://api.nasdaq.com/api/quote/SKHY/info?assetclass=stocks', {
    Accept: 'application/json, text/plain, */*',
    Origin: 'https://www.nasdaq.com',
    Referer: 'https://www.nasdaq.com/'
  });
  const data = json?.data;
  const primary = data?.primaryData;
  if (!primary?.lastSalePrice) throw new Error('Nasdaq SKHY: no quote available');
  return {
    symbol: SYMBOLS.adr,
    price: numericPrice(primary.lastSalePrice),
    previousClose: null,
    currency: 'USD',
    exchange: data.exchange ?? 'Nasdaq',
    marketState: data.marketStatus ?? 'UNKNOWN',
    timestamp: null,
    source: 'Nasdaq'
  };
}

async function naverQuote() {
  const json = await fetchJson('https://polling.finance.naver.com/api/realtime/domestic/stock/000660', {
    Accept: 'application/json, text/plain, */*',
    Referer: 'https://finance.naver.com/'
  }, 20_000);
  const data = json?.datas?.[0];
  if (!data?.closePrice) throw new Error('Naver 000660: no quote available');
  return {
    symbol: SYMBOLS.krx,
    price: numericPrice(data.closePrice),
    previousClose: null,
    currency: 'KRW',
    exchange: data.stockExchangeType?.nameEng ?? 'KOSPI',
    marketState: data.marketStatus ?? 'UNKNOWN',
    timestamp: data.localTradedAt ? Math.floor(Date.parse(data.localTradedAt) / 1000) : null,
    source: 'Naver Finance'
  };
}

async function exchangeRateQuote() {
  const json = await fetchJson('https://open.er-api.com/v6/latest/USD', { Accept: 'application/json' });
  const price = Number(json?.rates?.KRW);
  if (!Number.isFinite(price) || price <= 0) throw new Error('USD/KRW: no quote available');
  return {
    symbol: SYMBOLS.fx,
    price,
    previousClose: null,
    currency: 'KRW',
    exchange: 'ExchangeRate-API',
    marketState: 'DAILY',
    timestamp: json.time_last_update_unix ?? null,
    source: 'ExchangeRate-API'
  };
}

async function fetchYahooQuote(host, symbol) {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1m&range=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      'Accept': 'application/json,text/plain,*/*'
    },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`${host} ${symbol}: HTTP ${response.status}`);
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

async function yahooQuote(symbol) {
  const errors = [];
  for (const host of ['query2.finance.yahoo.com', 'query1.finance.yahoo.com']) {
    try {
      return await fetchYahooQuote(host, symbol);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  throw new Error(errors.join(' | '));
}

async function withFallback(primary, yahooSymbol) {
  try {
    return await primary();
  } catch (primaryError) {
    try {
      const quote = await yahooQuote(yahooSymbol);
      return { ...quote, source: 'Yahoo Finance (fallback)' };
    } catch (fallbackError) {
      throw new Error(`${primaryError instanceof Error ? primaryError.message : primaryError} | ${fallbackError instanceof Error ? fallbackError.message : fallbackError}`);
    }
  }
}

async function getSpreadPayload(threshold) {
  const now = Date.now();
  if (cache.payload && cache.expiresAt > now) {
    return { ...cache.payload, thresholdPct: threshold, alert: Math.abs(cache.payload.spread.premiumPct) >= threshold };
  }

  const [adr, krx, fx] = await Promise.all([
    withFallback(nasdaqQuote, SYMBOLS.adr),
    withFallback(naverQuote, SYMBOLS.krx),
    withFallback(exchangeRateQuote, SYMBOLS.fx)
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
