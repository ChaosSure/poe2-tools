import { ESSENCES, icon } from './data/essences.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const saved = JSON.parse(localStorage.getItem('poe2-essence-prices') || '{}');
const savedQty = JSON.parse(localStorage.getItem('poe2-essence-qty') || '{}');
const state = {
  rate: Number(localStorage.getItem('poe2-rate') || 7150),
  lf: Number(localStorage.getItem('poe2-lf') || 30),
  prices: saved,
  qty: savedQty,
  selected: new Set(ESSENCES.map(([id]) => id)),
  sort: 'profit'
};
for (const [id] of ESSENCES) { if (!(id in state.prices)) state.prices[id] = 1; if (!(id in state.qty)) state.qty[id] = 100; }
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const fmt = (v, digits = 3) => num(v).toFixed(digits);
const price = id => Math.max(0, num(state.prices[id]));
const qty = id => Math.max(0, num(state.qty[id]));
const lfCost = () => state.lf / Math.max(1, state.rate);
const expectedSellValue = id => {
  const others = ESSENCES.filter(([other]) => other !== id);
  return others.length ? others.reduce((sum, [other]) => sum + (price(other) > 0 ? 1 / price(other) : 0), 0) / others.length : 0;
};
const directValue = id => price(id) > 0 ? 1 / price(id) : 0;
const unitProfit = id => expectedSellValue(id) - directValue(id) - lfCost();
const roi = id => directValue(id) > 0 ? unitProfit(id) / directValue(id) : 0;
function save() {
  localStorage.setItem('poe2-essence-prices', JSON.stringify(state.prices));
  localStorage.setItem('poe2-essence-qty', JSON.stringify(state.qty));
  localStorage.setItem('poe2-rate', String(state.rate));
  localStorage.setItem('poe2-lf', String(state.lf));
}
function shell() {
  $('#app').innerHTML = `
<header class="topbar"><div class="topbar-inner"><a class="brand" href=".">Gains of Exile<span> · 中文版</span></a><nav class="nav"><a class="active">精华</a><a>化石</a><a>催化剂</a><a>精油</a><a>裂界碎片</a><a>其他</a></nav><button class="top-link" data-action="reset">重置</button></div></header>
<main class="page">
<section class="intro"><h1>精华转换收益计算器</h1><p>输入你实际能买入和卖出的价格，计算使用生命力转换精华是否值得。数据保存在浏览器本地。</p></section>
<section class="toolbar">
 <div class="toolbar-group"><label class="toolbar-label">货币</label><button class="seg active">混沌石</button><button class="seg">神圣石</button><label class="compact-input"><input id="rate" type="number" min="1" step="1" value="${state.rate}"><span>混沌 / 神圣</span></label></div>
 <div class="toolbar-group"><label class="toolbar-label">生命力</label><label class="compact-input"><input id="lf" type="number" min="1" step="1" value="${state.lf}"><span>/ 次转换</span></label></div>
 <div class="toolbar-actions"><button data-action="demo">载入示例</button><button data-action="zero">清空价格</button><button data-action="sort">${state.sort === 'profit' ? '按利润排序' : '按名称排序'}</button></div>
</section>
<section class="subtoolbar"><div class="quantity-control"><strong>数量</strong><span>介于</span><input id="min" type="number" value="50"><span>和</span><input id="max" type="number" value="500"><span>之间</span><button data-action="generate">随机生成</button></div><div class="selection-control"><strong>选择</strong><button data-action="all">全部</button><button data-action="none">无</button><button data-action="good">仅盈利</button><button data-action="bad">仅亏损</button></div><div class="data-actions"><button data-action="copy">复制盈利精华</button><button data-action="save">保存</button></div></section>
<section class="data-section"><div class="section-head"><div><h2>精华</h2><span>同阶精华按等概率计算转换后的期望价值</span></div><span id="selectionSummary">0 项已选择</span></div><div class="table-wrap"><table class="profit-table"><thead><tr><th class="check-col"></th><th class="name-col">精华</th><th>数量</th><th>买入价格</th><th>直接出售</th><th>转换期望</th><th>生命力</th><th>单件利润</th><th>ROI</th><th>状态</th></tr></thead><tbody id="items"></tbody></table></div></section>
<section class="conversion-section"><div class="section-head"><div><h2>转换速查</h2><span>绿色表示更适合转换，红色表示直接出售更好</span></div></div><div class="conversion-grid"><div class="conversion-side keep-side"><h3>保留 / 出售</h3><div id="keep" class="chips"></div></div><div class="conversion-side flip-side"><h3>推荐转换</h3><div id="flip" class="chips"></div></div></div></section>
<section class="results"><div class="section-head"><div><h2>Profits &amp; Losses</h2><span>仅统计当前勾选的精华</span></div></div><div class="result-grid"><div class="metric"><span>投入精华</span><strong id="spent">0.000</strong><small> 🟣</small></div><div class="metric"><span>转换生命力成本</span><strong id="lfCost">0.000</strong><small> 🟣</small></div><div class="metric"><span>直接出售价值</span><strong id="direct">0.000</strong><small> 🟣</small></div><div class="metric"><span>转换后期望价值</span><strong id="earned">0.000</strong><small> 🟣</small></div></div><div class="profit-summary"><span>预计净利润</span><strong id="profit">0.000</strong><span>🟣</span><em>ROI <b id="roi">0.00%</b></em></div></section>
</main><footer>PoE Tools · Gains of Exile 风格中文工具 · 非 Grinding Gear Games 官方项目</footer>`;
}
function visibleRows() {
  const rows = ESSENCES.map(x => ({ x, p: unitProfit(x[0]), r: roi(x[0]) }));
  if (state.sort === 'profit') rows.sort((a,b) => b.p-a.p); else rows.sort((a,b) => a.x[1].localeCompare(b.x[1], 'zh'));
  return rows;
}
function renderItems() {
  $('#items').innerHTML = visibleRows().map(({x,p,r}) => {
    const id=x[0], selected=state.selected.has(id), profitable=p>=0;
    return `<tr class="${profitable?'row-good':'row-bad'} ${selected?'':'row-off'}"><td class="check-col"><input data-check="${id}" type="checkbox" ${selected?'checked':''}></td><td class="name-col"><div class="essence-name"><img src="${icon(id)}" onerror="this.classList.add('missing')"><div><strong>${x[1]}</strong><small>${x[2]}</small></div></div></td><td><input class="cell-input qty-input" data-qty="${id}" type="number" min="0" step="1" value="${qty(id)}"></td><td><input class="cell-input price-input" data-price="${id}" type="number" min="0" step="0.001" value="${price(id)}"></td><td class="num">${fmt(directValue(id))}</td><td class="num">${fmt(expectedSellValue(id))}</td><td class="num muted">${fmt(lfCost())}</td><td class="num profit ${profitable?'up':'down'}">${p>=0?'+':''}${fmt(p)}</td><td class="num ${profitable?'up':'down'}">${(r*100).toFixed(1)}%</td><td><span class="status ${profitable?'status-good':'status-bad'}">${profitable?'转换':'出售'}</span></td></tr>`;
  }).join('');
  document.querySelectorAll('[data-price]').forEach(el => el.addEventListener('input',e=>{state.prices[e.target.dataset.price]=Math.max(0,num(e.target.value));save();renderAll();}));
  document.querySelectorAll('[data-qty]').forEach(el => el.addEventListener('input',e=>{state.qty[e.target.dataset.qty]=Math.max(0,num(e.target.value));save();renderResults();}));
  document.querySelectorAll('[data-check]').forEach(el => el.addEventListener('change',e=>{const id=e.target.dataset.check;e.target.checked?state.selected.add(id):state.selected.delete(id);renderItems();renderResults();}));
  $('#selectionSummary').textContent=`${state.selected.size} / ${ESSENCES.length} 项已选择`;
}
function renderLookup() {
  const rows=ESSENCES.map(x=>({x,p:unitProfit(x[0])})).sort((a,b)=>b.p-a.p);
  $('#keep').innerHTML=rows.filter(r=>r.p<0).map(r=>`<button class="chip"><img src="${icon(r.x[0])}"><span>${r.x[1]}</span><em>出售</em></button>`).join('')||'<span class="empty">没有亏损项目</span>';
  $('#flip').innerHTML=rows.filter(r=>r.p>=0).map(r=>`<button class="chip"><img src="${icon(r.x[0])}"><span>${r.x[1]}</span><em>+${fmt(r.p)}</em></button>`).join('')||'<span class="empty">没有盈利项目</span>';
}
function renderResults() {
  const chosen=[...state.selected];
  const spent=chosen.reduce((s,id)=>s+qty(id)*directValue(id),0);
  const conversionCost=chosen.reduce((s,id)=>s+qty(id)*lfCost(),0);
  const earned=chosen.reduce((s,id)=>s+qty(id)*expectedSellValue(id),0);
  const net=earned-spent-conversionCost;
  $('#spent').textContent=fmt(spent);$('#lfCost').textContent=fmt(conversionCost);$('#direct').textContent=fmt(spent);$('#earned').textContent=fmt(earned);$('#profit').textContent=`${net>=0?'+':''}${fmt(net)}`;$('#profit').className=net>=0?'up':'down';$('#roi').textContent=`${spent?(net/spent*100).toFixed(2):'0.00'}%`;
}
function renderAll(){renderItems();renderLookup();renderResults();}
function demoPrices(){ESSENCES.forEach(([id],i)=>{const values=[18,20,23,25,27,30,34,38,42,48];state.prices[id]=values[i%values.length];state.qty[id]=100+(i%5)*50;});save();renderAll();}
function randomizeQty(){const min=Math.max(0,Math.floor(num($('#min').value,50))),max=Math.max(min,Math.floor(num($('#max').value,500)));ESSENCES.forEach(([id])=>state.qty[id]=Math.floor(Math.random()*(max-min+1))+min);save();renderAll();}
function copyProfitable(){const text=ESSENCES.filter(([id])=>unitProfit(id)>=0).map(([,name])=>name).join(', ');if(!text){alert('当前没有盈利精华。');return;}navigator.clipboard?.writeText(text).then(()=>alert(`已复制 ${text.split(', ').length} 个推荐转换精华。`));}
function bind(){
  $('#rate').addEventListener('input',e=>{state.rate=Math.max(1,num(e.target.value,7150));save();renderAll();});
  $('#lf').addEventListener('input',e=>{state.lf=Math.max(1,num(e.target.value,30));save();renderAll();});
  document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const a=button.dataset.action;if(a==='demo')demoPrices();if(a==='zero'){ESSENCES.forEach(([id])=>state.prices[id]=0);save();renderAll();}if(a==='sort'){state.sort=state.sort==='profit'?'name':'profit';renderItems();}if(a==='all'){state.selected=new Set(ESSENCES.map(([id])=>id));renderItems();renderResults();}if(a==='none'){state.selected.clear();renderItems();renderResults();}if(a==='good'){state.selected=new Set(ESSENCES.filter(([id])=>unitProfit(id)>=0).map(([id])=>id));renderItems();renderResults();}if(a==='bad'){state.selected=new Set(ESSENCES.filter(([id])=>unitProfit(id)<0).map(([id])=>id));renderItems();renderResults();}if(a==='generate')randomizeQty();if(a==='copy')copyProfitable();if(a==='save'){save();alert('价格和数量已保存到本机浏览器。');}if(a==='reset'){localStorage.removeItem('poe2-essence-prices');localStorage.removeItem('poe2-essence-qty');localStorage.removeItem('poe2-rate');localStorage.removeItem('poe2-lf');location.reload();}}));
}
function render(){shell();bind();renderAll();}
render();
