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
  sort: 'profit',
  source: 'local'
};
for (const [id] of ESSENCES) { if (!(id in state.prices)) state.prices[id] = 0; if (!(id in state.qty)) state.qty[id] = 100; }
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
function save() { localStorage.setItem('poe2-essence-prices', JSON.stringify(state.prices)); localStorage.setItem('poe2-essence-qty', JSON.stringify(state.qty)); localStorage.setItem('poe2-rate', String(state.rate)); localStorage.setItem('poe2-lf', String(state.lf)); }
function shell() {
$('#app').innerHTML=`<header class="topbar"><div class="topbar-inner"><a class="brand" href=".">PoE Tools<span> · 中文版</span></a><nav class="nav"><a class="active">精华</a><a>化石</a><a>催化剂</a><a>精油</a><a>裂界碎片</a><a>其他</a></nav><button class="top-link" data-action="reset">重置</button></div></header>
<main class="workspace">
<aside class="panel left-panel"><div class="panel-title"><span>转换设置</span><small>ESSENCE EXCHANGE</small></div>
<div class="control-block"><label>神圣石汇率</label><div class="input-unit"><input id="rate" type="number" min="1" value="${state.rate}"><span>混沌 / 神圣</span></div></div>
<div class="control-block"><label>每次转换命能</label><div class="input-unit"><input id="lf" type="number" min="1" value="${state.lf}"><span>命能</span></div></div>
<div class="control-block"><label>批量数量</label><div class="range-row"><input id="min" type="number" value="50"><span>—</span><input id="max" type="number" value="500"></div><button class="wide-btn" data-action="generate">随机填充数量</button></div>
<div class="control-block"><label>价格数据</label><div class="source-status"><i></i><span id="sourceText">本地价格</span></div><button class="wide-btn primary" data-action="ninja">从 Ninja 获取价格</button><small class="hint">使用 poe.ninja / economy API；失败时保留本地价格。</small></div>
<div class="control-block"><label>快速选择</label><div class="button-grid"><button data-action="all">全部</button><button data-action="none">清空</button><button data-action="good">仅盈利</button><button data-action="bad">仅亏损</button></div></div>
<div class="control-block"><button class="wide-btn" data-action="demo">载入示例价格</button><button class="wide-btn" data-action="zero">清空所有价格</button><button class="wide-btn" data-action="copy">复制盈利精华</button></div>
<div class="panel-footer"><span>数据自动保存到浏览器</span><button data-action="save">保存</button></div></aside>
<section class="center-panel"><div class="center-head"><div><h1>精华转换</h1><p>调整数量与市场价格，实时计算每种精华转换的收益。</p></div><div class="head-actions"><button data-action="sort">${state.sort==='profit'?'利润 ↓':'名称 A-Z'}</button></div></div>
<div class="table-wrap"><table class="profit-table"><thead><tr><th class="check-col"></th><th>精华</th><th>数量</th><th>买入价格</th><th>直接出售</th><th>转换期望</th><th>命能成本</th><th>单件利润</th><th>ROI</th><th>建议</th></tr></thead><tbody id="items"></tbody></table></div></section>
<aside class="panel right-panel"><div class="panel-title"><span>转换结果</span><small>LIVE SUMMARY</small></div>
<div class="right-section"><div class="right-label">已选择精华 <strong id="selectedCount">0</strong></div><div id="selectedList" class="selected-list"></div></div>
<div class="summary-card"><div><span>投入价值</span><strong id="spent">0.000</strong></div><div><span>命能成本</span><strong id="lfCost">0.000</strong></div><div><span>直接出售</span><strong id="direct">0.000</strong></div><div><span>转换后期望</span><strong id="earned">0.000</strong></div></div>
<div class="net-card"><span>预计净利润</span><strong id="profit">0.000</strong><div>ROI <b id="roi">0.00%</b></div></div>
<div class="right-section"><div class="right-label">转换建议</div><div id="recommendations" class="recommendations"></div></div></aside></main><footer>PoE Tools · 中文 GoE 风格精华转换器 · 市场价格来源：poe.ninja · 非 Grinding Gear Games 官方项目</footer>`;
}
function visibleRows(){const rows=ESSENCES.map(x=>({x,p:unitProfit(x[0]),r:roi(x[0])}));if(state.sort==='profit')rows.sort((a,b)=>b.p-a.p);else rows.sort((a,b)=>a.x[1].localeCompare(b.x[1],'zh'));return rows;}
function renderItems(){ $('#items').innerHTML=visibleRows().map(({x,p,r})=>{const id=x[0],selected=state.selected.has(id),profitable=p>=0;return `<tr class="${profitable?'row-good':'row-bad'} ${selected?'':'row-off'}"><td class="check-col"><input data-check="${id}" type="checkbox" ${selected?'checked':''}></td><td><div class="essence-name"><img src="${icon(id)}" onerror="this.style.opacity=.2"><div><strong>${x[1]}</strong><small>${x[2]}</small></div></div></td><td><input class="cell-input qty-input" data-qty="${id}" type="number" min="0" value="${qty(id)}"></td><td><input class="cell-input price-input" data-price="${id}" type="number" min="0" step="0.001" value="${price(id)}"></td><td class="num">${fmt(directValue(id))}</td><td class="num">${fmt(expectedSellValue(id))}</td><td class="num muted">${fmt(lfCost())}</td><td class="num ${profitable?'up':'down'}">${p>=0?'+':''}${fmt(p)}</td><td class="num ${profitable?'up':'down'}">${(r*100).toFixed(1)}%</td><td><span class="status ${profitable?'status-good':'status-bad'}">${profitable?'转换':'出售'}</span></td></tr>`;}).join('');
 document.querySelectorAll('[data-price]').forEach(el=>el.addEventListener('input',e=>{state.prices[e.target.dataset.price]=Math.max(0,num(e.target.value));save();renderAll();}));
 document.querySelectorAll('[data-qty]').forEach(el=>el.addEventListener('input',e=>{state.qty[e.target.dataset.qty]=Math.max(0,num(e.target.value));save();renderResults();renderSelected();}));
 document.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',e=>{const id=e.target.dataset.check;e.target.checked?state.selected.add(id):state.selected.delete(id);renderItems();renderResults();renderSelected();}));
 $('#selectedCount').textContent=state.selected.size;}
function renderSelected(){const chosen=[...state.selected];$('#selectedList').innerHTML=chosen.length?chosen.map(id=>{const x=ESSENCES.find(e=>e[0]===id),p=unitProfit(id);return `<div class="selected-item"><img src="${icon(id)}"><span>${x[1]}</span><b class="${p>=0?'up':'down'}">${p>=0?'+':''}${fmt(p)}</b></div>`}).join(''):'<div class="empty">未选择任何精华</div>';}
function renderResults(){const chosen=[...state.selected];const spent=chosen.reduce((s,id)=>s+qty(id)*directValue(id),0);const conversionCost=chosen.reduce((s,id)=>s+qty(id)*lfCost(),0);const earned=chosen.reduce((s,id)=>s+qty(id)*expectedSellValue(id),0);const net=earned-spent-conversionCost;$('#spent').textContent=fmt(spent);$('#lfCost').textContent=fmt(conversionCost);$('#direct').textContent=fmt(spent);$('#earned').textContent=fmt(earned);$('#profit').textContent=`${net>=0?'+':''}${fmt(net)}`;$('#profit').className=net>=0?'up':'down';$('#roi').textContent=`${spent?(net/spent*100).toFixed(2):'0.00'}%`;const profitable=ESSENCES.map(([id,name])=>({name,p:unitProfit(id)})).filter(x=>x.p>=0).sort((a,b)=>b.p-a.p).slice(0,5);$('#recommendations').innerHTML=profitable.map(x=>`<div><span>${x.name}</span><b class="up">+${fmt(x.p)}</b></div>`).join('')||'<div class="empty">暂无盈利项目</div>';}
function renderAll(){renderItems();renderSelected();renderResults();}
function demoPrices(){const values=[18,20,23,25,27,30,34,38,42,48];ESSENCES.forEach(([id],i)=>{state.prices[id]=values[i%values.length];state.qty[id]=100+(i%5)*50;});state.source='demo';save();renderAll();}
function randomizeQty(){const min=Math.max(0,Math.floor(num($('#min').value,50))),max=Math.max(min,Math.floor(num($('#max').value,500)));ESSENCES.forEach(([id])=>state.qty[id]=Math.floor(Math.random()*(max-min+1))+min);save();renderAll();}
function copyProfitable(){const text=ESSENCES.filter(([id])=>unitProfit(id)>=0).map(([,name])=>name).join(', ');if(text)navigator.clipboard?.writeText(text);}
async function loadNinja(){const btn=document.querySelector('[data-action="ninja"]');const old=btn.textContent;btn.disabled=true;btn.textContent='获取中…';$('#sourceText').textContent='正在获取 poe.ninja';try{const urls=['https://poe.ninja/api/data/itemoverview?league=Standard&type=Essence','https://poe.ninja/api/data/itemoverview?league=Standard&type=Essences'];let data=null;for(const url of urls){try{const r=await fetch(url,{headers:{Accept:'application/json'}});if(r.ok){data=await r.json();break;}}catch(e){}}if(!data?.lines?.length)throw new Error('Ninja API unavailable');const map=new Map(data.lines.map(x=>[String(x.name||'').toLowerCase(),x.chaosValue??x.chaosValue??0]));let count=0;for(const [id,cn,en] of ESSENCES){const candidates=[en,`Deafening Essence of ${en.replace(/^Deafening Essence of /,'')}`,id].map(x=>x.toLowerCase());const hit=data.lines.find(x=>candidates.includes(String(x.name||'').toLowerCase()));if(hit&&num(hit.chaosValue)>0){state.prices[id]=1/num(hit.chaosValue);count++;}}state.source='poe.ninja';save();renderAll();$('#sourceText').textContent=`poe.ninja · ${count} 项`;}catch(e){$('#sourceText').textContent='Ninja 获取失败，使用本地价格';alert('poe.ninja API 暂时无法访问。浏览器跨域或接口变更时会发生这种情况，请稍后重试。');}finally{btn.disabled=false;btn.textContent=old;}}
function bind(){ $('#rate').addEventListener('input',e=>{state.rate=Math.max(1,num(e.target.value,7150));save();renderAll();});$('#lf').addEventListener('input',e=>{state.lf=Math.max(1,num(e.target.value,30));save();renderAll();});document.querySelectorAll('[data-action]').forEach(button=>button.addEventListener('click',()=>{const a=button.dataset.action;if(a==='ninja')return loadNinja();if(a==='demo')demoPrices();if(a==='zero'){ESSENCES.forEach(([id])=>state.prices[id]=0);save();renderAll();}if(a==='sort'){state.sort=state.sort==='profit'?'name':'profit';renderAll();}if(a==='all'){state.selected=new Set(ESSENCES.map(([id])=>id));renderAll();}if(a==='none'){state.selected.clear();renderAll();}if(a==='good'){state.selected=new Set(ESSENCES.filter(([id])=>unitProfit(id)>=0).map(([id])=>id));renderAll();}if(a==='bad'){state.selected=new Set(ESSENCES.filter(([id])=>unitProfit(id)<0).map(([id])=>id));renderAll();}if(a==='generate')randomizeQty();if(a==='copy')copyProfitable();if(a==='save'){save();alert('已保存。');}if(a==='reset'){localStorage.clear();location.reload();}}));}
function render(){shell();bind();renderAll();}render();