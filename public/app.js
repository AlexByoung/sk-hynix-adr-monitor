const $ = (id) => document.getElementById(id);
const translations = {
  zh: {
    pageTitle: 'SK hynix ADR 价差监测', heroTitle: '海力士 ADR', heroAccent: '跨市场价差',
    intro: '比较 SKHY 与韩国 000660 正股的汇率调整价值。10 份 ADR 对应 1 股韩国普通股。',
    currentPremium: '当前溢价', waiting: '等待行情', gapWaiting: '每份 ADR 价差 —',
    krxOrdinary: 'KRX 普通股', fairValue: '折算价值', includingFx: '含实时 USD/KRW',
    alertSettings: '报警设置', refresh: '刷新行情', thresholdPrefix: '绝对价差达到', thresholdSuffix: '时报警',
    marketNotice: '韩国与美国交易时段不重叠。盘中显示可能使用另一市场的最近成交价，并不代表可以即时套利。',
    manualSummary: '行情不可用？使用手动价格计算', manualAdrLabel: 'SKHY（USD）', manualKrxLabel: '000660（KRW）',
    manualAdrPlaceholder: '例如 184.51', manualKrxPlaceholder: '例如 1913000', manualFxPlaceholder: '例如 1495',
    calculate: '计算价差', disclaimer: '数据仅供监测，不构成投资建议', notUpdated: '尚未更新',
    connecting: '正在连接行情', refreshing: '正在刷新', liveData: '实时行情', manualPrices: '手动价格',
    apiUnavailable: '行情接口不可用', manualRequired: '请手动输入', alert: '触发报警', normal: '价差正常',
    perAdrHigher: '每份 ADR 高出', perAdrLower: '每份 ADR 低于', quoteTime: '行情时间', quoteUnknown: '行情时间未知', krwPerShare: 'KRW / 股',
    userInput: '用户手动输入', fetchedAt: '抓取于', calculatedAt: '手动计算于', switchLabel: 'Switch to English'
  },
  en: {
    pageTitle: 'SK hynix ADR Spread Monitor', heroTitle: 'SK hynix ADR', heroAccent: 'Cross-market spread',
    intro: 'Compare SKHY with the FX-adjusted value of Korean ordinary shares. 10 ADRs represent one Korean ordinary share.',
    currentPremium: 'Current premium', waiting: 'Waiting for data', gapWaiting: 'Gap per ADR —',
    krxOrdinary: 'KRX ordinary share', fairValue: 'Implied value', includingFx: 'Including USD/KRW',
    alertSettings: 'Alert settings', refresh: 'Refresh quotes', thresholdPrefix: 'Alert when absolute spread reaches', thresholdSuffix: '',
    marketNotice: 'Korean and U.S. trading hours do not overlap. One market may therefore show its latest available trade, which does not imply an immediately executable arbitrage.',
    manualSummary: 'Quotes unavailable? Calculate with manual prices', manualAdrLabel: 'SKHY (USD)', manualKrxLabel: '000660 (KRW)',
    manualAdrPlaceholder: 'e.g. 184.51', manualKrxPlaceholder: 'e.g. 1913000', manualFxPlaceholder: 'e.g. 1495',
    calculate: 'Calculate spread', disclaimer: 'For monitoring only. Not investment advice.', notUpdated: 'Not updated yet',
    connecting: 'Connecting to quotes', refreshing: 'Refreshing', liveData: 'Live quotes', manualPrices: 'Manual prices',
    apiUnavailable: 'Quote API unavailable', manualRequired: 'Enter prices manually', alert: 'Alert triggered', normal: 'Within threshold',
    perAdrHigher: 'Each ADR is above fair value by', perAdrLower: 'Each ADR is below fair value by', quoteTime: 'Quote time', quoteUnknown: 'Quote time unavailable', krwPerShare: 'KRW / share',
    userInput: 'User-entered prices', fetchedAt: 'Fetched at', calculatedAt: 'Calculated at', switchLabel: '切换至中文'
  }
};

let language = localStorage.getItem('hynix-language') === 'en' ? 'en' : 'zh';
const t = (key) => translations[language][key] ?? key;
const nodes = {
  premium: $('premiumValue'), gap: $('gapValue'), badge: $('signalBadge'), meter: $('meterPoint'),
  adr: $('adrPrice'), krx: $('krxPrice'), fair: $('fairPrice'), fx: $('fxPrice'),
  adrTime: $('adrTime'), krxTime: $('krxTime'), status: $('statusText'), updated: $('updatedAt'),
  threshold: $('threshold'), thresholdLabel: $('thresholdLabel'), refresh: $('refreshButton'), language: $('languageToggle')
};

const money = (value, digits = 2) => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const locale = () => language === 'en' ? 'en-US' : 'zh-CN';
const quoteTime = (seconds, state) => seconds ? `${t('quoteTime')} ${new Date(seconds * 1000).toLocaleString(locale())} · ${state || 'UNKNOWN'}` : t('quoteUnknown');

function applyLanguage() {
  document.documentElement.lang = language === 'en' ? 'en' : 'zh-CN';
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach((element) => { element.textContent = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => { element.placeholder = t(element.dataset.i18nPlaceholder); });
  nodes.language.textContent = language === 'en' ? '中文' : 'EN';
  nodes.language.setAttribute('aria-label', t('switchLabel'));
  if (nodes.premium.textContent === '—') {
    nodes.badge.textContent = t('waiting');
    nodes.gap.textContent = t('gapWaiting');
    nodes.adrTime.textContent = `${t('quoteTime')} —`;
    nodes.krxTime.textContent = `${t('quoteTime')} —`;
    nodes.updated.textContent = t('notUpdated');
    nodes.status.textContent = t('connecting');
  }
}

function render({ adr, krx, fx, fairValueUsd, premiumPct, absoluteGapUsd, alert, source = t('liveData') }) {
  nodes.adr.textContent = money(adr, 2);
  nodes.krx.textContent = money(krx, 0);
  nodes.fx.textContent = `USD/KRW ${money(fx, 2)}`;
  nodes.fair.textContent = money(fairValueUsd, 2);
  nodes.premium.textContent = `${premiumPct >= 0 ? '+' : ''}${money(premiumPct, 2)}%`;
  nodes.gap.textContent = `${t(absoluteGapUsd >= 0 ? 'perAdrHigher' : 'perAdrLower')} $${money(Math.abs(absoluteGapUsd), 2)}`;
  nodes.premium.className = `premium ${premiumPct > 0 ? 'positive' : premiumPct < 0 ? 'negative' : ''}`;
  nodes.badge.textContent = alert ? t('alert') : t('normal');
  nodes.badge.className = `badge ${alert ? 'alert' : 'ok'}`;
  nodes.meter.style.left = `${Math.max(0, Math.min(100, 50 + premiumPct * 2.5))}%`;
  nodes.status.textContent = source;
}

async function refresh() {
  nodes.refresh.disabled = true;
  nodes.status.textContent = t('refreshing');
  document.querySelector('.live').classList.remove('error');
  try {
    const response = await fetch(`/api/spread?threshold=${nodes.threshold.value}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error);
    render({
      adr: data.quotes.adr.price, krx: data.quotes.krx.price, fx: data.quotes.fx.price,
      ...data.spread, alert: data.alert, source: t('liveData')
    });
    nodes.adrTime.textContent = quoteTime(data.quotes.adr.timestamp, data.quotes.adr.marketState);
    nodes.krxTime.textContent = quoteTime(data.quotes.krx.timestamp, data.quotes.krx.marketState);
    nodes.updated.textContent = `${t('fetchedAt')} ${new Date(data.fetchedAt).toLocaleString(locale())}`;
  } catch (error) {
    nodes.status.textContent = t('apiUnavailable');
    document.querySelector('.live').classList.add('error');
    nodes.badge.textContent = t('manualRequired');
    nodes.badge.className = 'badge alert';
    nodes.updated.textContent = error.message;
  } finally {
    nodes.refresh.disabled = false;
  }
}

nodes.threshold.addEventListener('input', () => {
  nodes.thresholdLabel.textContent = `${nodes.threshold.value}%`;
});
nodes.threshold.addEventListener('change', refresh);
nodes.refresh.addEventListener('click', refresh);
nodes.language.addEventListener('click', () => {
  language = language === 'zh' ? 'en' : 'zh';
  localStorage.setItem('hynix-language', language);
  applyLanguage();
  refresh();
});
$('manualForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const adr = Number($('manualAdr').value), krx = Number($('manualKrx').value), fx = Number($('manualFx').value);
  const fairValueUsd = (krx * 0.1) / fx;
  const premiumPct = ((adr / fairValueUsd) - 1) * 100;
  const absoluteGapUsd = adr - fairValueUsd;
  render({ adr, krx, fx, fairValueUsd, premiumPct, absoluteGapUsd, alert: Math.abs(premiumPct) >= Number(nodes.threshold.value), source: t('manualPrices') });
  nodes.adrTime.textContent = nodes.krxTime.textContent = t('userInput');
  nodes.updated.textContent = `${t('calculatedAt')} ${new Date().toLocaleString(locale())}`;
});

applyLanguage();
refresh();
setInterval(refresh, 60_000);
setInterval(refresh, 60_000);
