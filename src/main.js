import { ESSENCES, icon } from './data/essences.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const saved = JSON.parse(localStorage.getItem('poe2-essence-prices') || '{}');
const state = { rate: Number(localStorage.getItem('poe2-rate') || 150), prices: saved, selected: new Set(ESSENCES.map(x=>x[0])), strategy:'safe' };
for (const [id] of ESSENCES) if (!(id in state.prices)) state.prices[id] = 1;

function div(v){ return Number(v||0).toFixed(3); }
function price(id){ return Number(state.prices[id]) || 0; }
function cost(){ return 30 / Math.max(1,state.rate); }
function expectedExcluding(id){
  const xs=ESSENCES.filter(x=>x[0]!==id).map(x=>price(x[0]) ? 1/price(x[0]) : 0);
  return xs.reduce((a,b)=>a+b,0)/xs.length;
}
function profit(id){ return expectedExcluding(id) - (price(id)?1/price(id):0) - cost(); }
function save(){ localStorage.setItem('poe2-essence-prices',JSON.stringify(state.prices)); localStorage.setItem('poe2-rate',state.rate); }

function shell(){
  $('#app').innerHTML=`
  <header class="top"><div class="brand">GoE</div><nav class="nav">
    <a class="active" href="#">精华</a><a href="#">腐化精华</a><a href="#">化石</a><a href="#">催化剂</a><a href="#">精油</a><a href="#">Deli</a>
  </nav><a class="faq" href="#">帮助 / FAQ</a></header>
  <main class="page">
    <section class="intro"><p>欢迎，流放者。你来到了 <b>Gains of Exile 中文版</b> —— 一个帮助计算《流放之路》货币转换收益的工具。</p><p>输入价格后，计算器会判断出售还是使用生命力转换，并给出预计收益。</p></section>
    <section class="controls">
      <div class="control-row"><span class="label">货币：</span><button class="selected">⚫ 混沌石</button><button>1 / 🟣 神圣石</button><span class="rate"><input id="rate" type="number" min="1" step="1" value="${state.rate}"> 混沌石 / 神圣石</span></div>
      <div class="control-row"><span class="label">物品价格：</span><button data-action="zero">设为 0</button><button data-action="demo">载入示例</button><button data-action="save">保存</button></div>
      <div class="control-row"><span class="label">数量生成：</span><span>介于</span><input id="min" type="number" value="50"><span>和</span><input id="max" type="number" value="500"><span>之间</span></div>
      <div class="checks"><span class="label">复选框：</span><button data-action="all">全部</button><button data-action="none">无</button><button data-action="good">高收益</button><button data-action="bad">低收益</button></div>
      <button class="generate" data-action="generate">← 生成 →</button>
    </section>
    <section><div class="section-head"><h2>精华</h2><span>价格单位：神圣石 / 件</span></div><div id="items" class="items"></div></section>
    <section class="lookup"><h1>翻转速查表</h1><div class="strategy"><button class="selected" data-strategy="safe">安全</button><button data-strategy="risky">风险</button></div><div class="flip-row"><b>保留：</b><div id="keep" class="chips"></div></div><div class="flip-row"><b class="red">翻转：</b><div id="flip" class="chips"></div></div></section>
    <section class="results"><h1>Profits &amp; Losses</h1><div class="result-grid"><div><h3>Spent</h3><p>购买物品：<b id="spent">0.00</b> 🟣</p><p>安全转换 LF：<b id="lfCost">0.00</b> 🟣</p></div><div><h3>Earned</h3><p>如果直接出售：<b id="direct">0.00</b> 🟣</p><p>转换后出售：<b id="earned">0.00</b> 🟣</p></div></div><div class="expected">预计利润：<b id="profit">0.00</b> 🟣　ROI：<b id="roi">0.00%</b></div></section>
  </main><footer>PoE Tools · 中文版 · 非 Grinding Gear Games 官方项目</footer>`;
}

function renderItems(){
  $('#items').innerHTML=ESSENCES.map(([id,cn,en])=>{
    const p=price(id), pr=profit(id); return `<article class="item ${pr>=0?'positive':''}"><div class="icon-wrap"><img src="${icon(id)}" onerror="this.style.opacity='.2'"><span>${cn}</span><small>${en}</small></div><div class="fields"><label>价格 <input data-price="${id}" type="number" min="0" step="0.001" value="${p}"></label><label>利润 <b>${div(pr)}</b> 🟣</label><label class="check">生成 <input data-check="${id}" type="checkbox" ${state.selected.has(id)?'checked':''}></label></div></article>`;
  }).join('');
  document.querySelectorAll('[data-price]').forEach(el=>el.addEventListener('input',e=>{state.prices[e.target.dataset.price]=Number(e.target.value)||0;save();renderItems();renderResults();renderLookup();}));
  document.querySelectorAll('[data-check]').forEach(el=>el.addEventListener('change',e=>{e.target.checked?state.selected.add(e.target.dataset.check):state.selected.delete(e.target.dataset.check);renderLookup();}));
}
function renderLookup(){
 const rows=ESSENCES.map(x=>({x, p:profit(x[0])})).sort((a,b)=>b.p-a.p); const cutoff=0;
 $('#keep').innerHTML=rows.filter(r=>r.p<cutoff).map(r=>`<span class="chip"><img src="${icon(r.x[0])}">${r.x[1]}</span>`).join('');
 $('#flip').innerHTML=rows.filter(r=>r.p>=cutoff).map(r=>`<span class="chip"><img src="${icon(r.x[0])}">${r.x[1]}<em>${div(r.p)}</em></span>`).join('');
}
function renderResults(){
 let chosen=[...state.selected]; let total=chosen.reduce((s,id)=>s+price(id),0); let positive=chosen.reduce((s,id)=>s+Math.max(0,profit(id)),0); let lf=chosen.length*30/state.rate; $('#spent').textContent=div(total); $('#lfCost').textContent=div(lf); $('#direct').textContent=div(total); $('#earned').textContent=div(total+positive); $('#profit').textContent=div(positive-lf); $('#roi').textContent=(total?((positive-lf)/total*100):0).toFixed(2)+'%';
}
function demo(){ESSENCES.forEach(([id],i)=>state.prices[id]=Number((0.8+i%7*.35).toFixed(2)));save();render();}
function zero(){ESSENCES.forEach(([id])=>state.prices[id]=0);save();render();}
function setSelected(fn){ESSENCES.forEach(([id])=>fn(id));renderItems();renderLookup();renderResults();}
function generate(){const min=Number($('#min').value)||50,max=Math.max(min,Number($('#max').value)||500);let total=0;document.querySelectorAll('[data-check]').forEach(e=>{if(e.checked){const n=Math.floor(Math.random()*(max-min+1))+min; total+=n; e.closest('.item').dataset.qty=n;}});alert(`已生成 ${total.toLocaleString()} 件物品的模拟数量。`);}

function render(){shell(); $('#rate').addEventListener('input',e=>{state.rate=Number(e.target.value)||150;save();renderItems();renderLookup();renderResults();}); document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>{const a=b.dataset.action;if(a==='zero')zero();if(a==='demo')demo();if(a==='save')save();if(a==='all')setSelected(id=>state.selected.add(id));if(a==='none')setSelected(id=>state.selected.delete(id));if(a==='good')setSelected(id=>profit(id)>=0?state.selected.add(id):state.selected.delete(id));if(a==='bad')setSelected(id=>profit(id)<0?state.selected.add(id):state.selected.delete(id));if(a==='generate')generate();}));renderItems();renderLookup();renderResults();}
render();
