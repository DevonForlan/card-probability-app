const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];

const RANK_VALUE_TEN = {
  A:1,
  "2":2,
  "3":3,
  "4":4,
  "5":5,
  "6":6,
  "7":7,
  "8":8,
  "9":9,
  "10":10,
  J:0.5,
  Q:0.5,
  K:0.5
};

const RANK_ORDER = {
  A:1,
  "2":2,
  "3":3,
  "4":4,
  "5":5,
  "6":6,
  "7":7,
  "8":8,
  "9":9,
  "10":10,
  J:11,
  Q:12,
  K:13
};

let state = {
  currentGame: "ten",
  ten: {
    decks: 1,
    history: [],
    hand: [],
    mode: "hand"
  },
  dragon: {
    decks: 2,
    history: [],
    roundCards: [],
    mode: "round",
    guess: "high"
  }
};

const $ = (id) => document.getElementById(id);

function cleanupOldServiceWorker(){
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }

  if ("caches" in window) {
    caches.keys().then(keys => {
      keys.forEach(key => caches.delete(key));
    });
  }
}

cleanupOldServiceWorker();

function baseCountPerRank(game = state.currentGame){
  return state[game].decks * 4;
}

function usedCounts(game = state.currentGame){
  const counts = Object.fromEntries(RANKS.map(r => [r, 0]));

  for (const item of state[game].history) {
    counts[item.rank]++;
  }

  return counts;
}

function remainingCounts(game = state.currentGame){
  const used = usedCounts(game);

  return Object.fromEntries(
    RANKS.map(r => [r, Math.max(0, baseCountPerRank(game) - used[r])])
  );
}

function remainingTotal(game = state.currentGame){
  return Object.values(remainingCounts(game)).reduce((a,b)=>a+b,0);
}

function fmtProb(n, d){
  if (!d) return "--";
  return `${(n / d * 100).toFixed(0)}%`;
}

function listText(arr, emptyText = "尚未記錄"){
  if (!arr.length) return emptyText;
  if (arr.length <= 8) return arr.join(", ");
  return `${arr.slice(-8).join(", ")}（共 ${arr.length} 張）`;
}

function rankListToText(ranks){
  return ranks.length ? ranks.join(", ") : "無";
}

function cardsByKind(game, kind){
  return state[game].history
    .filter(x => x.kind === kind)
    .map(x => x.rank);
}

function addCard(rank){
  const game = state.currentGame;
  const s = state[game];
  const rem = remainingCounts(game);

  if (rem[rank] <= 0) {
    alert(`${rank} 已經沒有剩餘牌。`);
    return;
  }

  let kind = "";

  if (game === "ten") {
    kind = s.mode === "hand" ? "ten-hand" : "ten-table";

    if (kind === "ten-hand") {
      s.hand.push(rank);
    }
  }

  if (game === "dragon") {
    kind = s.mode === "round" ? "dragon-round" : "dragon-table";

    if (kind === "dragon-round") {
      if (s.roundCards.length >= 3) {
        alert("本局已經有三張牌，請按新一局或切換為檯面已出牌。");
        return;
      }

      s.roundCards.push(rank);
    }
  }

  s.history.push({
    rank,
    kind,
    time: Date.now()
  });

  save();
  render();
}

function undo(){
  const game = state.currentGame;
  const s = state[game];
  const item = s.history.pop();

  if (!item) return;

  if (item.kind === "ten-hand") {
    s.hand.pop();
  }

  if (item.kind === "dragon-round") {
    s.roundCards.pop();
  }

  save();
  render();
}

function newRound(){
  if (state.currentGame === "ten") {
    state.ten.hand = [];
  }

  if (state.currentGame === "dragon") {
    state.dragon.roundCards = [];
  }

  save();
  render();
}

function shuffleDeck(){
  const game = state.currentGame;
  const label = game === "ten" ? "十點半" : "射龍門";

  if (!confirm(`確認重洗 ${label} 牌堆？這會清空此遊戲的所有已出現牌紀錄。`)) return;

  state[game].history = [];

  if (game === "ten") {
    state.ten.hand = [];
  }

  if (game === "dragon") {
    state.dragon.roundCards = [];
  }

  save();
  render();
}

/* 十點半 */
function tenTotal(){
  return state.ten.hand.reduce((sum, r) => sum + RANK_VALUE_TEN[r], 0);
}

function tenStats(){
  const total = tenTotal();
  const rem = remainingCounts("ten");
  const d = remainingTotal("ten");

  let safe = 0;
  let bust = 0;
  let exact = 0;

  const safeRanks = [];
  const exactRanks = [];

  for (const r of RANKS) {
    const c = rem[r];
    if (!c) continue;

    const next = total + RANK_VALUE_TEN[r];

    if (next <= 10.5) {
      safe += c;
      safeRanks.push(r);
    } else {
      bust += c;
    }

    if (next === 10.5) {
      exact += c;
      exactRanks.push(r);
    }
  }

  return { total, safe, bust, exact, d, safeRanks, exactRanks };
}

function renderTen(){
  const stats = tenStats();

  $("tenTotal").textContent = stats.total.toFixed(1);
  $("safeProb").textContent = fmtProb(stats.safe, stats.d);
  $("bustProb").textContent = fmtProb(stats.bust, stats.d);
  $("exactProb").textContent = fmtProb(stats.exact, stats.d);

  $("tenHandText").textContent = listText(state.ten.hand, "尚未加入");
  $("tenTableText").textContent = listText(cardsByKind("ten", "ten-table"), "尚未記錄");

  $("tenRemainingCards").textContent = remainingTotal("ten");
  $("tenSeenCards").textContent = state.ten.history.length;
  $("tenDeckSelect").value = String(state.ten.decks);

  let rec = "請先輸入手牌。";

  if (state.ten.hand.length) {
    if (stats.total > 10.5) {
      rec = "已爆牌，請開新一局。";
    } else if (stats.total === 10.5) {
      rec = "剛好 10.5，可停牌。";
    } else if (stats.bust > stats.safe) {
      rec = `偏向停牌。安全牌：${rankListToText(stats.safeRanks)}。`;
    } else {
      rec = `可考慮補牌。剛好 10.5：${rankListToText(stats.exactRanks)}。`;
    }
  }

  $("tenRecommendation").textContent = rec;

  renderRanks("tenRanks", "ten");
}

/* 射龍門 */
function dragonStats(){
  const cards = state.dragon.roundCards;
  const rem = remainingCounts("dragon");
  const d = remainingTotal("dragon");

  if (cards.length < 2) return null;

  const a = cards[0];
  const b = cards[1];
  const oa = RANK_ORDER[a];
  const ob = RANK_ORDER[b];

  if (oa === ob) {
    let high = 0;
    let low = 0;
    let same = 0;

    const highRanks = [];
    const lowRanks = [];
    const sameRanks = [];

    for (const r of RANKS) {
      const c = rem[r];
      if (!c) continue;

      const o = RANK_ORDER[r];

      if (o > oa) {
        high += c;
        highRanks.push(r);
      } else if (o < oa) {
        low += c;
        lowRanks.push(r);
      } else {
        same += c;
        sameRanks.push(r);
      }
    }

    const win = state.dragon.guess === "high" ? high : low;

    return {
      mode:"same",
      d,
      high,
      low,
      same,
      win,
      highRanks,
      lowRanks,
      sameRanks,
      base:a
    };
  }

  const lowRank = oa < ob ? a : b;
  const highRank = oa > ob ? a : b;

  const low = Math.min(oa, ob);
  const high = Math.max(oa, ob);

  let inside = 0;
  let upper = 0;
  let lower = 0;
  let outside = 0;

  const insideRanks = [];
  const upperRanks = [];
  const lowerRanks = [];
  const outsideRanks = [];

  for (const r of RANKS) {
    const c = rem[r];
    if (!c) continue;

    const o = RANK_ORDER[r];

    if (o > low && o < high) {
      inside += c;
      insideRanks.push(r);
    } else if (o === high) {
      upper += c;
      upperRanks.push(r);
    } else if (o === low) {
      lower += c;
      lowerRanks.push(r);
    } else {
      outside += c;
      outsideRanks.push(r);
    }
  }

  return {
    mode:"normal",
    d,
    lowRank,
    highRank,
    inside,
    upper,
    lower,
    outside,
    insideRanks,
    upperRanks,
    lowerRanks,
    outsideRanks
  };
}

function renderDragon(){
  const stats = dragonStats();

  $("dragonCardsText").textContent = listText(state.dragon.roundCards, "請輸入前兩張");
  $("dragonTableText").textContent = listText(cardsByKind("dragon", "dragon-table"), "尚未記錄");

  $("dragonRemainingCards").textContent = remainingTotal("dragon");
  $("dragonSeenCards").textContent = state.dragon.history.length;
  $("dragonDeckSelect").value = String(state.dragon.decks);

  $("sameControls").classList.toggle("show", stats?.mode === "same");

  if (!stats) {
    $("dragonMainLabel").textContent = "進門";
    $("dragonUpperLabel").textContent = "撞上柱";
    $("dragonLowerLabel").textContent = "撞下柱";
    $("dragonLoseLabel").textContent = "出門";

    $("dragonWinProb").textContent = "--";
    $("dragonUpperProb").textContent = "--";
    $("dragonLowerProb").textContent = "--";
    $("dragonLoseProb").textContent = "--";

    $("dragonBreakdown").textContent = "輸入兩張牌後開始計算。";
  } else if (stats.mode === "same") {
    $("dragonMainLabel").textContent = state.dragon.guess === "high" ? "猜大" : "猜小";
    $("dragonUpperLabel").textContent = "大牌";
    $("dragonLowerLabel").textContent = "小牌";
    $("dragonLoseLabel").textContent = "同點";

    $("dragonWinProb").textContent = fmtProb(stats.win, stats.d);
    $("dragonUpperProb").textContent = fmtProb(stats.high, stats.d);
    $("dragonLowerProb").textContent = fmtProb(stats.low, stats.d);
    $("dragonLoseProb").textContent = fmtProb(stats.same, stats.d);

    $("dragonBreakdown").innerHTML =
      `<b>同點：</b>${stats.base}。` +
      `猜大贏：${rankListToText(stats.highRanks)}；` +
      `猜小贏：${rankListToText(stats.lowRanks)}；` +
      `同點雙倍輸：${rankListToText(stats.sameRanks)}。`;
  } else {
    $("dragonMainLabel").textContent = "進門";
    $("dragonUpperLabel").textContent = "撞上柱";
    $("dragonLowerLabel").textContent = "撞下柱";
    $("dragonLoseLabel").textContent = "出門";

    $("dragonWinProb").textContent = fmtProb(stats.inside, stats.d);
    $("dragonUpperProb").textContent = fmtProb(stats.upper, stats.d);
    $("dragonLowerProb").textContent = fmtProb(stats.lower, stats.d);
    $("dragonLoseProb").textContent = fmtProb(stats.outside, stats.d);

    $("dragonBreakdown").innerHTML =
      `<b>龍門：</b>${stats.lowRank} 到 ${stats.highRank}。` +
      `進門：${rankListToText(stats.insideRanks)}；` +
      `上柱：${rankListToText(stats.upperRanks)}；` +
      `下柱：${rankListToText(stats.lowerRanks)}；` +
      `出門：${rankListToText(stats.outsideRanks)}。`;
  }

  renderRanks("dragonRanks", "dragon");
}

/* common */
function renderRanks(containerId, game){
  const rem = remainingCounts(game);
  const el = $(containerId);

  el.innerHTML = "";

  for (const r of RANKS) {
    const btn = document.createElement("button");

    btn.className = "rank-btn" + (rem[r] <= 0 ? " disabled" : "");
    btn.innerHTML = `${r}<small>${rem[r]}</small>`;
    btn.disabled = rem[r] <= 0;
    btn.onclick = () => {
      state.currentGame = game;
      addCard(r);
    };

    el.appendChild(btn);
  }
}

function renderDeck(){
  const game = state.currentGame;
  const rem = remainingCounts(game);

  $("remainingTable").innerHTML = RANKS.map(r =>
    `<div class="remaining-cell"><strong>${r}</strong><span>${rem[r]}</span></div>`
  ).join("");

  const recent = [...state[game].history].slice(-16).reverse();

  $("historyList").innerHTML = recent.length
    ? recent.map(item => `<div class="history-item">${item.rank} · ${labelKind(item.kind)}</div>`).join("")
    : "尚無紀錄";
}

function labelKind(kind){
  return {
    "ten-hand":"十點半：我的手牌",
    "ten-table":"十點半：檯面已出牌",
    "dragon-round":"射龍門：本局牌",
    "dragon-table":"射龍門：檯面已出牌"
  }[kind] || kind;
}

function syncActiveButtons(){
  document.querySelectorAll("[data-ten-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tenMode === state.ten.mode);
  });

  document.querySelectorAll("[data-dragon-mode]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.dragonMode === state.dragon.mode);
  });

  document.querySelectorAll("[data-guess]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.guess === state.dragon.guess);
  });
}

function render(){
  syncActiveButtons();
  renderTen();
  renderDragon();
  renderDeck();
}

/* storage */
function save(){
  localStorage.setItem("card-prob-state-v10", JSON.stringify(state));
}

function load(){
  try {
    const raw = localStorage.getItem("card-prob-state-v10");
    if (raw) {
      const saved = JSON.parse(raw);
      state = {
        ...state,
        ...saved
      };
    }
  } catch(e) {}
}

/* events */
function bind(){
  document.querySelectorAll(".tab").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      $(`${btn.dataset.tab}Panel`).classList.add("active");

      if (btn.dataset.tab === "ten") state.currentGame = "ten";
      if (btn.dataset.tab === "dragon") state.currentGame = "dragon";

      save();
      render();
    };
  });

  document.querySelectorAll("[data-ten-mode]").forEach(btn => {
    btn.onclick = () => {
      state.ten.mode = btn.dataset.tenMode;
      save();
      render();
    };
  });

  document.querySelectorAll("[data-dragon-mode]").forEach(btn => {
    btn.onclick = () => {
      state.dragon.mode = btn.dataset.dragonMode;
      save();
      render();
    };
  });

  document.querySelectorAll("[data-guess]").forEach(btn => {
    btn.onclick = () => {
      state.dragon.guess = btn.dataset.guess;
      save();
      render();
    };
  });

  $("tenNewRound").onclick = () => {
    state.currentGame = "ten";
    newRound();
  };

  $("dragonNewRound").onclick = () => {
    state.currentGame = "dragon";
    newRound();
  };

  $("undoBtn").onclick = undo;
  $("globalUndo").onclick = undo;

  $("shuffleBtn").onclick = shuffleDeck;
  $("globalShuffle").onclick = shuffleDeck;

  $("tenDeckSelect").onchange = (e) => {
    if (state.ten.history.length && !confirm("調整十點半牌副數會重洗十點半牌堆，確認嗎？")) {
      e.target.value = String(state.ten.decks);
      return;
    }

    state.ten.decks = Number(e.target.value);
    state.ten.history = [];
    state.ten.hand = [];
    save();
    render();
  };

  $("dragonDeckSelect").onchange = (e) => {
    if (state.dragon.history.length && !confirm("調整射龍門牌副數會重洗射龍門牌堆，確認嗎？")) {
      e.target.value = String(state.dragon.decks);
      return;
    }

    state.dragon.decks = Number(e.target.value);
    state.dragon.history = [];
    state.dragon.roundCards = [];
    save();
    render();
  };
}

load();
bind();
render();
