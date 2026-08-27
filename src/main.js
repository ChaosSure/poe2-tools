import { ESSENCES, icon } from './data/essences.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const load = (k, fallback) => { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };

const state = {
  currency: localStorage.getItem('poe2-currency') || 'chaos',
  divChaos: Number(localStorage.getItem('poe2-div-chaos') || 7150),
  lfPerDiv: Number(localStorage.getItem('poe2-lf-per-div') || 22150),
  lfCostMode: localStorage.getItem('poe2-lf-mode') || 'divine',
  lfPerRoll: Number(localStorage.getItem('poe2-lf-roll') || 30),
  strategy: localStorage.getItem('poe2-strategy') || 'one',
  prices: load('poe2-essence-prices-v2', {}),
  qty: load('poe2-essence-qty-v2', {}),
  selected: new Set(ESSENCES.map(([id]) => id)),
  sort: 'profit',
  provider: '本地价格'
};
for (const [id] of ESSENCES) {
  if (!state.prices[id]) state.prices[id] = { buy: 0, sell: 0 };
  if (!(id in state.qty)) state.qty[id] = 0;
}

const num = (v, f = 0) => Number.isFinite(Number(v)) ? Number(v) : f;
const fmt = (v, d = 2) => num(v).toFixed(d);
const esc = (s) => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const info = id => state.prices[id] || { buy: 0, sell: 0 };

function toChaos(value) {
  const v = Math.max(0, num(value));
  return state.currency === 'chaos' ? v : (v > 0 ? state.divChaos / v : 0);
}
function fromChaos(value) {
  const v = Math.max(0, num(value));
  return state.currency === 'chaos' ? v : (v > 0 ? state.divChaos / v : 0);
}
function buyChaos(id) { return toChaos(info(id).buy); }
function sellChaos(id) { return toChaos(info(id).sell); }
function lfChaos() {
  if (state.lfCostMode === 'chaos') return state.lfPerRoll * state.lfPerDiv;
  return state.divChaos * (state.lfPerRoll / Math.max(1, state.lfPerDiv));
}
function expectedSell(id) {
  const others = ESSENCES.filter(([other]) => other !== id);
  const vals = others.map(([other]) => sellChaos(other)).filter(v => v > 0);
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}
function profit(id) { return expectedSell(id) - buyChaos(id) - lfChaos(); }
function roi(id) { const b = buyChaos(id); return b > 0 ? profit(id) / b : 0; }
function tradeLink(id) {
  const x = ESSENCES.find(e => e[0] === id);
  const slug = `deafening-essence-of-${id}`;
  const q = encodeURIComponent(JSON.stringify({query:{have:['chaos'],want:[slug],status:{option:'online'}}}));
  return `https://www.pathofexile.com/trade/exchange/Standard?q=${q}`;
}
function save() {
  localStorage.setItem('poe2-currency', state.currency);
  localStorage.setItem('poe2-div-chaos', String(state.divChaos));
  localStorage.setItem('poe2-lf-per-div', String(state.lfPerDiv));
  localStorage.setItem('poe2-lf-mode', state.lfCostMode);
  localStorage.setItem('poe2-lf-roll', String(state.lfPerRoll));
  localStorage.setItem('poe2-strategy', state.strategy);
  localStorage.setItem('poe2-essence-prices-v2', JSON.stringify(state.prices));
  localStorage.setItem('poe2-essence-qty-v2', JSON.stringify(state.qty));
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
        <ol><li><b>货币：</b>按混沌石还是神圣石计算？</li><li><b>数量：</b>你有多少精华？</li><li><b>价格：</b>当前市场价格如何？</li><li><b>转换：</b>命能成本是多少？</li></ol>
      </section>
      <section class="box"><h3>1. 货币</h3>
        <div class="field"><label>一件物品成本</label><div class="unit-input"><input id="currencyModeValue" type="number" step="0.01"><select id="currencyMode"><option value="chaos">混沌 / 件</option><option value="divine">件 / 神圣</option></select></div></div>
        <div class="field"><label>神圣石汇率</label><div class="unit-input"><input id="divChaos" type="number" min="1"><span>混沌</span></div></div>
        <div class="field"><label>货币显示</label><div class="seg"><button data-currency="chaos" class="${state.currency==='chaos'?'on':''}">混沌 / 件</button><button data-currency="divine" class="${state.currency==='divine'?'on':''}">件 / 神圣</button></div></div>
      </section>
      <section class="box"><h3>汇率</h3><div class="rate-line"><b>${fmt(state.divChaos,0)}</b><img src="https://gains-of-exile.vercel.app/images/chaos.png"> = 1 <img src="https://gains-of-exile.vercel.app/images/divine.png"></div><button class="text-btn" data-action="import">导入价格</button></section>
      <section class="box"><h3>2. 数量</h3><p class="muted">在表格中直接设置数量，或批量生成。勾选第 1 列后生成。</p>
        <div class="check-row"><button data-action="all">全选</button><button data-action="none">全不选</button><button data-action="good">盈利</button><button data-action="bad">亏损</button></div>
        <div class="between"><input id="minQty" type="number" value="0"><span>至</span><input id="maxQty" type="number" value="100"> <span>件</span></div><button class="primary-btn" data-action="generate">生成数量</button>
      </section>
      <section class="box"><h3>3. 价格</h3><p class="muted">可以直接编辑表格，也可以从价格服务商获取。</p>
        <div class="provider"><span class="dot"></span><span id="provider">${esc(state.provider)}</span></div>
        <button class="primary-btn" data-action="ninja">从 poe.ninja 获取</button>
        <button class="secondary-btn" data-action="demo">载入示例</button>
      </section>
      <section class="box"><h3>4. 转换 <img class="tiny-icon" src="https://gains-of-exile.vercel.app/images/flip2.png"></h3>
        <p class="muted">园艺台转换一次需要命能。精华之间按等概率计算期望值。</p>
        <div class="field"><label>每次转换命能</label><div class="unit-input"><input id="lfPerRoll" type="number" min="1"><span>命能</span></div></div>
        <div class="field"><label>1 神圣石可购买</label><div class="unit-input"><input id="lfPerDiv" type="number" min="1"><span>命能</span></div></div>
        <div class="strategy"><button data-strategy="one" class="${state.strategy==='one'?'on':''}">一步策略</button><button data-strategy="optimal" class="${state.strategy==='optimal'?'on':''}">最优策略</button></div>
      </section>
    </aside>

    <section class="goe-center"><div class="center-title"><div><h1>精华</h1><p>价格、转换收益与利润一览</p></div><div class="sort"><span>排序</span><button data-action="sort">${state.sort==='profit'?'利润 ↓':'名称 A-Z'}</button></div></div>
      <div class="table-scroll"><table><thead><tr><th class="sel">✓</th><th>精华</th><th>数量</th><th>买入</th><th>出售</th><th>转换期望</th><th>命能</th><th>利润</th><th>ROI</th><th>建议</th></tr></thead><tbody id="table"></tbody></table></div>
    </section>

    <aside class="goe-right"><section class="result-head"><h2>收益与损失</h2><span>实时计算</span></section>
      <section class="result-block"><h3>已花费</h3><div class="result-line"><span>购买精华</span><b id="spent">0</b></div><div class="result-line"><span>转换命能</span><b id="lfSpent">0</b></div></section>
      <section class="result-block"><h3>已获得</h3><div class="result-line"><span>直接出售</span><b id="direct">0</b></div><div class="result-line"><span>转换后出售</span><b id="earned">0</b></div></section>
      <section class="profit-card"><span>预计利润</span><strong id="totalProfit">0</strong><small>ROI：<b id="totalRoi">0.00%</b></small></section>
      <section class="result-block"><h3>保留 <span id="keepCount">0</span></h3><div id="keep" class="result-list"></div></section>
      <section class="result-block"><h3>转换 <span id="flipCount">0</span></h3><div id="flip" class="result-list"></div></section>
      <section class="result-block compact"><div class="result-line"><span>转换次数</span><b id="rolls">0</b></div><div class="result-line"><span>命能需求</span><b id="lfNeeded">0</b></div></section>
      <section class="trade-box"><h3>Trade Links</h3><p>批量搜索选中的精华。</p><div class="trade-buttons"><button data-action="tradeSelected">✔ 已选择</button><button data-action="tradeKeep">$ 保留</button><button data-action="tradeFlip">↻ 转换</button></div></section>
    </aside>
  </main><footer>Gains of Exile 风格中文精华转换器 · 价格来源 poe.ninja · 非 Grinding Gear Games 官方项目</footer>`;
  $('#currencyModeValue').value = state.currency==='chaos' ? 1 : 1;
  $('#divChaos').value = state.divChaos;
  $('#lfPerRoll').value = state.lfPerRoll;
  $('#lfPerDiv').value = state.lfPerDiv;
}

function rows() {
  const arr = ESSENCES.map(x => ({x, p: profit(x[0]), r: roi(x[0]), b: buyChaos(x[0]), s: sellChaos(x[0]), e: expectedSell(x[0])}));
  if (state.sort === 'profit') arr.sort((a,b)=>b.p-a.p); else arr.sort((a,b)=>a.x[1].localeCompare(b.x[1],'zh'));
  return arr;
}
function displayPrice(chaos) { return fmt(fromChaos(chaos), state.currency==='chaos'?2:1); }
function renderTable() {
  $('#table').innerHTML = rows().map(({x,p,r,b,s,e}) => { const id=x[0], q=state.qty[id]||0, selected=state.selected.has(id); const good=p>0; return `<tr class="${selected?'':'dim'}"><td class="sel"><input data-check="${id}" type="checkbox" ${selected?'checked':''}></td><td><a class="essence" href="${tradeLink(id)}" target="_blank" rel="noopener"><img src="${icon(id)}"><span><b>${esc(x[1])}</b><small>${esc(x[2])}</small></span></a></td><td><input class="cell qty" data-qty="${id}" type="number" min="0" value="${q}"></td><td><input class="cell price" data-buy="${id}" type="number" min="0" step="0.01" value="${state.prices[id].buy||''}" placeholder="0"></td><td><input class="cell price" data-sell="${id}" type="number" min="0" step="0.01" value="${state.prices[id].sell||''}" placeholder="0"></td><td class="number">${displayPrice(e)}</td><td class="number muted">${displayPrice(lfChaos())}</td><td class="number ${good?'up':'down'}">${p>=0?'+':''}${displayPrice(p)}</td><td class="number ${good?'up':'down'}">${(r*100).toFixed(1)}%</td><td><span class="tag ${good?'tag-good':'tag-bad'}">${good?'转换':'出售'}</span></td></tr>`; }).join('');
  document.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',e=>{const id=e.target.dataset.check;e.target.checked?state.selected.add(id):state.selected.delete(id);save();renderAll();}));
  document.querySelectorAll('[data-qty]').forEach(el=>el.addEventListener('input',e=>{state.qty[e.target.dataset.qty]=Math.max(0,num(e.target.value));save();renderResults();}));
  document.querySelectorAll('[data-buy]').forEach(el=>el.addEventListener('input',e=>{state.prices[e.target.dataset.buy].buy=Math.max(0,num(e.target.value));save();renderAll();}));
  document.querySelectorAll('[data-sell]').forEach(el=>el.addEventListener('input',e=>{state.prices[e.target.dataset.sell].sell=Math.max(0,num(e.target.value));save();renderAll();}));
}
function renderResults(){
  const chosen=[...state.selected];
  const spent=chosen.reduce((a,id)=>a+(state.qty[id]||0)*buyChaos(id),0);
  const lfSpent=chosen.reduce((a,id)=>a+(state.qty[id]||0)*lfChaos(),0);
  const direct=chosen.reduce((a,id)=>a+(state.qty[id]||0)*sellChaos(id),0);
  const earned=chosen.reduce((a,id)=>a+(state.qty[id]||0)*expectedSell(id),0);
  const net=earned-spent-lfSpent;
  const totalQty=chosen.reduce((a,id)=>a+(state.qty[id]||0),0);
  const keep=chosen.filter(id=>profit(id)<=0).sort((a,b)=>profit(a)-profit(b));
  const flip=chosen.filter(id=>profit(id)>0).sort((a,b)=>profit(b)-profit(a));
  $('#spent').textContent=displayPrice(spent);$('#lfSpent').textContent=displayPrice(lfSpent);$('#direct').textContent=displayPrice(direct);$('#earned').textContent=displayPrice(earned);
  $('#totalProfit').textContent=(net>=0?'+':'')+displayPrice(net);$('#totalProfit').className=net>=0?'up':'down';$('#totalRoi').textContent=(spent?net/spent*100:0).toFixed(2)+'%';
  $('#rolls').textContent=fmt(totalQty,0);$('#lfNeeded').textContent=fmt(totalQty*state.lfPerRoll,0);$('#keepCount').textContent=keep.length;$('#flipCount').textContent=flip.length;
  const item=id=>{const x=ESSENCES.find(e=>e[0]===id);return `<a href="${tradeLink(id)}" target="_blank" rel="noopener"><img src="${icon(id)}"><span>${esc(x[1])}</span><b class="${profit(id)>0?'up':'down'}">${profit(id)>0?'+':''}${displayPrice(profit(id))}</b></a>`};
  $('#keep').innerHTML=keep.map(item).join('')||'<div class="empty">暂无</div>';$('#flip').innerHTML=flip.map(item).join('')||'<div class="empty">暂无</div>';
}
function renderAll(){renderTable();renderResults();}
function generate(){const min=Math.max(0,Math.floor(num($('#minQty').value))),max=Math.max(min,Math.floor(num($('#maxQty').value)));state.selected.forEach(id=>state.qty[id]=Math.floor(Math.random()*(max-min+1))+min);save();renderAll();}
function demo(){const base=[486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486,486];ESSENCES.forEach(([id],i)=>{state.prices[id]={buy:base[i],sell:base[(i+3)%base.length]};state.qty[id]=i<5?20:0;});state.provider='示例数据';save();renderAll();}
function clearPrices(){ESSENCES.forEach(([id])=>state.prices[id]={buy:0,sell:0});state.provider='本地价格';save();renderAll();}
async function loadNinja(){
  const btn=document.querySelector('[data-action="ninja"]');btn.disabled=true;btn.textContent='获取中…';$('#provider').textContent='正在读取 poe.ninja…';
  try{
    const league='Standard'; const r=await fetch(`https://poe.ninja/api/data/itemoverview?league=${league}&type=Essence`,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); const data=await r.json();
    const lines=data.lines||[]; let count=0;
    for(const [id,,en] of ESSENCES){const hit=lines.find(x=>String(x.name||'').toLowerCase()===en.toLowerCase());if(hit&&num(hit.chaosValue)>0){const v=num(hit.chaosValue);state.prices[id]={buy:fromChaos(v),sell:fromChaos(v)};count++;}}
    state.provider=`poe.ninja · ${count}/20`;save();renderAll();
  }catch(e){state.provider='Ninja 获取失败';$('#provider').textContent='Ninja 获取失败（保留当前价格）';console.error(e);}finally{btn.disabled=false;btn.textContent='从 poe.ninja 获取';}
}
function trade(ids){const links=ids.map(tradeLink).join('\n');if(navigator.clipboard)navigator.clipboard.writeText(links);else window.open(tradeLink(ids[0]),'_blank');}
function bind(){
  $('#divChaos').addEventListener('input',e=>{state.divChaos=Math.max(1,num(e.target.value,7150));save();renderAll();});
  $('#lfPerRoll').addEventListener('input',e=>{state.lfPerRoll=Math.max(1,num(e.target.value,30));save();renderAll();});
  $('#lfPerDiv').addEventListener('input',e=>{state.lfPerDiv=Math.max(1,num(e.target.value,22150));save();renderAll();});
  document.querySelectorAll('[data-currency]').forEach(b=>b.addEventListener('click',()=>{state.currency=b.dataset.currency;save();shell();bind();renderAll();}));
  document.querySelectorAll('[data-strategy]').forEach(b=>b.addEventListener('click',()=>{state.strategy=b.dataset.strategy;save();shell();bind();renderAll();}));
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.action;
    if(a==='reset'){localStorage.clear();location.reload();}
    if(a==='ninja')loadNinja(); if(a==='demo')demo(); if(a==='import')loadNinja(); if(a==='generate')generate(); if(a==='sort'){state.sort=state.sort==='profit'?'name':'profit';renderAll();}
    if(a==='all'){state.selected=new Set(ESSENCES.map(([id])=>id));renderAll();} if(a==='none'){state.selected.clear();renderAll();}
    if(a==='good'){state.selected=new Set(ESSENCES.filter(([id])=>profit(id)>0).map(([id])=>id));renderAll();} if(a==='bad'){state.selected=new Set(ESSENCES.filter(([id])=>profit(id)<=0).map(([id])=>id));renderAll();}
    if(a==='tradeSelected')trade([...state.selected]); if(a==='tradeKeep')trade(ESSENCES.filter(([id])=>state.selected.has(id)&&profit(id)<=0).map(([id])=>id)); if(a==='tradeFlip')trade(ESSENCES.filter(([id])=>state.selected.has(id)&&profit(id)>0).map(([id])=>id));
  }));
}
function render(){shell();bind();renderAll();}
render();
