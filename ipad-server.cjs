// Node.js Lab compatible entry point (CommonJS / Node 18).
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = path.join(__dirname, 'public');
const SYMBOLS = { adr: 'SKHY', krx: '000660.KS', fx: 'KRW=X' };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

let cache = { expiresAt: 0, payload: null };

function yahooQuote(symbol) {
  return new Promise(function (resolve, reject) {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
      encodeURIComponent(symbol) + '?interval=1m&range=1d';
    const request = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HynixSpreadMonitor/1.0)' }
    }, function (response) {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', function (chunk) { body += chunk; });
      response.on('end', function () {
        if (response.statusCode !== 200) {
          reject(new Error(symbol + ': data provider returned ' + response.statusCode));
          return;
        }
        try {
          const json = JSON.parse(body);
          const result = json.chart && json.chart.result && json.chart.result[0];
          const meta = result && result.meta;
          if (!meta || !Number.isFinite(meta.regularMarketPrice)) {
            throw new Error(symbol + ': no current quote available');
          }
          const timestamps = result.timestamp || [];
          resolve({
            symbol: symbol,
            price: meta.regularMarketPrice,
            previousClose: meta.chartPreviousClose || meta.previousClose || null,
            currency: meta.currency,
            exchange: meta.fullExchangeName || meta.exchangeName,
            marketState: meta.marketState || 'UNKNOWN',
            timestamp: timestamps.length ? timestamps[timestamps.length - 1] : (meta.regularMarketTime || null)
          });
        } catch (error) { reject(error); }
      });
    });
    request.setTimeout(8000, function () { request.destroy(new Error('Quote request timed out')); });
    request.on('error', reject);
  });
}

function calculateSpread(adrUsd, krxKrw, usdKrw) {
  const fairValueUsd = (krxKrw * 0.1) / usdKrw;
  return {
    fairValueUsd: fairValueUsd,
    premiumPct: ((adrUsd / fairValueUsd) - 1) * 100,
    absoluteGapUsd: adrUsd - fairValueUsd
  };
}

async function getSpreadPayload(threshold) {
  const now = Date.now();
  if (cache.payload && cache.expiresAt > now) {
    return Object.assign({}, cache.payload, {
      thresholdPct: threshold,
      alert: Math.abs(cache.payload.spread.premiumPct) >= threshold
    });
  }
  const quotes = await Promise.all([
    yahooQuote(SYMBOLS.adr), yahooQuote(SYMBOLS.krx), yahooQuote(SYMBOLS.fx)
  ]);
  const adr = quotes[0], krx = quotes[1], fx = quotes[2];
  const spread = calculateSpread(adr.price, krx.price, fx.price);
  const payload = {
    symbols: SYMBOLS,
    ratio: { adrPerOrdinaryShare: 10, ordinarySharePerAdr: 0.1 },
    quotes: { adr: adr, krx: krx, fx: fx },
    spread: spread,
    fetchedAt: new Date().toISOString()
  };
  cache = { expiresAt: now + 15000, payload: payload };
  return Object.assign({}, payload, {
    thresholdPct: threshold,
    alert: Math.abs(spread.premiumPct) >= threshold
  });
}

function sendJson(res, status, value) {
  res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
  res.end(JSON.stringify(value));
}

function serveStatic(pathname, res) {
  return new Promise(function (resolve) {
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.join(ROOT, path.normalize(relative).replace(/^(\.\.(\/|\\|$))+/, ''));
    if (file.indexOf(ROOT) !== 0) { resolve(false); return; }
    fs.readFile(file, function (error, body) {
      if (error) { resolve(false); return; }
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
      resolve(true);
    });
  });
}

const server = http.createServer(async function (req, res) {
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    if (requestUrl.pathname === '/api/health') {
      sendJson(res, 200, { ok: true }); return;
    }
    if (requestUrl.pathname === '/api/spread') {
      const raw = Number(requestUrl.searchParams.get('threshold') || 10);
      const threshold = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 10;
      sendJson(res, 200, await getSpreadPayload(threshold)); return;
    }
    if (await serveStatic(requestUrl.pathname, res)) return;
    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    sendJson(res, 502, {
      error: '暂时无法取得完整行情，请切换到手动输入。',
      detail: error && error.message ? error.message : String(error)
    });
  }
});

server.listen(PORT, '127.0.0.1', function () {
  console.log('SK hynix spread monitor listening on :' + PORT);
  if (typeof global.webAppReady === 'function') global.webAppReady();
});
