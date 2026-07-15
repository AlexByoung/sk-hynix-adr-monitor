const $ = (id) => document.getElementById(id);
const nodes = {
  premium: $('premiumValue'), gap: $('gapValue'), badge: $('signalBadge'), meter: $('meterPoint'),
  adr: $('adrPrice'), krx: $('krxPrice'), fair: $('fairPrice'), fx: $('fxPrice'),
  adrTime: $('adrTime'), krxTime: $('krxTime'), status: $('statusText'), updated: $('updatedAt'),
  threshold: $('threshold'), thresholdLabel: $('thresholdLabel'), refresh: $('refreshButton')
};

const money = (value, digits = 2) => Number(value).toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const quoteTime = (seconds, state) => seconds ? `${new Date(seconds * 1000).toLocaleString('zh-CN')} · ${state || 'UNKNOWN'}` : '行情时间未知';

function render({ adr, krx, fx, fairValueUsd, premiumPct, absoluteGapUsd, alert, source = '实时行情' }) {
  nodes.adr.textContent = money(adr, 2);
  nodes.krx.textContent = money(krx, 0);
  nodes.fx.textContent = `USD/KRW ${money(fx, 2)}`;
  nodes.fair.textContent = money(fairValueUsd, 2);
  nodes.premium.textContent = `${premiumPct >= 0 ? '+' : ''}${money(premiumPct, 2)}%`;
  nodes.gap.textContent = `每份 ADR ${absoluteGapUsd >= 0 ? '高出' : '低于'} $${money(Math.abs(absoluteGapUsd), 2)}`;
  nodes.premium.className = `premium ${premiumPct > 0 ? 'positive' : premiumPct < 0 ? 'negative' : ''}`;
  nodes.badge.textContent = alert ? '触发报警' : '价差正常';
  nodes.badge.className = `badge ${alert ? 'alert' : 'ok'}`;
  nodes.meter.style.left = `${Math.max(0, Math.min(100, 50 + premiumPct * 2.5))}%`;
  nodes.status.textContent = source;
}

async function refresh() {
  nodes.refresh.disabled = true;
  nodes.status.textContent = '正在刷新';
  document.querySelector('.live').classList.remove('error');
  try {
    const response = await fetch(`/api/spread?threshold=${nodes.threshold.value}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || data.error);
    render({
      adr: data.quotes.adr.price, krx: data.quotes.krx.price, fx: data.quotes.fx.price,
      ...data.spread, alert: data.alert
    });
    nodes.adrTime.textContent = quoteTime(data.quotes.adr.timestamp, data.quotes.adr.marketState);
    nodes.krxTime.textContent = quoteTime(data.quotes.krx.timestamp, data.quotes.krx.marketState);
    nodes.updated.textContent = `抓取于 ${new Date(data.fetchedAt).toLocaleString('zh-CN')}`;
  } catch (error) {
    nodes.status.textContent = '行情接口不可用';
    document.querySelector('.live').classList.add('error');
    nodes.badge.textContent = '请手动输入';
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
$('manualForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const adr = Number($('manualAdr').value), krx = Number($('manualKrx').value), fx = Number($('manualFx').value);
  const fairValueUsd = (krx * 0.1) / fx;
  const premiumPct = ((adr / fairValueUsd) - 1) * 100;
  const absoluteGapUsd = adr - fairValueUsd;
  render({ adr, krx, fx, fairValueUsd, premiumPct, absoluteGapUsd, alert: Math.abs(premiumPct) >= Number(nodes.threshold.value), source: '手动价格' });
  nodes.adrTime.textContent = nodes.krxTime.textContent = '用户手动输入';
  nodes.updated.textContent = `手动计算于 ${new Date().toLocaleString('zh-CN')}`;
});

refresh();
setInterval(refresh, 60_000);
