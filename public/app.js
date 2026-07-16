const $ = (id) => document.getElementById(id);
const translations = {
  zh: {
    pageTitle: 'SK hynix ADR 价差监测', heroTitle: '海力士 ADR', heroAccent: '跨市场价差',
    intro: '比较 xyz:SKHY 与 xyz:SKHX ÷ 10 的标记价格。两个永续合约在同一市场连续交易。',
    currentPremium: '永续跨合约溢价', waiting: '等待行情', gapWaiting: '每份 ADR 价差 —',
    adrPerp: '1 ADR 永续', ordinaryPerp: '1 股普通股永续', fairValue: '每份 ADR 对应价值', includingFx: 'SKHX 标记价 ÷ 10',
    alertSettings: '报警设置', refresh: '刷新行情', thresholdPrefix: '绝对价差达到', thresholdSuffix: '时报警',
    marketNotice: '永续合约虽然连续交易，但预言机在正股休市时可能更新较慢；价差也会受到资金费率和流动性影响。',
    manualSummary: '接口不可用？使用手动永续价格计算', manualAdrLabel: 'xyz:SKHY 标记价（USD）', manualOrdinaryLabel: 'xyz:SKHX 标记价（USD）',
    manualAdrPlaceholder: '例如 168.57', manualOrdinaryPlaceholder: '例如 1251.80',
    calculate: '计算价差', disclaimer: '数据仅供监测，不构成投资建议', notUpdated: '尚未更新',
    connecting: '正在连接 Hyperliquid', refreshing: '正在刷新', liveData: 'HIP-3 实时行情', manualPrices: '手动价格',
    apiUnavailable: 'Hyperliquid 接口不可用', manualRequired: '请手动输入', alert: '触发报警', normal: '价差正常',
    perAdrHigher: '每份 ADR 高出', perAdrLower: '每份 ADR 低于', oracle: '预言机', funding: '资金费率',
    oracleParity: '预言机跨合约溢价', adrOracleDeviation: 'SKHY 标记/预言机偏离', openInterest: 'SKHY 持仓量', dayVolume: 'SKHY 24h 成交额',
    userInput: '用户手动输入', fetchedAt: '抓取于', calculatedAt: '手动计算于', switchLabel: 'Switch to English'
  },
  en: {
    pageTitle: 'SK hynix ADR Spread Monitor', heroTitle: 'SK hynix ADR', heroAccent: 'Cross-market spread',
    intro: 'Compare the mark prices of xyz:SKHY and xyz:SKHX ÷ 10. Both perpetuals trade continuously on the same market.',
    currentPremium: 'Perp cross-contract premium', waiting: 'Waiting for data', gapWaiting: 'Gap per ADR —',
    adrPerp: '1 ADR perpetual', ordinaryPerp: '1 ordinary share perpetual', fairValue: 'Value per ADR', includingFx: 'SKHX mark price ÷ 10',
    alertSettings: 'Alert settings', refresh: 'Refresh quotes', thresholdPrefix: 'Alert when absolute spread reaches', thresholdSuffix: '',
    marketNotice: 'Perpetuals trade continuously, but their oracles may update more slowly while underlying shares are closed. Funding and liquidity can also move the spread.',
    manualSummary: 'API unavailable? Calculate with manual perp prices', manualAdrLabel: 'xyz:SKHY mark price (USD)', manualOrdinaryLabel: 'xyz:SKHX mark price (USD)',
    manualAdrPlaceholder: 'e.g. 168.57', manualOrdinaryPlaceholder: 'e.g. 1251.80',
    calculate: 'Calculate spread', disclaimer: 'For monitoring only. Not investment advice.', notUpdated: 'Not updated yet',
    connecting: 'Connecting to Hyperliquid', refreshing: 'Refreshing', liveData: 'Live HIP-3 quotes', manualPrices: 'Manual prices',
    apiUnavailable: 'Hyperliquid API unavailable', manualRequired: 'Enter prices manually', alert: 'Alert triggered', normal: 'Within threshold',
    perAdrHigher: 'Each ADR is above parity by', perAdrLower: 'Each ADR is below parity by', oracle: 'Oracle', funding: 'Funding',
    oracleParity: 'Oracle cross-contract premium', adrOracleDeviation: 'SKHY mark/oracle deviation', openInterest: 'SKHY open interest', dayVolume: 'SKHY 24h volume',
    userInput: 'User-entered prices', fetchedAt: 'Fetched at', calculatedAt: 'Calculated at', switchLabel: '切换至中文'
  }
};

let language = localStorage.getItem('hynix-language') === 'en' ? 'en' : 'zh';
const t = (key) => translations[language][key] ?? key;
const nodes = {
  premium: $('premiumValue'), gap: $('gapValue'), badge: $('signalBadge'), meter: $('meterPoint'),
  adr: $('adrPrice'), ordinary: $('ordinaryPrice'), fair: $('fairPrice'),
  adrDetails: $('adrDetails'), ordinaryDetails: $('ordinaryDetails'), parityDetails: $('parityDetails'),
  oraclePremium: $('oraclePremium'), adrOracleDeviation: $('adrOracleDeviation'),
  openInterest: $('openInterest'), dayVolume: $('dayVolume'), status: $('statusText'), updated: $('updatedAt'),
  threshold: $('threshold'), thresholdLabel: $('thresholdLabel'), refresh: $('refreshButton'), language: $('languageToggle')
};

const locale = () => language === 'en' ? 'en-US' : 'zh-CN';
const money = (value, digits = 2) => Number(value).toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
const percent = (value, digits = 3) => `${Number(value) >= 0 ? '+' : ''}${money(value, digits)}%`;
const compactUsd = (value) => Number(value).toLocaleString(locale(), { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });

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
    nodes.updated.textContent = t('notUpdated');
    nodes.status.textContent = t('connecting');
  }
}

function render({ adr, ordinary, fairValueUsd, premiumPct, absoluteGapUsd, alert, source = t('liveData') }) {
  nodes.adr.textContent = money(adr, 2);
  nodes.ordinary.textContent = money(ordinary, 2);
  nodes.fair.textContent = money(fairValueUsd, 2);
  nodes.premium.textContent = percent(premiumPct, 2);
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
    const response = await fetch(`/api/perp-spread?threshold=${nodes.threshold.value}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error);
    render({ adr: data.quotes.adr.markPrice, ordinary: data.quotes.ordinary.markPrice, ...data.spread, alert: data.alert });
    nodes.adrDetails.textContent = `${t('oracle')} $${money(data.quotes.adr.oraclePrice, 2)} · ${t('funding')} ${percent(data.quotes.adr.fundingRate * 100, 4)}`;
    nodes.ordinaryDetails.textContent = `${t('oracle')} $${money(data.quotes.ordinary.oraclePrice, 2)} · ${t('funding')} ${percent(data.quotes.ordinary.fundingRate * 100, 4)}`;
    nodes.parityDetails.textContent = 'MARK-TO-MARK · 10 ADR = 1 SHARE';
    nodes.oraclePremium.textContent = percent(data.spread.oraclePremiumPct, 2);
    nodes.adrOracleDeviation.textContent = percent(data.spread.adrMarkOracleDeviationPct, 3);
    nodes.openInterest.textContent = compactUsd(data.quotes.adr.openInterestUsd);
    nodes.dayVolume.textContent = compactUsd(data.quotes.adr.dayVolumeUsd);
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
  const adr = Number($('manualAdr').value), ordinary = Number($('manualOrdinary').value);
  const fairValueUsd = ordinary / 10;
  const premiumPct = ((adr / fairValueUsd) - 1) * 100;
  const absoluteGapUsd = adr - fairValueUsd;
  render({ adr, ordinary, fairValueUsd, premiumPct, absoluteGapUsd, alert: Math.abs(premiumPct) >= Number(nodes.threshold.value), source: t('manualPrices') });
  nodes.adrDetails.textContent = nodes.ordinaryDetails.textContent = t('userInput');
  nodes.updated.textContent = `${t('calculatedAt')} ${new Date().toLocaleString(locale())}`;
});

applyLanguage();
refresh();
setInterval(refresh, 60_000);
