import { ESSENCES, icon } from './data/essences.js';
import './style.css';

const $ = s => document.querySelector(s);
const load = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };
const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const fmt = (v, d = 2) => num(v).toFixed(d);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

const state = {
  currency: localStorage.getItem('poe2-currency') || 'chaos',
  divChaos: num(localStorage.getItem('poe2-div-chaos'), 7150),
  lfPerDiv: num(localStorage.getItem('poe2-lf-per-div'), 22150),
  lfPerRoll: num(localStorage.getItem('poe2-lf-roll'), 30),
  strategy: localStorage.getItem('poe2-strategy') || 'one',
  prices: load('poe2-essence-prices-v2', {}),
  qty: load('poe2-essence-qty-v2', {}),
  selected: new Set(ESSENCES.map(([id]) => id)),
  sort: localStorage.getItem('poe2-sort') || 'profit',
  provider: localStorage.getItem('poe2-provider') || '本地价格'
};

for (const [id] of ESSENCES) {
  if (!state.prices[id] || typeof state.prices[id] !== 'object') state.prices[id] = { buy: 0, sell: 0 };
  if (!(id in state.qty)) state.qty[id] = 0;
}

function save() {
  localStorage.setItem('poe2-currency', state.currency);
  localStorage.setItem('poe2-div-chaos', String(state.divChaos));
  localStorage.setItem('poe2-lf-per-div', String(state.lfPerDiv));
  localStorage.setItem('poe2-lf-roll', String(state.lfPerRoll));
  localStorage.setItem('poe2-strategy', state.strategy);
  localStorage.setItem('poe2-sort', state.sort);
  localStorage.setItem('poe2-provider', state.provider);
  localStorage.setItem('poe2-essence-prices-v2', JSON.stringify(state.prices));
  localStorage.setItem('poe2-essence-qty-v2', JSON.stringify(state.qty));
}

// All internal calculations use chaos. This avoids the common error of treating
// "items per divine" as chaos-per-item when the display currency is changed.
const buyChaos = id => num(state.prices[id]?.buy) * (state.currency === 'chaos' ? 1 : state.divChaos / Math.max(0.000001, num(state.prices[id]?.buy)));
const sellChaos = id => num(state.prices[id]?.sell) * (state.currency === 'chaos' ? 1 : state.divChaos / Math.max(0.000001, num(state.prices[id]?.sell)));

// In divine display mode, table prices are stored as items/divine. Convert to
// chaos/item: divChaos / (items per divine). In chaos mode they are chaos/item.
function priceToChaos(value) {
  const v = num(value);
  return state.currency === 'chaos' ? v : (v > 0 ? state.divChaos / v : 0);
}
function chaosToDisplay(value) {
  const v = Math.max(0, num(value));
  return state.currency === 'chaos' ? v : (v > 0 ? state.divChaos / v : 0);
}
function buy(id) { return priceToChaos(state.prices[id]?.buy); }
function sell(id) { return priceToChaos(state.prices[id]?.sell); }
function lfChaos() { return state.divChaos * state.lfPerRoll / Math.max(1, state.lfPerDiv); }

function oneStepExpected(id) {
  const vals = ESSENCES.filter(([other]) => other !== id).map(([other]) => sell(other)).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : 0;
}
function oneStepValue(id) { return Math.max(sell(id), oneStepExpected(id) - lfChaos()); }
function oneStepProfit(id) { return oneStepExpected(id) - buy(id) - lfChaos(); }

// Bellman-style fixed-point calculation for the Optimal strategy:
// V(i) = max(sell(i), average(V(j), j != i) - lifeforce cost).
// Iteration converges quickly for this finite exchange graph.
function optimalValues() {
  const ids = ESSENCES.map(([id]) => id);
  let v = Object.fromEntries(ids.map(id => [id, sell(id)]));
  for (let n = 0; n < 100; n++) {
    const next = {};
    let delta = 0;
    for (const id of ids) {
      const vals = ids.filter(x => x !== id).map(x => v[x]).filter(x => x > 0);
      const convert = vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length - lfChaos() : 0;
      next[id] = Math.max(sell(id), convert);
      delta = Math.max(delta, Math.abs(next[id] - v[id]));
    }
    v = next;
    if (delta < 1e-8) break;
  }
  return v;
}
function metrics(id, optimal) {
  const s = sell(id), b = buy(id), c = lfChaos();
  const expected = oneStepExpected(id);
  const value = optimal ? optimal[id] : oneStepValue(id);
  const conversionProfit = optimal ? value - b : expected - b - c;
  return { buy:b, sell:s, expected, value, profit:conversionProfit, roi:b > 0 ? conversionProfit / b : 0, convert: optimal ? value > s + 1e-9 : expected - c > s + 1e-9 };
}
function tradeLink(id) {
  const slug = `deafening-essence-of-${id}`;
  const q = encodeURIComponent(JSON.stringify({ query:{ have:['chaos'], want:[slug], status:{option:'online'} } }));
  return `https://www.pathofexile.com/trade/exchange/Standard?q=${q}`;
}

function shell() {
  $('#app').innerHTML = `
<header class="goe-header"><div class="goe-head-inner">
  <a class="goe-logo" href=".">Gains of Exile <span>· 中文版</span></a>
  <nav><a class="active">精华</a><a>催化剂</a><a>化石</a><a>精油</a><a>裂界碎片</a></nav>
  <div class="head-right"><span>PoE 经济工具</span><button data-action="reset">重置</button></div>
</div></header>
<main class="goe-layout">
<aside class="goe-left">
<section class="quick"><h2>快速配置</h2><p>计算最佳精华转换与收益。先设置下面这些项目：</p>
<ol><li><b>货币：</b>按混沌石还是神圣石计算？</li><li><b>数量：</b>你有多少精华？</li><li><b>价格：</b>当前市场价格如何？</li><li><b>转换：</b>命能成本是多少？</li></ol></section>
<section class="box"><h3>1. 货币</h3>
<div class="field"><label>价格显示单位</label><div class="seg"><button data-currency="chaos" class="${state.currency==='chaos'?'on':''}">混沌 / 件</button><button data-currency="divine" class="${state.currency==='divine'?'on':''}">件 / 神圣</button></div></div>
<div class="field"><label>1 神圣石 =</label><div class="unit-input"><input id="divChaos" type="number" min="1"><span>混沌石</span></div></div>
</section>
<section class="box"><h3>汇率</h3><div class="rate-line"><b id="rateText">${fmt(state.divChaos,0)}</b><img src="https://gains-of-exile.vercel.app/images/chaos.png"> = 1 <img src="https://gains-of-exile.vercel.app/images/divine.png"></div><button class="text-btn" data-action="ninja">从 poe.ninja 更新</button></section>
<section class="box"><h3>2. 数量</h3><p class="muted">只会给当前勾选的行生成数量，不会改变单位价格。</p>
<div class="check-row"><button data-action="all">全选</button><button data-action="none">全不选</button><button data-action="good">盈利</button><button data-action="bad">亏损</button></div>
<div class="between"><input id="minQty" type="number" value="0"><span>至</span><input id="maxQty" type="number" value="100"><span>件</span></div><button class="primary-btn" data-action="generate">生成数量</button></section>
<section class="box"><h3>3. 价格</h3><p class="muted">价格可直接编辑，也可以从 poe.ninja 自动读取。</p>
<div class="provider"><span class="dot"></span><span id="provider">${esc(state.provider)}</span></div>
<button class="primary-btn" data-action="ninja">从 poe.ninja 获取价格</button><button class="secondary-btn" data-action="demo">载入示例价格</button><button class="secondary-btn" data-action="clear">清空价格</button></section>
<section class="box"><h3>4. 转换 <img class="tiny-icon" src="https://gains-of-exile.vercel.app/images/flip2.png"></h3>
<p class="muted">园艺台每次转换消耗命能。一步策略只看下一次转换；最优策略会继续考虑未来转换。</p>
<div class="field"><label>每次转换命能</label><div class="unit-input"><input id="lfPerRoll" type="number" min="1"><span>命能</span></div></div>
<div class="field"><label>1 神圣石可购买</label><div class="unit-input"><input id="lfPerDiv" type="number" min="1"><span>命能</span></div></div>
<div class="strategy"><button data-strategy="one" class="${state.strategy==='one'?'on':''}">一步策略</button><button data-strategy="optimal" class="${state.strategy==='optimal'?'on':''}">最优策略</button></div></section>
</aside>
<section class="goe-center"><div class="center-title"><div><h1>精华</h1><p>价格、转换收益与利润一览 · ${state.strategy==='one'?'One-step':'Optimal'}</p></div><div class="sort"><span>排序</span><button data-action="sort">${state.sort==='profit'?'利润 ↓':'名称 A-Z'}</button></div></div>
<div class="table-scroll"><table><thead><tr><th class="sel">✓</th><th>精华</th><th>数量</th><th>买入</th><th>出售</th><th>转换期望</th><th>命能</th><th>利润</th><th>ROI</th><th>建议</th></tr></thead><tbody id="table"></tbody></table></div></section>
<aside class="goe-right"><section class="result-head"><h2>收益与损失</h2><span>${state.strategy==='one'?'One-step':'Optimal'} · 实时计算</span></section>
<section class="result-block"><h3>已花费</h3><div class="result-line"><span>购买精华</span><b id="spent">0</b></div><div class="result-line"><span>转换命能</span><b id="lfSpent">0</b></div></section>
<section class="result-block"><h3>已获得</h3><div class="result-line"><span>直接出售价值</span><b id="direct">0</b></div><div class="result-line"><span>策略后出售价值</span><b id="earned">0</b></div></section>
<section class="profit-card"><span>预计利润</span><strong id="totalProfit">0</strong><small>ROI：<b id="totalRoi">0.00%</b></small></section>
<section class="result-block"><h3>保留 <span id="keepCount">0</span></h3><div id="keep" class="result-list"></div></section>
<section class="result-block"><h3>转换 <span id="flipCount">0</span></h3><div id="flip" class="result-list"></div></section>
<section class="result-block compact"><div class="result-line"><span>物品数量</span><b id="rolls">0</b></div><div class="result-line"><span>命能需求</span><b id="lfNeeded">0</b></div></section>
<section class="trade-box"><h3>Trade Links</h3><p>复制或打开选中精华的交易搜索。</p><div class="trade-buttons"><button data-action="tradeSelected">✔ 已选择</button><button data-action="tradeKeep">$ 保留</button><button data-action="tradeFlip">↻ 转换</button></div></section></aside>
</main><footer>Gains of Exile 风格中文精华转换器 · poe.ninja 价格 · 非官方工具</footer>`;
  $('#divChaos').value = state.divChaos;
  $('#lfPerRoll').value = state.lfPerRoll;
  $('#lfPerDiv').value = state.lfPerDiv;
}

function getRows() {
  const optimal = state.strategy === 'optimal';
  const ov = optimal ? optimalValues() : null;
  const arr = ESSENCES.map(x => ({ x, m:metrics(x[0], ov) }));
  if (state.sort === 'profit') arr.sort((a,b)=>b.m.profit-a.m.profit); else arr.sort((a,b)=>a.x[1].localeCompare(b.x[1],'zh-CN'));
  return arr;
}
function renderTable() {
  const optimal = state.strategy === 'optimal';
  const ov = optimal ? optimalValues() : null;
  $('#table').innerHTML = getRows().map(({x,m}) => {
    const id=x[0], q=num(state.qty[id]), checked=state.selected.has(id), good=m.convert;
    return `<tr class="${checked?'':'dim'}"><td class="sel"><input data-check="${id}" type="checkbox" ${checked?'checked':''}></td><td><a class="essence" href="${tradeLink(id)}" target="_blank" rel="noopener"><img src="${icon(id)}"><span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></span></a></td><td><input class="cell qty" data-qty="${id}" type="number" min="0" value="${q}"></td><td><input class="cell price" data-buy="${id}" type="number" min="0" step="0.01" value="${state.prices[id].buy||''}" placeholder="0"></td><td><input class="cell price" data-sell="${id}" type="number" min="0" step="0.01" value="${state.prices[id].sell||''}" placeholder="0"></td><td class="number">${fmt(chaosToDisplay(m.expected),state.currency==='chaos'?2:1)}</td><td class="number muted">${fmt(chaosToDisplay(lfChaos()),state.currency==='chaos'?2:1)}</td><td class="number ${m.profit>=0?'up':'down'}">${m.profit>=0?'+':''}${fmt(chaosToDisplay(m.profit),state.currency==='chaos'?2:1)}</td><td class="number ${m.roi>=0?'up':'down'}">${fmt(m.roi*100,1)}%</td><td><span class="tag ${good?'tag-good':'tag-bad'}">${good?'转换':'出售'}</span></td></tr>`;
  }).join('');
  document.querySelectorAll('[data-check]').forEach(el=>el.onchange=e=>{const id=e.target.dataset.check;e.target.checked?state.selected.add(id):state.selected.delete(id);save();renderAll();});
  document.querySelectorAll('[data-qty]').forEach(el=>el.oninput=e=>{state.qty[e.target.dataset.qty]=Math.max(0,num(e.target.value));save();renderResults();});
  document.querySelectorAll('[data-buy]').forEach(el=>el.oninput=e=>{state.prices[e.target.dataset.buy].buy=Math.max(0,num(e.target.value));state.provider='本地价格';save();renderAll();});
  document.querySelectorAll('[data-sell]').forEach(el=>el.oninput=e=>{state.prices[e.target.dataset.sell].sell=Math.max(0,num(e.target.value));state.provider='本地价格';save();renderAll();});
}

function renderResults() {
  const optimal=state.strategy==='optimal'; const ov=optimal?optimalValues():null; const chosen=[...state.selected];
  let spent=0, lfSpent=0, direct=0, earned=0, rolls=0, convertCount=0;
  for(const id of chosen){const q=num(state.qty[id]);if(q<=0)continue;const m=metrics(id,ov);rolls+=q;spent+=q*m.buy;direct+=q*m.sell;if(m.convert){convertCount+=q;lfSpent+=q*lfChaos();earned+=q*m.value;}else earned+=q*m.sell;}
  const net=earned-spent-lfSpent; const roi=spent>0?net/spent:0;
  $('#spent').textContent=fmt(chaosToDisplay(spent),state.currency==='chaos'?2:1);$('#lfSpent').textContent=fmt(chaosToDisplay(lfSpent),state.currency==='chaos'?2:1);$('#direct').textContent=fmt(chaosToDisplay(direct),state.currency==='chaos'?2:1);$('#earned').textContent=fmt(chaosToDisplay(earned),state.currency==='chaos'?2:1);
  $('#totalProfit').textContent=(net>=0?'+':'')+fmt(chaosToDisplay(net),state.currency==='chaos'?2:1);$('#totalProfit').className=net>=0?'up':'down';$('#totalRoi').textContent=fmt(roi*100,2)+'%';$('#rolls').textContent=fmt(rolls,0);$('#lfNeeded').textContent=fmt(convertCount*state.lfPerRoll,0);
  const keep=chosen.filter(id=>num(state.qty[id])>0&&!metrics(id,ov).convert).sort((a,b)=>metrics(b,ov).sell-metrics(a,ov).sell); const flip=chosen.filter(id=>num(state.qty[id])>0&&metrics(id,ov).convert).sort((a,b)=>metrics(b,ov).profit-metrics(a,ov).profit);
  $('#keepCount').textContent=keep.length;$('#flipCount').textContent=flip.length;
  const item=id=>{const x=ESSENCES.find(e=>e[0]===id),m=metrics(id,ov);return `<a href="${tradeLink(id)}" target="_blank" rel="noopener"><img src="${icon(id)}"><span>${esc(x[1])} × ${fmt(state.qty[id],0)}</span><b class="${m.profit>=0?'up':'down'}">${m.convert?'↻ '+fmt(chaosToDisplay(m.profit),state.currency==='chaos'?2:1):'保留'}</b></a>`};
  $('#keep').innerHTML=keep.map(item).join('')||'<div class="empty">暂无</div>';$('#flip').innerHTML=flip.map(item).join('')||'<div class="empty">暂无</div>';
}
function renderAll(){renderTable();renderResults();}
function generate(){const min=Math.max(0,Math.floor(num($('#minQty').value))),max=Math.max(min,Math.floor(num($('#maxQty').value)));state.selected.forEach(id=>state.qty[id]=Math.floor(Math.random()*(max-min+1))+min);save();renderAll();}
function demo(){const vals=[486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486];ESSENCES.forEach(([id],i)=>{state.prices[id]={buy:vals[i],sell:vals[(i+3)%20]};state.qty[id]=i<5?20:0;});state.provider='示例数据';save();renderAll();}
function clearPrices(){ESSENCES.forEach(([id])=>state.prices[id]={buy:0,sell:0});state.provider='本地价格';save();renderAll();}

async function loadNinja(){
  const btns=[...document.querySelectorAll('[data-action="ninja"]')];btns.forEach(b=>{b.disabled=true;b.textContent='获取中…'});$('#provider').textContent='正在读取 poe.ninja…';
  try {
    const league='Standard';
    const [items,currency]=await Promise.all([
      fetch(`https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(league)}&type=Essence`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('itemoverview HTTP '+r.status);return r.json()}),
      fetch(`https://poe.ninja/api/data/currencyoverview?league=${encodeURIComponent(league)}&type=Currency`,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error('currencyoverview HTTP '+r.status);return r.json()})
    ]);
    const lines=items.lines||[]; let count=0;
    for(const [id,,en] of ESSENCES){const hit=lines.find(x=>String(x.name||'').toLowerCase()===en.toLowerCase());if(hit&&num(hit.chaosValue)>0){const v=num(hit.chaosValue);state.prices[id]={buy:v,sell:v};count++;}}
    const div=currency.lines?.find(x=>String(x.name||'').toLowerCase()==='divine orb'); if(div&&num(div.chaosEquivalent)>0) state.divChaos=num(div.chaosEquivalent);
    state.provider=`poe.ninja · ${count}/20`;save();shell();bind();renderAll();
  } catch(e){state.provider='Ninja 获取失败';save();$('#provider').textContent='Ninja 获取失败（保留当前价格）';console.error(e);} finally {document.querySelectorAll('[data-action="ninja"]').forEach(b=>{b.disabled=false;b.textContent='从 poe.ninja 获取价格'});}
}
function trade(ids){if(!ids.length){alert('没有可交易的项目。');return;}const links=ids.map(tradeLink);navigator.clipboard?.writeText(links.join('\n'));if(links.length===1)window.open(links[0],'_blank');else alert(`已复制 ${links.length} 个 Trade 搜索链接。`);}
function bind(){
  $('#divChaos').oninput=e=>{state.divChaos=Math.max(1,num(e.target.value,7150));save();renderAll()};
  $('#lfPerRoll').oninput=e=>{state.lfPerRoll=Math.max(1,num(e.target.value,30));save();renderAll()};
  $('#lfPerDiv').oninput=e=>{state.lfPerDiv=Math.max(1,num(e.target.value,22150));save();renderAll()};
  document.querySelectorAll('[data-currency]').forEach(b=>b.onclick=()=>{state.currency=b.dataset.currency;save();shell();bind();renderAll()});
  document.querySelectorAll('[data-strategy]').forEach(b=>b.onclick=()=>{state.strategy=b.dataset.strategy;save();shell();bind();renderAll()});
  document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{const a=b.dataset.action;
    if(a==='reset'){localStorage.clear();location.reload();}
    else if(a==='ninja'||a==='import')loadNinja();
    else if(a==='demo')demo(); else if(a==='clear')clearPrices(); else if(a==='generate')generate();
    else if(a==='sort'){state.sort=state.sort==='profit'?'name':'profit';save();renderAll();}
    else if(a==='all'){state.selected=new Set(ESSENCES.map(([id])=>id));save();renderAll();}
    else if(a==='none'){state.selected.clear();save();renderAll();}
    else if(a==='good'){const ov=state.strategy==='optimal'?optimalValues():null;state.selected=new Set(ESSENCES.filter(([id])=>metrics(id,ov).convert).map(([id])=>id));save();renderAll();}
    else if(a==='bad'){const ov=state.strategy==='optimal'?optimalValues():null;state.selected=new Set(ESSENCES.filter(([id])=>!metrics(id,ov).convert).map(([id])=>id));save();renderAll();}
    else if(a==='tradeSelected')trade([...state.selected]);
    else if(a==='tradeKeep'){const ov=state.strategy==='optimal'?optimalValues():null;trade(ESSENCES.filter(([id])=>state.selected.has(id)&&!metrics(id,ov).convert).map(([id])=>id));}
    else if(a==='tradeFlip'){const ov=state.strategy==='optimal'?optimalValues():null;trade(ESSENCES.filter(([id])=>state.selected.has(id)&&metrics(id,ov).convert).map(([id])=>id));}
  });
}
function render(){shell();bind();renderAll();}
render();
