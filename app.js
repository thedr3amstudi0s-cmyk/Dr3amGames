// ============================================================
// FIREBASE INIT
// ============================================================
let db = null, fbReady = false;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    fbReady = true;
    document.getElementById('configWarning').classList.add('hidden');
  } else {
    document.getElementById('configWarning').innerHTML =
      '<h2 style="color:var(--pink)">⚠️ Firebase placeholder keys detected</h2>' +
      '<p class="muted">firebase-config.js still has YOUR_API_KEY — paste in your real Firebase config and reload.</p>';
  }
} catch(e) {
  document.getElementById('configWarning').innerHTML =
    '<h2 style="color:var(--pink)">⚠️ Firebase init failed</h2>' +
    '<p class="muted">Error: <code>' + e.message + '</code><br>' +
    'Common fix: make sure databaseURL is set and you created a <b>Realtime Database</b> (not Firestore) in your Firebase project.</p>';
  console.error(e);
}

// ============================================================
// HELPERS
// ============================================================
const ref   = (p) => { if(!db) throw new Error("DB null"); return db.ref(p); };
const money = (n) => '$' + Math.max(0,Math.round(n)).toLocaleString();
const now   = ()  => Date.now();
const randId= ()  => 'x' + Math.random().toString(36).slice(2,10);
const slugify=(s) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'player';

let myId = localStorage.getItem('sew_pid') || null;
let myVid = localStorage.getItem('sew_vid');
if (!myVid) { myVid = randId(); localStorage.setItem('sew_vid', myVid); }

let lastPlayers = {};
let gameActive  = false;
let gameEndsAt  = 0;

// ============================================================
// NAV
// ============================================================
const VIEWS = ['join','player','vote','admin'];
function showView(v) {
  VIEWS.forEach(x => {
    document.getElementById('view-'+x).classList.toggle('hidden', x !== v);
    document.getElementById('nav'+x[0].toUpperCase()+x.slice(1)).classList.toggle('active', x === v);
  });
}
document.getElementById('navJoin').onclick   = () => showView('join');
document.getElementById('navPlayer').onclick = () => showView('player');
document.getElementById('navVote').onclick   = () => showView('vote');
document.getElementById('navAdmin').onclick  = () => showView('admin');

// ============================================================
// GAME STATE + TIMER + LOCK
// ============================================================
function lockAllActions(locked) {
  const ids = ['riskBtn','stealBtn','triviaBtn','slotsBtn','duelCoinBtn','duelDiceBtn','giftBtn'];
  ids.forEach(id => { const el = document.getElementById(id); if(el) el.disabled = locked; });
  document.getElementById('gameOverBanner').classList.toggle('hidden', !locked || gameActive);
}

let timerTick;
function startTimerLoop(endsAt) {
  clearInterval(timerTick);
  timerTick = setInterval(() => {
    const remain = Math.max(0, endsAt - now());
    const m = Math.floor(remain / 60000), s = Math.floor((remain % 60000) / 1000);
    const el = document.getElementById('hudTimer');
    if (el) el.textContent = m + ':' + String(s).padStart(2,'0');
    if (remain === 0) {
      clearInterval(timerTick);
      gameActive = false;
      lockAllActions(true);
      document.getElementById('gameOverBanner').classList.remove('hidden');
    }
  }, 500);
}

if (fbReady) {
  ref('game').on('value', snap => {
    const g = snap.val() || {};
    gameActive  = !!(g.started && g.endsAt && g.endsAt > now());
    gameEndsAt  = g.endsAt || 0;
    lockAllActions(!gameActive);
    if (gameActive) startTimerLoop(g.endsAt);
    else { clearInterval(timerTick); const el = document.getElementById('hudTimer'); if(el) el.textContent = 'Ended'; }
  });
}

// ============================================================
// JOIN
// ============================================================
document.getElementById('joinBtn').onclick = async () => {
  if (!fbReady) return;
  const code = document.getElementById('joinCode').value.trim().toUpperCase();
  const name = document.getElementById('joinName').value.trim();
  const msg  = document.getElementById('joinMsg');
  if (!code || !name) { msg.textContent = 'Enter a code and a display name.'; return; }
  const snap = await ref('game/code').once('value');
  if (!snap.val() || code !== String(snap.val()).toUpperCase()) {
    msg.textContent = '❌ Wrong or inactive code — ask the admin.'; return;
  }
  const id = slugify(name);
  const pRef = ref('players/' + id);
  const ex = await pRef.once('value');
  if (!ex.exists()) {
    await pRef.set({ name, cash: STARTING_CASH, businesses:{}, investments:{crypto:0,stocks:0,bonds:0}, lastCollect:{}, lastAction:{}, joinedAt: now() });
  }
  myId = id;
  localStorage.setItem('sew_pid', id);
  msg.textContent = '✅ Joined as ' + name + '! Switch to ⚡ Play.';
  showView('player');
};
if (myId) document.getElementById('joinMsg').textContent = 'Welcome back!';

// ============================================================
// NET WORTH + LEADERBOARD
// ============================================================
function netWorth(p) {
  let nw = p.cash || 0;
  Object.keys(p.businesses || {}).forEach(k => { if (BUSINESSES[k]) nw += BUSINESSES[k].cost * p.businesses[k]; });
  Object.values(p.investments || {}).forEach(v => { nw += v || 0; });
  return nw;
}

function renderLeaderboard(players) {
  const rows = Object.entries(players || {})
    .map(([id,p]) => ({id, ...p, nw: netWorth(p)}))
    .sort((a,b) => b.nw - a.nw);
  const html = rows.length
    ? rows.map((p,i) => `<tr class="${p.id===myId?'me-row':''}">
        <td><b>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</b></td>
        <td>${p.name}</td><td>${money(p.cash)}</td><td class="gold">${money(p.nw)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="muted">No players yet</td></tr>';
  ['lb1','lb2'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = html; });
}

function populateTargetDropdowns(players) {
  ['duelTarget','giftTarget'].forEach(selId => {
    const sel = document.getElementById(selId);
    if (!sel) return;
    const prev = sel.value;
    sel.innerHTML = Object.entries(players)
      .filter(([id]) => id !== myId)
      .map(([id,p]) => `<option value="${id}">${p.name}</option>`).join('');
    if (prev) sel.value = prev;
  });
}

if (fbReady) {
  ref('players').on('value', snap => {
    lastPlayers = snap.val() || {};
    renderLeaderboard(lastPlayers);
    populateTargetDropdowns(lastPlayers);
    if (myId && lastPlayers[myId]) renderPlayerView(lastPlayers[myId]);
  });
}

// ============================================================
// PLAYER HUD + BUSINESSES + INVESTMENTS
// ============================================================
function renderPlayerView(p) {
  document.getElementById('hudName').textContent = p.name;
  document.getElementById('hudCash').textContent = money(p.cash);
  document.getElementById('hudNW').textContent   = money(netWorth(p));
  renderBizGrid(p);
  renderInvestGrid(p);
  renderCooldownLabels(p);
}

function renderBizGrid(p) {
  const grid = document.getElementById('bizGrid');
  if (!grid) return;
  const owned = p.businesses || {}, lc = p.lastCollect || {};
  grid.innerHTML = Object.entries(BUSINESSES).map(([key,b]) => {
    const qty = owned[key] || 0;
    const pending = qty > 0 && lc[key] ? Math.round((now()-lc[key])/60000 * b.income * qty) : 0;
    return `<div class="biz-card">
      <h3>${b.emoji} ${b.name}</h3>
      <div class="biz-meta">Cost: ${money(b.cost)} · Income: ${money(b.income)}/min each · Owned: <b>${qty}</b></div>
      <div class="row">
        <button class="btn" data-buy="${key}" style="flex:1">Buy</button>
        ${qty > 0 ? `<button class="btn gold" data-collect="${key}">Collect ${money(pending)}</button>` : ''}
      </div></div>`;
  }).join('');
  grid.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => buyBiz(b.dataset.buy));
  grid.querySelectorAll('[data-collect]').forEach(b => b.onclick = () => collectBiz(b.dataset.collect));
}

function renderInvestGrid(p) {
  const grid = document.getElementById('investGrid');
  if (!grid) return;
  const inv = p.investments || {};
  grid.innerHTML = Object.entries(INVESTMENTS).map(([key,iv]) => {
    const val = inv[key] || 0;
    return `<div class="biz-card">
      <h3>${iv.emoji} ${iv.name} <span class="muted" style="font-size:.75rem">${iv.label}</span></h3>
      <div class="biz-meta">My holding: <b class="gold">${money(val)}</b></div>
      <div class="spark-wrap" id="spark-${key}"><div class="muted" style="font-size:.72rem;padding:4px">Loading chart…</div></div>
      <div class="spark-stat" id="sparkstat-${key}"><span></span><span></span></div>
      <div class="row" style="margin-top:8px">
        <input type="number" id="inv-${key}" placeholder="$ invest" style="flex:1;min-width:80px">
        <button class="btn" data-inv="${key}">Buy In</button>
        <button class="btn danger" data-out="${key}">Sell All</button>
      </div></div>`;
  }).join('');
  grid.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => investIn(b.dataset.inv));
  grid.querySelectorAll('[data-out]').forEach(b => b.onclick = () => cashOut(b.dataset.out));
}

async function buyBiz(key) {
  if (!gameActive) return;
  const b = BUSINESSES[key], pRef = ref('players/'+myId);
  const snap = await pRef.once('value'), p = snap.val();
  if (!p || p.cash < b.cost) { alert('Not enough cash!'); return; }
  const qty = (p.businesses||{})[key] || 0;
  const u = { cash: p.cash - b.cost, ['businesses/'+key]: qty+1 };
  if (qty === 0) u['lastCollect/'+key] = now();
  await pRef.update(u);
}

async function collectBiz(key) {
  if (!gameActive) return;
  const b = BUSINESSES[key], pRef = ref('players/'+myId);
  const snap = await pRef.once('value'), p = snap.val();
  const qty = (p.businesses||{})[key] || 0, last = (p.lastCollect||{})[key] || now();
  const earned = Math.round((now()-last)/60000 * b.income * qty);
  await pRef.update({ cash: p.cash + earned, ['lastCollect/'+key]: now() });
}

async function investIn(key) {
  if (!gameActive) return;
  const amt = Number(document.getElementById('inv-'+key).value);
  if (!amt || amt <= 0) return;
  const pRef = ref('players/'+myId), snap = await pRef.once('value'), p = snap.val();
  if (!p || p.cash < amt) { alert('Not enough cash!'); return; }
  await pRef.update({ cash: p.cash - amt, ['investments/'+key]: ((p.investments||{})[key]||0) + amt });
  document.getElementById('inv-'+key).value = '';
}

async function cashOut(key) {
  if (!gameActive) return;
  const pRef = ref('players/'+myId), snap = await pRef.once('value'), p = snap.val();
  const val = (p.investments||{})[key] || 0;
  if (!val) return;
  await pRef.update({ cash: p.cash + val, ['investments/'+key]: 0 });
}

// ============================================================
// MARKET + SPARKLINES
// ============================================================
function sparklineSVG(histStr) {
  if (!histStr) return '<div class="muted" style="font-size:.72rem;padding:6px">No data yet — starts when auto events are on.</div>';
  const vals = histStr.split(',').map(Number).filter(n => !isNaN(n));
  if (vals.length < 2) return '<div class="muted" style="font-size:.72rem;padding:6px">Collecting data…</div>';
  const W=200, H=48, P=4, min=Math.min(...vals), max=Math.max(...vals), range=max-min||0.1;
  const pts = vals.map((v,i) => {
    const x = P + (i/(vals.length-1))*(W-P*2);
    const y = H - P - ((v-min)/range)*(H-P*2);
    return x.toFixed(1)+','+y.toFixed(1);
  }).join(' ');
  const last = vals[vals.length-1], first = vals[0];
  const trend = last >= first ? '#00ffc3' : '#ff2d78';
  const lp = pts.split(' ').pop().split(',');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:48px;display:block">
    <polyline points="${pts}" fill="none" stroke="${trend}" stroke-width="1.8" stroke-linejoin="round"/>
    <circle cx="${lp[0]}" cy="${lp[1]}" r="3" fill="${trend}"/>
  </svg>`;
}

if (fbReady) {
  ref('market').on('value', snap => {
    const market = snap.val() || {};
    Object.keys(INVESTMENTS).forEach(key => {
      const m = market[key] || {};
      const sparkEl = document.getElementById('spark-'+key);
      const statEl  = document.getElementById('sparkstat-'+key);
      if (sparkEl) sparkEl.innerHTML = sparklineSVG(m.h || '');
      if (statEl && m.h) {
        const vals = m.h.split(',').map(Number);
        const first = vals[0], last = vals[vals.length-1];
        const pct = (((last - first) / first) * 100).toFixed(1);
        const up = last >= first;
        statEl.innerHTML = `<span class="muted">Start: ${first.toFixed(1)}</span>
          <span class="${up?'green':'red'}">${up?'▲':'▼'} ${Math.abs(pct)}% overall</span>`;
      }
    });
  });
}

// Admin market update — called from auto loop
async function updateMarket() {
  const mSnap = await ref('market').once('value'), market = mSnap.val() || {};
  const pSnap = await ref('players').once('value'), players = pSnap.val() || {};
  const updates = {}, factors = {};

  Object.entries(INVESTMENTS).forEach(([key, iv]) => {
    const vol = iv.volatility;
    const factor = 1 + (Math.random() * vol * 2 - vol);
    factors[key] = factor;
    const h = (market[key] || {}).h || '100';
    const vals = h.split(',').map(Number);
    const last = vals[vals.length-1];
    const next = Math.max(5, parseFloat((last * factor).toFixed(1)));
    vals.push(next);
    if (vals.length > 40) vals.shift();
    updates['market/'+key+'/h'] = vals.join(',');
  });

  // Apply market moves to player investments
  Object.entries(players).forEach(([pid, p]) => {
    Object.keys(INVESTMENTS).forEach(key => {
      const cur = (p.investments || {})[key] || 0;
      if (cur > 0) updates['players/'+pid+'/investments/'+key] = Math.max(0, Math.round(cur * factors[key]));
    });
  });

  await ref('/').update(updates);
}

// ============================================================
// COOLDOWN LABELS
// ============================================================
let cdInterval;
function renderCooldownLabels(p) {
  clearInterval(cdInterval);
  function tick() {
    const la = p.lastAction || {};
    let anyRunning = false;
    Object.entries(ACTIONS).forEach(([key, cfg]) => {
      const el = document.getElementById(key+'Cd');
      const btn = document.getElementById(key+'Btn') || document.getElementById(key==='risk'?'riskBtn':key==='steal'?'stealBtn':key==='trivia'?'triviaBtn':'slotsBtn');
      if (!el) return;
      const remain = Math.ceil(((la[key]||0) + cfg.cooldownSec*1000 - now()) / 1000);
      if (remain > 0) {
        el.textContent = '⏳ ' + remain + 's cooldown';
        if (btn && gameActive) btn.disabled = true;
        anyRunning = true;
      } else {
        el.textContent = '';
        if (btn && gameActive) btn.disabled = false;
      }
    });
    if (!anyRunning) clearInterval(cdInterval);
  }
  tick();
  cdInterval = setInterval(tick, 500);
}

async function getMe() { const s = await ref('players/'+myId).once('value'); return s.val(); }
function onCD(p, key) { return now() < ((p.lastAction||{})[key]||0) + ACTIONS[key].cooldownSec*1000; }

// ============================================================
// ACTION: RISK IT
// ============================================================
document.getElementById('riskBtn').onclick = async () => {
  if (!myId || !gameActive) return;
  const p = await getMe(); if (onCD(p,'risk')) return;
  const amt = Number(document.getElementById('riskAmt').value);
  if (!amt || amt <= 0 || amt > p.cash) { alert('Enter a valid amount you actually have.'); return; }
  const win = Math.random() < 0.5;
  await ref('players/'+myId).update({ cash: Math.max(0, win ? p.cash+amt : p.cash-amt), ['lastAction/risk']: now() });
  document.getElementById('riskAmt').value = '';
  showToast(win ? `🎲 DOUBLED! +${money(amt)}` : `🎲 LOST ${money(amt)}. Rough.`, win ? '#00ffc3' : '#ff2d78');
};

// ============================================================
// ACTION: SABOTAGE
// ============================================================
document.getElementById('sabDesc').textContent = `Steal $${STEAL_AMOUNT} from a random rival. ${Math.round(STEAL_SUCCESS_CHANCE*100)}% success — caught = $${STEAL_FAIL_FINE} fine.`;
document.getElementById('stealBtn').onclick = async () => {
  if (!myId || !gameActive) return;
  const p = await getMe(); if (onCD(p,'steal')) return;
  const rivals = Object.keys(lastPlayers).filter(id => id !== myId);
  if (!rivals.length) { alert('No rivals yet!'); return; }
  const targetId = rivals[Math.floor(Math.random()*rivals.length)];
  const target = lastPlayers[targetId];
  const success = Math.random() < STEAL_SUCCESS_CHANCE;
  if (success) {
    const amt = Math.min(STEAL_AMOUNT, target.cash||0);
    await ref('players/'+targetId+'/cash').set(Math.max(0,(target.cash||0)-amt));
    await ref('players/'+myId).update({ cash: p.cash+amt, ['lastAction/steal']: now() });
    showToast(`🦹 Stole ${money(amt)} from ${target.name}!`, '#00ffc3');
  } else {
    await ref('players/'+myId).update({ cash: Math.max(0,p.cash-STEAL_FAIL_FINE), ['lastAction/steal']: now() });
    showToast(`🚨 Caught! Paid ${money(STEAL_FAIL_FINE)} fine.`, '#ff2d78');
  }
};

// ============================================================
// ACTION: TRIVIA BLITZ
// ============================================================
let triviaActive = false, triviaQ = null, triviaTimerIv = null, triviaStart = 0;

document.getElementById('triviaBtn').onclick = async () => {
  if (!myId || !gameActive || triviaActive) return;
  const p = await getMe(); if (onCD(p,'trivia')) return;
  triviaActive = true;
  triviaQ = TRIVIA_QUESTIONS[Math.floor(Math.random()*TRIVIA_QUESTIONS.length)];

  const CATS = ['Finance','Finance','Finance','Finance','Finance','Finance','Finance','Finance','Finance','Finance',
    'Gaming','Gaming','Gaming','Gaming','Gaming','Gaming','Gaming','Gaming','Gaming','Gaming',
    'Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture','Pop Culture',
    'Science','Science','Science','Science','Science','Science','Science','Science','Science','Science',
    'Sports','Sports','Sports','Sports','Sports','Sports','Sports','Sports','Sports','Sports',
    'Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo','Food & Geo'];
  const qIdx = TRIVIA_QUESTIONS.indexOf(triviaQ);
  document.getElementById('triviaCat').textContent = CATS[qIdx] || 'General Knowledge';
  document.getElementById('triviaQ').textContent = triviaQ.q;
  document.getElementById('triviaResult').classList.add('hidden');

  const opts = document.getElementById('triviaOpts');
  opts.innerHTML = triviaQ.a.map((a,i) =>
    `<button data-i="${i}">${String.fromCharCode(65+i)}. ${a}</button>`).join('');
  opts.querySelectorAll('button').forEach(btn => btn.onclick = () => answerTrivia(Number(btn.dataset.i)));

  document.getElementById('triviaModal').classList.remove('hidden');
  triviaStart = now();

  clearInterval(triviaTimerIv);
  triviaTimerIv = setInterval(() => {
    const elapsed = (now()-triviaStart)/1000;
    const left = Math.max(0, TRIVIA_ANSWER_SECS - elapsed);
    document.getElementById('triviaTimerFill').style.width = (left/TRIVIA_ANSWER_SECS*100)+'%';
    document.getElementById('triviaTimerLabel').textContent = Math.ceil(left)+'s';
    if (left <= 5) document.getElementById('triviaTimerFill').style.background = 'linear-gradient(90deg,var(--pink),#ff6900)';
    if (left <= 0) { clearInterval(triviaTimerIv); answerTrivia(-1); } // time up
  }, 100);
};

async function answerTrivia(choiceIdx) {
  if (!triviaActive) return;
  triviaActive = false;
  clearInterval(triviaTimerIv);

  const elapsed = (now() - triviaStart) / 1000;
  const timeLeft = Math.max(0, TRIVIA_ANSWER_SECS - elapsed);
  const correct = choiceIdx === triviaQ.c;
  const bonus = correct ? Math.max(50, Math.round(TRIVIA_MAX_BONUS * (timeLeft / TRIVIA_ANSWER_SECS))) : 0;

  // Flash answer buttons
  const btns = document.querySelectorAll('#triviaOpts button');
  btns.forEach((btn, i) => {
    btn.disabled = true;
    if (i === triviaQ.c) btn.classList.add('correct');
    else if (i === choiceIdx) btn.classList.add('wrong');
  });

  const res = document.getElementById('triviaResult');
  res.classList.remove('hidden');
  if (choiceIdx === -1) {
    res.textContent = "⏰ Time's up! No bonus.";
    res.style.background = 'rgba(255,45,120,.15)';
  } else if (correct) {
    res.textContent = `✅ Correct! +${money(bonus)} (answered in ${elapsed.toFixed(1)}s)`;
    res.style.background = 'rgba(0,255,195,.12)';
  } else {
    res.textContent = `❌ Wrong! Correct: ${triviaQ.a[triviaQ.c]}`;
    res.style.background = 'rgba(255,45,120,.12)';
  }

  const p = await getMe();
  const updates = { ['lastAction/trivia']: now() };
  if (bonus > 0) updates['cash'] = p.cash + bonus;
  await ref('players/'+myId).update(updates);

  setTimeout(() => {
    document.getElementById('triviaModal').classList.add('hidden');
    document.getElementById('triviaTimerFill').style.background = 'linear-gradient(90deg,var(--accent),var(--gold))';
  }, 2800);
}

// ============================================================
// ACTION: SLOTS
// ============================================================
const SLOT_SYMS  = ['💎','💰','⭐','🔔','🍒','🍋','🎰'];
const SLOT_WEIGHTS = [1, 2, 3, 4, 5, 6, 7];
const SLOT_TOTAL = SLOT_WEIGHTS.reduce((a,b)=>a+b,0);

function weightedSym() {
  let r = Math.random() * SLOT_TOTAL;
  for (let i=0; i<SLOT_SYMS.length; i++) { r -= SLOT_WEIGHTS[i]; if(r<=0) return SLOT_SYMS[i]; }
  return SLOT_SYMS[SLOT_SYMS.length-1];
}

function slotPayout(reels) {
  const [a,b,c] = reels;
  if (a===b && b===c) {
    if (a==='💎') return { win:3000, msg:'💎💎💎 JACKPOT! +$3,000!' };
    if (a==='💰') return { win:1500, msg:'💰💰💰 Big Win! +$1,500!' };
    if (a==='⭐') return { win:800,  msg:'⭐⭐⭐ Nice! +$800!' };
    if (a==='🔔') return { win:600,  msg:'🔔🔔🔔 +$600!' };
    if (a==='🍒') return { win:450,  msg:'🍒🍒🍒 +$450!' };
    return { win:350, msg:`${a}${a}${a} Triple! +$350!` };
  }
  const pairs = [[a,b],[b,c],[a,c]];
  if (pairs.some(([x,y])=>x===y&&x==='💎')) return { win:300, msg:'Two 💎 — nice! +$300' };
  if (pairs.some(([x,y])=>x===y&&x==='💰')) return { win:200, msg:'Two 💰 — break even! +$200' };
  if (pairs.some(([x,y])=>x===y)) return { win:150, msg:'Two matching — tiny win! +$150' };
  return { win:0, msg:'No match. -$200 gone.' };
}

function spinReel(elId, finalSym, stopDelay) {
  const el = document.getElementById(elId);
  el.classList.add('spinning');
  let count = 0;
  const iv = setInterval(() => {
    el.textContent = SLOT_SYMS[Math.floor(Math.random()*SLOT_SYMS.length)];
    count++;
    if (count >= stopDelay) { clearInterval(iv); el.textContent = finalSym; el.classList.remove('spinning'); }
  }, 80);
}

let slotsRunning = false;
document.getElementById('slotsBtn').onclick = async () => {
  if (!myId || !gameActive || slotsRunning) return;
  const p = await getMe(); if (onCD(p,'slots')) return;
  if (p.cash < SLOTS_COST) { alert('Need $'+SLOTS_COST+' to play slots!'); return; }
  slotsRunning = true;

  // Deduct cost immediately
  await ref('players/'+myId).update({ cash: p.cash - SLOTS_COST, ['lastAction/slots']: now() });

  const results = [weightedSym(), weightedSym(), weightedSym()];
  document.getElementById('slotsResult').textContent = '';
  document.getElementById('slotsModal').classList.remove('hidden');
  document.getElementById('slotsClose').disabled = true;
  [0,1,2].forEach((i) => { document.getElementById('reel'+i).textContent = '❓'; });

  spinReel('reel0', results[0], 12);
  spinReel('reel1', results[1], 18);
  spinReel('reel2', results[2], 24);

  setTimeout(async () => {
    const { win, msg } = slotPayout(results);
    document.getElementById('slotsResult').textContent = msg;
    document.getElementById('slotsResult').style.color = win > 0 ? 'var(--accent)' : 'var(--pink)';
    if (win > 0) {
      const fresh = await getMe();
      await ref('players/'+myId+'/cash').set(fresh.cash + win);
    }
    document.getElementById('slotsClose').disabled = false;
    slotsRunning = false;
  }, 24*80 + 300);
};

document.getElementById('slotsClose').onclick = () => {
  document.getElementById('slotsModal').classList.add('hidden');
};

// ============================================================
// 1v1 DUELS
// ============================================================
async function createDuel(game) {
  if (!myId || !gameActive) return;
  const targetId = document.getElementById('duelTarget').value;
  const amt = Number(document.getElementById('duelAmt').value);
  if (!targetId || !amt || amt <= 0) { alert('Pick a target and enter a bet amount.'); return; }
  const p = await getMe();
  if (!p || p.cash < amt) { alert('Not enough cash! Your bet is '+ money(amt) +' but you have '+ money(p.cash)); return; }
  const target = lastPlayers[targetId];
  if (!target) return;
  // Deduct bet (held in escrow) immediately
  await ref('players/'+myId+'/cash').set(p.cash - amt);
  const duelId = randId();
  await ref('duels/'+duelId).set({
    from: myId, fromName: p.name,
    to: targetId, toName: target.name,
    amount: amt, game,
    status: 'pending',
    ts: now()
  });
  document.getElementById('duelAmt').value = '';
  showToast(`🥊 Challenge sent to ${target.name}! ${money(amt)} held.`, '#b06bff');
}

document.getElementById('duelCoinBtn').onclick = () => createDuel('coinflip');
document.getElementById('duelDiceBtn').onclick  = () => createDuel('dice');

if (fbReady) {
  ref('duels').on('value', async snap => {
    if (!myId) return;
    const duels = snap.val() || {};
    const incoming = Object.entries(duels).filter(([,d]) => d.to === myId && d.status === 'pending');
    const div = document.getElementById('incomingDuels');
    if (!div) return;
    if (!incoming.length) { div.innerHTML = '<p class="muted">No challenges right now.</p>'; return; }
    div.innerHTML = incoming.map(([id,d]) => `
      <div class="duel-item">
        <div>
          <b>${d.fromName}</b> challenges you to a <b>${d.game==='coinflip'?'🪙 Coin Flip':'🎲 Dice Roll'}</b>
          <br><span class="muted">Bet: </span><b class="gold">${money(d.amount)}</b>
        </div>
        <div class="row">
          <button class="btn" data-accept="${id}">Accept</button>
          <button class="btn danger" data-decline="${id}">Decline</button>
        </div>
      </div>`).join('');
    div.querySelectorAll('[data-accept]').forEach(b => b.onclick = () => acceptDuel(b.dataset.accept));
    div.querySelectorAll('[data-decline]').forEach(b => b.onclick = () => declineDuel(b.dataset.decline));

    // Auto-expire duels older than 3 min
    Object.entries(duels).forEach(([id,d]) => {
      if (d.status !== 'pending' && now() - d.ts > 120000) ref('duels/'+id).remove().catch(()=>{});
      if (d.status === 'pending' && now() - d.ts > 180000) {
        // Refund challenger
        ref('players/'+d.from+'/cash').once('value').then(s => {
          ref('players/'+d.from+'/cash').set((s.val()||0) + d.amount);
        });
        ref('duels/'+id).update({ status:'expired' });
      }
    });
  });
}

async function acceptDuel(duelId) {
  const snap = await ref('duels/'+duelId).once('value');
  const d = snap.val();
  if (!d || d.status !== 'pending') return;
  const me = await getMe();
  if (!me || me.cash < d.amount) {
    alert("Not enough cash to accept! Declining.");
    await declineDuel(duelId);
    return;
  }
  // Deduct acceptor's bet
  await ref('players/'+myId+'/cash').set(me.cash - d.amount);
  const pot = d.amount * 2;

  let winnerId, winnerName;
  if (d.game === 'coinflip') {
    const win = Math.random() < 0.5;
    winnerId   = win ? d.from : d.to;
    winnerName = win ? d.fromName : d.toName;
  } else { // dice
    let fr = Math.ceil(Math.random()*6), tr = Math.ceil(Math.random()*6);
    while (fr === tr) { fr = Math.ceil(Math.random()*6); tr = Math.ceil(Math.random()*6); }
    winnerId   = fr > tr ? d.from : d.to;
    winnerName = fr > tr ? d.fromName : d.toName;
    showToast(`🎲 ${d.fromName}: ${fr} vs ${d.toName}: ${tr}`, '#b06bff');
  }
  const wSnap = await ref('players/'+winnerId+'/cash').once('value');
  await ref('players/'+winnerId+'/cash').set((wSnap.val()||0) + pot);
  await ref('duels/'+duelId).update({ status:'complete', winner:winnerId, winnerName, pot });
  showToast(`🏆 ${winnerName} wins the duel! +${money(pot)}`, winnerId === myId ? '#00ffc3' : '#ff2d78');
}

async function declineDuel(duelId) {
  const snap = await ref('duels/'+duelId).once('value');
  const d = snap.val();
  if (!d) return;
  // Refund challenger
  const cSnap = await ref('players/'+d.from+'/cash').once('value');
  await ref('players/'+d.from+'/cash').set((cSnap.val()||0) + d.amount);
  await ref('duels/'+duelId).update({ status:'declined' });
}

// ============================================================
// SEND CASH
// ============================================================
document.getElementById('giftBtn').onclick = async () => {
  if (!myId || !gameActive) return;
  const targetId = document.getElementById('giftTarget').value;
  const amt = Number(document.getElementById('giftAmt').value);
  if (!targetId || !amt || amt <= 0) return;
  const me = await getMe();
  if (!me || me.cash < amt) { alert('Not enough cash!'); return; }
  const tSnap = await ref('players/'+targetId+'/cash').once('value');
  await ref('players/'+myId+'/cash').set(me.cash - amt);
  await ref('players/'+targetId+'/cash').set((tSnap.val()||0) + amt);
  document.getElementById('giftAmt').value = '';
  showToast(`🤝 Sent ${money(amt)} to ${lastPlayers[targetId]?.name || targetId}`, '#3fa9ff');
};

// ============================================================
// TOAST NOTIFICATION
// ============================================================
function showToast(msg, color='#00ffc3') {
  const t = document.createElement('div');
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', bottom:'24px', left:'50%', transform:'translateX(-50%)',
    background:'#0f0520', border:'1px solid '+color, color, padding:'10px 20px',
    borderRadius:'10px', fontWeight:'800', fontSize:'.9rem', zIndex:'99',
    boxShadow:'0 0 20px '+color+'55', pointerEvents:'none',
    transition:'opacity .4s', opacity:'1'
  });
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; setTimeout(()=>t.remove(),500); }, 2500);
}

// ============================================================
// VIEWER VOTE
// ============================================================
if (fbReady) {
  ref('poll').on('value', snap => {
    const poll = snap.val();
    const area = document.getElementById('voteArea');
    if (!poll || !poll.active) {
      area.innerHTML = '<p class="muted">No active vote — events fire every couple minutes!</p>'; return;
    }
    const votes = poll.votes || {};
    const opts  = poll.options || [];
    const counts = opts.map((_,i) => Object.values(votes).filter(v=>v===i).length);
    const total  = counts.reduce((a,b)=>a+b,0) || 1;
    const myVote = votes[myVid];
    const endsIn = Math.max(0, Math.ceil((poll.endsAt - now())/1000));

    area.innerHTML = `<h3 style="margin-bottom:12px">${poll.question}</h3>
      <p class="muted" style="font-size:.8rem;margin-bottom:12px">⏱ Closes in ${endsIn}s</p>` +
      opts.map((opt,i) => {
        const pct = Math.round(counts[i]/total*100);
        return `<div class="vote-option">
          <div class="vote-bar-wrap">
            <div>${i+1}. <b>${opt}</b></div>
            <div class="vote-bar"><div class="vote-bar-fill" style="width:${pct}%"></div></div>
            <div class="muted" style="font-size:.75rem;margin-top:3px">${counts[i]} votes · ${pct}%</div>
          </div>
          <button class="btn ${myVote===i?'gold':'purple'}" ${myVote!==undefined?'disabled':''} data-v="${i}">
            ${myVote===i?'✓ Voted':'Vote'}
          </button>
        </div>`;
      }).join('') +
      (myVote!==undefined ? '<p class="muted" style="margin-top:8px;font-size:.8rem">You voted — one vote per poll.</p>' : '');

    area.querySelectorAll('[data-v]').forEach(btn => btn.onclick = async () => {
      const vRef = ref('poll/votes/'+myVid);
      const ex = await vRef.once('value');
      if (!ex.exists()) await vRef.set(Number(btn.dataset.v));
    });
  });
}

// ============================================================
// EVENT APPLICATION
// ============================================================
async function applyEventToAll(ev) {
  const snap = await ref('players').once('value');
  const players = snap.val() || {};
  const ids = Object.keys(players);
  if (!ids.length) return;
  if (ev.randomTarget) {
    const id = ids[Math.floor(Math.random()*ids.length)];
    const result = ev.apply(players[id]) || {};
    await ref('players/'+id).update(result);
  } else {
    const updates = {};
    ids.forEach(id => {
      const result = ev.apply(players[id]) || {};
      Object.entries(result).forEach(([k,v]) => updates[id+'/'+k] = v);
    });
    if (Object.keys(updates).length) await ref('players').update(updates);
  }
}

async function startPoll(pollDef) {
  const opts = pollDef.dynamicPlayers
    ? Object.entries(lastPlayers).map(([id,p]) => ({ id, label:p.name }))
    : (pollDef.options||[]).map(o => ({ ...o, label:o.label }));
  if (!opts.length) return;

  await ref('poll').set({
    question: pollDef.question,
    options: opts.map(o => o.label),
    votes: {},
    active: true,
    endsAt: now() + POLL_VOTE_SECONDS*1000
  });

  setTimeout(async () => {
    const pSnap = await ref('poll').once('value'), poll = pSnap.val();
    await ref('poll/active').set(false);
    if (!poll) return;
    const votes = poll.votes || {};
    const tally = opts.map((_,i) => Object.values(votes).filter(v=>v===i).length);
    const max = Math.max(...tally, 0);
    const winners = tally.map((c,i)=>c===max?i:-1).filter(i=>i!==-1);
    if (!winners.length) return;
    const winIdx = winners[Math.floor(Math.random()*winners.length)];

    if (pollDef.dynamicPlayers) {
      const wId = opts[winIdx].id;
      const wSnap = await ref('players/'+wId).once('value'), wp = wSnap.val();
      if (wp) { await ref('players/'+wId).update(pollDef.apply(wp, true)); }
    } else {
      const winOpt = opts[winIdx];
      if (winOpt && winOpt.apply) await applyEventToAll(winOpt);
    }
  }, POLL_VOTE_SECONDS * 1000);
}

// ============================================================
// ADMIN
// ============================================================
document.getElementById('adminLoginBtn').onclick = () => {
  if (document.getElementById('adminPass').value === ADMIN_PASSWORD) {
    document.getElementById('adminPanel').classList.remove('hidden');
  } else { alert('Wrong password'); }
};

document.getElementById('setCodeBtn').onclick = async () => {
  const code = document.getElementById('aCode').value.trim().toUpperCase();
  if (!code) return;
  await ref('game/code').set(code);
  alert('Code set: ' + code);
};

document.getElementById('startBtn').onclick = async () => {
  const mins = Number(document.getElementById('aDuration').value) || 60;
  const endsAt = now() + mins*60000;
  await ref('game').update({ started:true, endsAt });
  alert('Game started! '+mins+' minutes on the clock.');
};

document.getElementById('endBtn').onclick = async () => {
  await ref('game').update({ started:false });
  autoOn = false;
  document.getElementById('autoBtn').textContent = '🔥 Auto Events: OFF';
  const snap = await ref('players').once('value');
  const ps = snap.val() || {};
  const sorted = Object.values(ps).sort((a,b) => netWorth(b) - netWorth(a));
  alert('🏁 GAME OVER! Winner: ' + (sorted[0] ? sorted[0].name + ' — ' + money(netWorth(sorted[0])) : 'nobody'));
};

// Build manual event + poll buttons from config
const evRow = document.getElementById('manualEventRow');
DIRECT_EVENTS.forEach(ev => {
  const b = document.createElement('button');
  b.className = 'btn alt'; b.textContent = ev.title;
  b.style.marginBottom = '6px';
  b.onclick = async () => { await applyEventToAll(ev); showToast(ev.title + ' — ' + ev.desc, '#3fa9ff'); };
  evRow.appendChild(b);
});
const pollRow = document.getElementById('manualPollRow');
POLL_EVENTS.forEach(pd => {
  const b = document.createElement('button');
  b.className = 'btn purple'; b.textContent = pd.question;
  b.style.marginBottom = '6px';
  b.onclick = () => { startPoll(pd); document.getElementById('pollStatus').textContent = 'Poll live for '+POLL_VOTE_SECONDS+'s'; };
  pollRow.appendChild(b);
});

if (fbReady) {
  ref('players').on('value', snap => {
    const ps = snap.val() || {};
    const body = document.getElementById('adminPlayers');
    if (!body) return;
    body.innerHTML = Object.entries(ps).map(([id,p]) =>
      `<tr><td>${p.name}</td><td>${money(p.cash)}</td><td class="gold">${money(netWorth(p))}</td>
       <td><button class="btn alt" style="padding:5px 10px;font-size:.78rem" data-give="${id}">+$500</button>
           <button class="btn danger" style="padding:5px 10px;font-size:.78rem;margin-left:4px" data-take="${id}">-$500</button></td></tr>`).join('');
    body.querySelectorAll('[data-give]').forEach(b=>b.onclick=async()=>{
      const s = await ref('players/'+b.dataset.give+'/cash').once('value');
      await ref('players/'+b.dataset.give+'/cash').set((s.val()||0)+500);
    });
    body.querySelectorAll('[data-take]').forEach(b=>b.onclick=async()=>{
      const s = await ref('players/'+b.dataset.take+'/cash').once('value');
      await ref('players/'+b.dataset.take+'/cash').set(Math.max(0,(s.val()||0)-500));
    });
  });
}

// AUTO EVENT + MARKET LOOP
let autoOn = false, autoTimer = null, marketTimer = null;
document.getElementById('autoBtn').onclick = () => {
  autoOn = !autoOn;
  document.getElementById('autoBtn').textContent = autoOn ? '🔥 Auto Events: ON' : '🔥 Auto Events: OFF';
  if (autoOn) { scheduleEvent(); scheduleMarket(); }
  else { clearTimeout(autoTimer); clearInterval(marketTimer); }
};

function scheduleEvent() {
  const delay = (Math.random()*(MAX_EVENT_SECONDS-MIN_EVENT_SECONDS)+MIN_EVENT_SECONDS)*1000;
  autoTimer = setTimeout(async () => {
    if (!autoOn) return;
    const isDirect = Math.random() < 0.4;
    if (isDirect) {
      const ev = DIRECT_EVENTS[Math.floor(Math.random()*DIRECT_EVENTS.length)];
      await applyEventToAll(ev);
    } else {
      const pd = POLL_EVENTS[Math.floor(Math.random()*POLL_EVENTS.length)];
      await startPoll(pd);
    }
    if (autoOn) scheduleEvent();
  }, delay);
}

function scheduleMarket() {
  clearInterval(marketTimer);
  marketTimer = setInterval(async () => { if (autoOn) await updateMarket(); }, MARKET_UPDATE_MS);
}
