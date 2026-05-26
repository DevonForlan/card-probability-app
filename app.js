const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RANK_VALUE_TEN = {A:1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, J:0.5, Q:0.5, K:0.5};
const RANK_ORDER = {A:1, "2":2, "3":3, "4":4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, J:11, Q:12, K:13};

let state = {
  decks: 1,
  history: [],
  tenHand: [],
  dragonCards: [],
  tenMode: "hand",
  dragonMode: "round",
  dragonGuess: "high"
};

const $ = (id) => document.getElementById(id);
function baseCountPerRank(){ return state.decks * 4; }
function usedCounts(){ const counts = Object.fromEntries(RANKS.map(r => [r, 0])); for (const item of state.history) counts[item.rank]++; return counts; }
function remainingCounts(){ const used = usedCounts(); return Object.fromEntries(RANKS.map(r => [r, Math.max(0, baseCountPerRank() - used[r])])); }
function remainingTotal(){ return Object.values(remainingCounts()).reduce((a,b)=>a+b,0); }
function fmtProb(n, d){ return d ? `${(n / d * 100).toFixed(1)}%` : "--"; }
function rankListToText(ranks){ return ranks.length ? ranks.join(", ") : "無"; }

function addCard(rank, kind){
  const rem = remainingCounts();
  if (rem[rank] <= 0) { alert(`${rank} 已經沒有剩餘牌。`); return; }
  state.history.push({ rank, kind, time: Date.now() });
  if (kind === "ten-hand") state.tenHand.push(rank);
  if (kind === "dragon-round" && state.dragonCards.length < 3) state.dragonCards.push(rank);
  save(); render();
}
function undo(){
  const item = state.history.pop();
  if (!item) return;
  if (item.kind === "ten-hand") state.tenHand.pop();
  if (item.kind === "dragon-round") state.dragonCards.pop();
  save(); render();
}
function newTenRound(){ state.tenHand = []; save(); render(); }
function newDragonRound(){ state.dragonCards = []; save(); render(); }
function shuffleDeck(){
  if (!confirm("確認重洗牌？這會清空所有已出現牌紀錄。")) return;
  state.history = []; state.tenHand = []; state.dragonCards = []; save(); render();
}

function chipsForKind(kind){
  const cards = state.history.filter(x => x.kind === kind).map(x => x.rank);
  return cards.length ? cards.slice(-20).map(r => `<span class="chip">${r}</span>`).join("") : null;
}

function tenTotal(){ return state.tenHand.reduce((sum, r) => sum + RANK_VALUE_TEN[r], 0); }
function tenStats(){
  const total = tenTotal(), rem = remainingCounts(), d = remainingTotal();
  let safe = 0, bust = 0, exact = 0; const safeRanks = [], bustRanks = [], exactRanks = [];
  for (const r of RANKS) {
    const c = rem[r]; if (!c) continue;
    const next = total + RANK_VALUE_TEN[r];
    if (next <= 10.5) { safe += c; safeRanks.push(r); } else { bust += c; bustRanks.push(r); }
    if (next === 10.5) { exact += c; exactRanks.push(r); }
  }
  return { total, safe, bust, exact, d, safeRanks, bustRanks, exactRanks };
}

function dragonStats(){
  const cards = state.dragonCards, rem = remainingCounts(), d = remainingTotal();
  if (cards.length < 2) return null;
  const a = cards[0], b = cards[1], oa = RANK_ORDER[a], ob = RANK_ORDER[b];

  if (oa === ob) {
    let high = 0, low = 0, same = 0; const highRanks = [], lowRanks = [], sameRanks = [];
    for (const r of RANKS) {
      const c = rem[r]; if (!c) continue;
      const o = RANK_ORDER[r];
      if (o > oa) { high += c; highRanks.push(r); }
      else if (o < oa) { low += c; lowRanks.push(r); }
      else { same += c; sameRanks.push(r); }
    }
    const win = state.dragonGuess === "high" ? high : low;
    const lose = state.dragonGuess === "high" ? low : high;
    return { mode:"same", d, high, low, same, win, lose, highRanks, lowRanks, sameRanks, base:a };
  }

  const lowRank = oa < ob ? a : b, highRank = oa > ob ? a : b;
  const low = Math.min(oa, ob), high = Math.max(oa, ob);
  let inside = 0, upper = 0, lower = 0, outside = 0;
  const insideRanks = [], upperRanks = [], lowerRanks = [], outsideRanks = [];

  for (const r of RANKS) {
    const c = rem[r]; if (!c) continue;
    const o = RANK_ORDER[r];
    if (o > low && o < high) { inside += c; insideRanks.push(r); }
    else if (o === high) { upper += c; upperRanks.push(r); }
    else if (o === low) { lower += c; lowerRanks.push(r); }
    else { outside += c; outsideRanks.push(r); }
  }
  return { mode:"normal", d, lowRank, highRank, inside, upper, lower, outside, insideRanks, upperRanks, lowerRanks, outsideRanks };
}

function renderRanks(containerId, handler){
  const rem = remainingCounts(), el = $(containerId); el.innerHTML = "";
  for (const r of RANKS) {
    const btn = document.createElement("button");
    btn.className = "rank-btn" + (rem[r] <= 0 ? " disabled" : "");
    btn.innerHTML = `${r}<small>剩 ${rem[r]}</small>`;
    btn.disabled = rem[r] <= 0;
    btn.onclick = () => handler(r);
    el.appendChild(btn);
  }
}

function renderTen(){
  const stats = tenStats();
  $("tenTotal").textContent = stats.total.toFixed(1);
  $("safeProb").textContent = fmtProb(stats.safe, stats.d);
  $("bustProb").textContent = fmtProb(stats.bust, stats.d);
  $("exactProb").textContent = fmtProb(stats.exact, stats.d);

  $("tenHand").innerHTML = state.tenHand.length ? state.tenHand.map(r => `<span class="chip">${r}</span>`).join("") : "尚未加入手牌";
  $("tenTableCards").innerHTML = chipsForKind("ten-table") || "尚未記錄檯面牌";

  let rec = "請先輸入手牌。";
  if (state.tenHand.length) {
    if (stats.total > 10.5) rec = "已爆牌。請開新一局。";
    else if (stats.total === 10.5) rec = "剛好 10.5，可停牌。";
    else if (stats.bust > stats.safe) rec = `偏向停牌。安全牌：${rankListToText(stats.safeRanks)}。`;
    else rec = `可考慮補牌。剛好 10.5 牌：${rankListToText(stats.exactRanks)}。`;
  }
  $("tenRecommendation").textContent = rec;

  renderRanks("tenRanks", (rank) => addCard(rank, state.tenMode === "hand" ? "ten-hand" : "ten-table"));
}

function renderDragon(){
  $("dragonCards").innerHTML = state.dragonCards.length ? state.dragonCards.map(r => `<span class="chip">${r}</span>`).join("") : "請輸入第一張、第二張";
  $("dragonTableCards").innerHTML = chipsForKind("dragon-table") || "尚未記錄檯面牌";

  const stats = dragonStats();
  $("sameControls").classList.toggle("show", stats?.mode === "same");

  if (!stats) {
    $("dragonWinProb").textContent = "--"; $("dragonUpperProb").textContent = "--"; $("dragonLowerProb").textContent = "--"; $("dragonLoseProb").textContent = "--";
    $("dragonBreakdown").textContent = "輸入兩張牌後開始計算。";
    $("dragonMainLabel").textContent = "進門勝率"; $("dragonUpperLabel").textContent = "撞上柱"; $("dragonLowerLabel").textContent = "撞下柱"; $("dragonLoseLabel").textContent = "出門輸率";
  } else if (stats.mode === "same") {
    $("dragonMainLabel").textContent = state.dragonGuess === "high" ? "猜大勝率" : "猜小勝率";
    $("dragonUpperLabel").textContent = "猜大"; $("dragonLowerLabel").textContent = "猜小"; $("dragonLoseLabel").textContent = "同點雙倍輸";
    $("dragonWinProb").textContent = fmtProb(stats.win, stats.d);
    $("dragonUpperProb").textContent = fmtProb(stats.high, stats.d);
    $("dragonLowerProb").textContent = fmtProb(stats.low, stats.d);
    $("dragonLoseProb").textContent = fmtProb(stats.same, stats.d);
    $("dragonBreakdown").innerHTML = `<b>基準牌：</b>${stats.base}<br><b>猜大贏牌：</b>${rankListToText(stats.highRanks)}<br><b>猜小贏牌：</b>${rankListToText(stats.lowRanks)}<br><b>同點雙倍輸：</b>${rankListToText(stats.sameRanks)}`;
  } else {
    $("dragonMainLabel").textContent = "進門勝率"; $("dragonUpperLabel").textContent = "撞上柱"; $("dragonLowerLabel").textContent = "撞下柱"; $("dragonLoseLabel").textContent = "出門輸率";
    $("dragonWinProb").textContent = fmtProb(stats.inside, stats.d);
    $("dragonUpperProb").textContent = fmtProb(stats.upper, stats.d);
    $("dragonLowerProb").textContent = fmtProb(stats.lower, stats.d);
    $("dragonLoseProb").textContent = fmtProb(stats.outside, stats.d);
    $("dragonBreakdown").innerHTML = `<b>龍門：</b>${stats.lowRank} 到 ${stats.highRank}<br><b>進門贏牌：</b>${rankListToText(stats.insideRanks)}<br><b>撞上柱贏三倍：</b>${rankListToText(stats.upperRanks)}<br><b>撞下柱輸兩倍：</b>${rankListToText(stats.lowerRanks)}<br><b>出門輸牌：</b>${rankListToText(stats.outsideRanks)}`;
  }

  renderRanks("dragonRanks", (rank) => addCard(rank, state.dragonMode === "round" ? "dragon-round" : "dragon-table"));
}

function renderDeck(){
  $("remainingCards").textContent = remainingTotal();
  $("seenCards").textContent = state.history.length;
  $("deckSelect").value = String(state.decks);
  const rem = remainingCounts();
  $("remainingTable").innerHTML = RANKS.map(r => `<div class="remaining-cell"><strong>${r}</strong><span>剩 ${rem[r]}</span></div>`).join("");
  const recent = [...state.history].slice(-16).reverse();
  $("historyList").innerHTML = recent.length ? recent.map(item => `<div class="history-item">${item.rank} · ${labelKind(item.kind)}</div>`).join("") : "尚無紀錄";
}
function labelKind(kind){
  return {
    "ten-hand":"十點半：我的手牌",
    "ten-table":"十點半：檯面已出牌",
    "dragon-round":"射龍門：本局牌",
    "dragon-table":"射龍門：檯面已出牌",
    "seen":"已出牌"
  }[kind] || kind;
}
function render(){ renderDeck(); renderTen(); renderDragon(); }
function save(){ localStorage.setItem("card-prob-state-v2", JSON.stringify(state)); }
function load(){ try { const raw = localStorage.getItem("card-prob-state-v2"); if (raw) state = {...state, ...JSON.parse(raw)}; } catch(e) {} }

function bind(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active"); $(`${btn.dataset.tab}Panel`).classList.add("active");
    };
  });
  document.querySelectorAll("[data-ten-mode]").forEach(btn => {
    btn.onclick = () => {
      state.tenMode = btn.dataset.tenMode;
      document.querySelectorAll("[data-ten-mode]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active"); save();
    };
  });
  document.querySelectorAll("[data-dragon-mode]").forEach(btn => {
    btn.onclick = () => {
      state.dragonMode = btn.dataset.dragonMode;
      document.querySelectorAll("[data-dragon-mode]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active"); save();
    };
  });
  document.querySelectorAll("[data-guess]").forEach(btn => {
    btn.onclick = () => {
      state.dragonGuess = btn.dataset.guess;
      document.querySelectorAll("[data-guess]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active"); save(); render();
    };
  });
  $("deckSelect").onchange = (e) => {
    if (state.history.length && !confirm("調整牌副數會重洗牌並清空紀錄，確認嗎？")) { e.target.value = String(state.decks); return; }
    state.decks = Number(e.target.value); state.history = []; state.tenHand = []; state.dragonCards = []; save(); render();
  };
  $("tenNewRound").onclick = newTenRound; $("dragonNewRound").onclick = newDragonRound;
  $("undoBtn").onclick = undo; $("globalUndo").onclick = undo;
  $("shuffleBtn").onclick = shuffleDeck; $("globalShuffle").onclick = shuffleDeck;
  $("settingsBtn").onclick = () => document.querySelector('[data-tab="deck"]').click();
}
if ("serviceWorker" in navigator) { window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {})); }
load(); bind(); render();
