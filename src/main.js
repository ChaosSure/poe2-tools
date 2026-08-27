import { ESSENCES, icon } from './data/essences.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const saved = JSON.parse(localStorage.getItem('poe2-essence-prices') || '{}');
const state = {
  rate: Number(localStorage.getItem('poe2-rate') || 150),
  prices: saved,
  selected: new Set(ESSENCES.map(x => x[0])),
  strategy: 'safe',
  sort: 'profit-desc'
};
for (const [id] of ESSENCES) if (!(id in state.prices)) state.prices[id] = 1;

const fmt = (v, digits = 3) => Number(v || 0).toFixed(digits);
const price = id => Number(state.prices[id]) || 0;
const lfCost = () => 30 / Math.max(1, state.rate);
const expected = id => {
  const values = ESSENCES.filter(x => x[0] !== id).map(x => price(x[0]) ? 1 / price(x[0]) : 0);
  return values.reduce((a, b) => a + b, 0) / values.length;
};
const profit = id => expected(id) - (price(id) ? 1 / price(id) : 0) - lfCost();
const save = () => {
  localStorage.setItem('poe2-essence-prices', JSON.stringify(state.prices));
  localStorage.setItem('poe2-rate', state.rate);
};

function shell() {
  $('#app').innerHTML = `
    <header class="topbar">
      <div class="brand">Gains of Exile</div>
      <nav class="nav"><a class="active">精华</a><a>腐化精华</a><a>化石</a><a>催化剂</a><a>精油</a><a>Deli</a></nav>
      <a class="help">帮助 / FAQ</a>
    </header>
    <main class="page">
      <section class="welcome">
        <p>欢迎，流放者。你来到了 <b>Gains of Exile 中文版</b> —— 一个帮助计算《流放之路》货币转换收益的工具。</p>
        <p>设置市场价格后，计算器会自动估算转换后的期望价值，并显示盈利与亏损。</p>
      </section>

      <section class="settings panel-line">
        <div class="setting-row">
          <span class="setting-title">货币：</span>
          <button class="pill active">⚫ 混沌石</button>
          <button class="pill">1 / 🟣 神圣石</button>
          <span class="inline-input"><input id="rate" type="number" min="1" step="1" value="${state.rate}"> 混沌石 / 神圣石</span>
        </div>
        <div class="setting-row">
          <span class="setting-title">价格：</span>
          <button class="text-btn" data-action="zero">设为 0</button>
          <button class="text-btn" data-action="demo">载入示例</button>
          <button class="text-btn" data-action="save">保存价格</button>
          <button class="text-btn" data-action="sort">按利润排序</button>
        </div>
        <div class="setting-row quantity">
          <span class="setting-title">数量生成：</span>
          <span>介于</span><input id="min" type="number" value="50"><span>和</span><input id="max" type="number" value="500"><span>之间</span>
          <button class="text-btn" data-action="generate">生成</button>
        </div>
        <div class="setting-row">
          <span class="setting-title">复选框：</span>
          <button class="text-btn" data-action="all">全部</button>
          <button class="text-btn" data-action="none">无</button>
          <button class="text-btn" data-action="good">仅盈利</button>
          <button class="text-btn" data-action="bad">仅亏损</button>
        </div>
      </section>

      <section class="essence-section">
        <div class="section-title"><h1>精华</h1><span>价格：神圣石 / 件 · 转换成本：30 生命力</span></div>
        <div id="items" class="items"></div>
      </section>

      <section class="flip-section">
        <h1>翻转速查表</h1>
        <div class="strategy"><button class="active" data-strategy="safe">安全</button><button data-strategy="risky">风险</button></div>
        <div class="flip-row"><b class="keep">保留</b><div id="keep" class="chips"></div></div>
        <div class="flip-row"><b class="turn">翻转</b><div id="flip" class="chips"></div></div>
      </section>

      <section class="results">
        <h1>Profits &amp; Losses</h1>
        <div class="result-grid">
          <div><h2>Spent</h2><p>投入精华：<strong id="spent">0.000</strong> 🟣</p><p>转换生命力：<strong id="lfCost">0.000</strong> 🟣</p></div>
          <div><h2>Earned</h2><p>直接出售：<strong id="direct">0.000</strong> 🟣</p><p>转换后出售：<strong id="earned">0.000</strong> 🟣</p></div>
        </div>
        <div class="summary">预计利润 <strong id="profit">0.000</strong> 🟣 <span>ROI <strong id="roi">0.00%</strong></span></div>
      </section>
    </main>
    <footer>PoE Tools · 中文版 · 非 Grinding Gear Games 官方项目</footer>`;
}

function renderItems() {
  let rows = ESSENCES.map(x => ({ x, p: profit(x[0]) }));
  if (state.sort === 'profit-desc') rows.sort((a, b) => b.p - a.p);
  $('#items').innerHTML = rows.map(({ x, p: pr }) => {
    const id = x[0], p = price(id);
    return `<article class="item ${pr >= 0 ? 'good' : 'bad'}">
      <div class="icon-wrap"><img src="${icon(id)}" onerror="this.style.visibility='hidden'"><span>${x[1]}</span><small>${x[2]}</small></div>
      <div class="fields">
        <label>价格 <input data-price="${id}" type="number" min="0" step="0.001" value="${p}"></label>
        <label>预计利润 <b class="${pr >= 0 ? 'profit-up' : 'profit-down'}">${fmt(pr)}</b> 🟣</label>
        <label class="check">参与生成 <input data-check="${id}" type="checkbox" ${state.selected.has(id) ? 'checked' : ''}></label>
      </div>
    </article>`;
  }).join('');

  document.querySelectorAll('[data-price]').forEach(el => el.addEventListener('input', e => {
    state.prices[e.target.dataset.price] = Number(e.target.value) || 0;
    save(); renderItems(); renderLookup(); renderResults();
  }));
  document.querySelectorAll('[data-check]').forEach(el => el.addEventListener('change', e => {
    e.target.checked ? state.selected.add(e.target.dataset.check) : state.selected.delete(e.target.dataset.check);
    renderResults();
  }));
}

function renderLookup() {
  const rows = ESSENCES.map(x => ({ x, p: profit(x[0]) })).sort((a, b) => b.p - a.p);
  $('#keep').innerHTML = rows.filter(r => r.p < 0).map(r => `<span class="chip"><img src="${icon(r.x[0])}"><small>${r.x[1]}</small></span>`).join('');
  $('#flip').innerHTML = rows.filter(r => r.p >= 0).map(r => `<span class="chip"><img src="${icon(r.x[0])}"><small>${r.x[1]}</small><em>${fmt(r.p)}</em></span>`).join('');
}

function renderResults() {
  const chosen = [...state.selected];
  const spent = chosen.reduce((s, id) => s + price(id), 0);
  const gains = chosen.reduce((s, id) => s + Math.max(0, profit(id)), 0);
  const cost = chosen.length * lfCost();
  $('#spent').textContent = fmt(spent);
  $('#lfCost').textContent = fmt(cost);
  $('#direct').textContent = fmt(spent);
  $('#earned').textContent = fmt(spent + gains);
  $('#profit').textContent = fmt(gains - cost);
  $('#roi').textContent = `${spent ? ((gains - cost) / spent * 100).toFixed(2) : '0.00'}%`;
}

function render() {
  shell();
  $('#rate').addEventListener('input', e => { state.rate = Number(e.target.value) || 150; save(); renderItems(); renderLookup(); renderResults(); });
  document.querySelectorAll('[data-action]').forEach(b => b.addEventListener('click', () => {
    const a = b.dataset.action;
    if (a === 'zero') { ESSENCES.forEach(([id]) => state.prices[id] = 0); save(); renderItems(); renderLookup(); renderResults(); }
    if (a === 'demo') { ESSENCES.forEach(([id], i) => state.prices[id] = Number((0.8 + (i % 7) * .35).toFixed(2))); save(); renderItems(); renderLookup(); renderResults(); }
    if (a === 'save') save();
    if (a === 'sort') { state.sort = state.sort === 'profit-desc' ? 'name' : 'profit-desc'; renderItems(); }
    if (a === 'all') { ESSENCES.forEach(([id]) => state.selected.add(id)); renderItems(); renderResults(); }
    if (a === 'none') { state.selected.clear(); renderItems(); renderResults(); }
    if (a === 'good') { ESSENCES.forEach(([id]) => profit(id) >= 0 ? state.selected.add(id) : state.selected.delete(id)); renderItems(); renderResults(); }
    if (a === 'bad') { ESSENCES.forEach(([id]) => profit(id) < 0 ? state.selected.add(id) : state.selected.delete(id)); renderItems(); renderResults(); }
    if (a === 'generate') {
      const min = Number($('#min').value) || 50, max = Math.max(min, Number($('#max').value) || 500);
      let total = 0; document.querySelectorAll('[data-check]').forEach(e => { if (e.checked) total += Math.floor(Math.random() * (max - min + 1)) + min; });
      alert(`已生成 ${total.toLocaleString()} 件物品的模拟数量。`);
    }
  }));
  document.querySelectorAll('[data-strategy]').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('[data-strategy]').forEach(x => x.classList.remove('active')); b.classList.add('active'); state.strategy = b.dataset.strategy;
  }));
  renderItems(); renderLookup(); renderResults();
}

render();