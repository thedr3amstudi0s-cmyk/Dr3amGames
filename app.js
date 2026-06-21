// ====== FIREBASE INIT ======
let db = null;
let fbReady = false;
try {
  if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    fbReady = true;
    document.getElementById('configWarning').classList.add('hidden');
  }
} catch (e) { console.error("Firebase init failed", e); }

function ref(path){ return db.ref(path); }
function slugify(s){ return s.trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'') || 'player'; }
function money(n){ return '$' + Math.round(n).toLocaleString(); }
function randId(){ return 'v' + Math.random().toString(36).slice(2,10); }
function now(){ return Date.now(); }

document.getElementById('stealDesc').textContent =
  `Try to steal $${STEAL_AMOUNT} from a random rival. ${Math.round(STEAL_SUCCESS_CHANCE*100)}/${100-Math.round(STEAL_SUCCESS_CHANCE*100)} — get caught and pay a $${STEAL_FAIL_FINE} fine.`;

// ====== NAV ======
const views = ['join','player','vote','admin'];
function showView(v){
  views.forEach(x=>{
    document.getElementById('view-'+x).classList.toggle('hidden', x!==v);
    document.getElementById('nav'+x[0].toUpperCase()+x.slice(1)).classList.toggle('active', x===v);
  });
}
document.getElementById('navJoin').onclick   = ()=>showView('join');
document.getElementById('navPlayer').onclick = ()=>showView('player');
document.getElementById('navVote').onclick   = ()=>showView('vote');
document.getElementById('navAdmin').onclick  = ()=>showView('admin');

// ====== LOCAL IDENTITY ======
let myPlayerId = localStorage.getItem('sew_playerId') || null;
let myVoterId = localStorage.getItem('sew_voterId');
if (!myVoterId) { myVoterId = randId(); localStorage.setItem('sew_voterId', myVoterId); }

// ====== EVENT TICKER ======
function pushTicker(text){
  if (!fbReady) return;
  ref('eventLog').push({ text, ts: now() });
}
if (fbReady) {
  ref('eventLog').limitToLast(8).on('value', snap => {
    const items = snap.val() || {};
    const arr = Object.values(items).sort((a,b)=>a.ts-b.ts).map(i=>i.text);
    const track = document.getElementById('tickerTrack');
    if (!arr.length) return;
    const content = arr.map(t=>`<span>🔥 ${t}</span>`).join('');
    track.innerHTML = content + content; // duplicate for seamless scroll
  });
}

// ====== JOIN ======
document.getElementById('joinBtn').onclick = async () => {
  if (!fbReady) return;
  const code = document.getElementById('joinCode').value.trim();
  const name = document.getElementById('joinName').value.trim();
  const msg = document.getElementById('joinMsg');
  if (!code || !name) { msg.textContent = "Enter a code and a name."; return; }

  const gameSnap = await ref('game/code').once('value');
  const activeCode = gameSnap.val();
  if (!activeCode || code.toUpperCase() !== String(activeCode).toUpperCase()) {
    msg.textContent = "❌ Wrong or inactive streamer code. Ask the host.";
    return;
  }
  const id = slugify(name);
  const pRef = ref('players/'+id);
  const existing = await pRef.once('value');
  if (!existing.exists()) {
    await pRef.set({
      name, cash: STARTING_CASH, businesses: {}, investments: { crypto:0, stocks:0, bonds:0 },
      lastCollect: {}, lastAction: {}, joinedAt: now()
    });
    pushTicker(`${name} joined the game!`);
  }
  myPlayerId = id;
  localStorage.setItem('sew_playerId', id);
  msg.textContent = "✅ Joined as " + name + "! Switch to the Player tab.";
  showView('player');
};

// ====== LEADERBOARD ======
function netWorthOf(p){
  let nw = p.cash || 0;
  const biz = p.businesses || {};
  Object.keys(biz).forEach(k => { if (BUSINESSES[k]) nw += BUSINESSES[k].cost * biz[k]; });
  const inv = p.investments || {};
  Object.keys(inv).forEach(k => { nw += inv[k] || 0; });
  return nw;
}
let lastPlayersSnapshot = {};
function renderLeaderboard(players){
  const rows = Object.entries(players || {})
    .map(([id,p]) => ({id, ...p, nw: netWorthOf(p)}))
    .sort((a,b)=>b.nw-a.nw);
  const html = rows.length ? rows.map((p,i)=>
    `<tr class="${p.id===myPlayerId?'leader-row me':''}">
       <td>${i+1}</td><td>${p.name}</td><td>${money(p.cash)}</td><td class="gold">${money(p.nw)}</td>
     </tr>`).join('') : `<tr><td colspan="4" class="muted">No players yet</td></tr>`;
  ['leaderboardBody','leaderboardBody2'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  });
  return rows;
}

if (fbReady) {
  ref('players').on('value', snap => {
    const players = snap.val() || {};
    lastPlayersSnapshot = players;
    renderLeaderboard(players);
    populateGiftTarget(players);
  });
}

function populateGiftTarget(players){
  const sel = document.getElementById('giftTarget');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = Object.entries(players)
    .filter(([id]) => id !== myPlayerId)
    .map(([id,p]) => `<option value="${id}">${p.name}</option>`).join('');
  if (cur) sel.value = cur;
}

// ====== PLAYER VIEW: HUD + businesses + investments ======
function renderBizGrid(player){
  const grid = document.getElementById('bizGrid');
  if (!grid) return;
  const biz = player.businesses || {};
  grid.innerHTML = Object.entries(BUSINESSES).map(([key,b])=>{
    const owned = biz[key] || 0;
    const lastCollect = (player.lastCollect||{})[key];
    let pending = 0;
    if (owned > 0 && lastCollect) {
      const minutes = (now() - lastCollect) / 60000;
      pending = minutes * b.income * owned;
    }
    return `<div class="biz">
      <h3>${b.emoji} ${b.name}</h3>
      <div class="meta">Cost: ${money(b.cost)} • Income: ${money(b.income)}/min each<br>Owned: <b>${owned}</b></div>
      <div class="row">
        <button class="btn" data-buy="${key}">Buy (${money(b.cost)})</button>
        ${owned>0 ? `<button class="btn alt" data-collect="${key}">Collect ${money(pending)}</button>` : ''}
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-buy]').forEach(btn=>{ btn.onclick = () => buyBusiness(btn.dataset.buy); });
  grid.querySelectorAll('[data-collect]').forEach(btn=>{ btn.onclick = () => collectIncome(btn.dataset.collect); });
}

function renderInvestGrid(player){
  const grid = document.getElementById('investGrid');
  if (!grid) return;
  const inv = player.investments || {};
  grid.innerHTML = Object.entries(INVESTMENTS).map(([key,iv])=>{
    const val = inv[key] || 0;
    return `<div class="biz">
      <h3>${iv.emoji} ${iv.name}</h3>
      <div class="meta">Risk: ${iv.risk}<br>Current value: <b class="gold">${money(val)}</b></div>
      <div class="row">
        <input type="number" min="0" placeholder="$ amount" id="inv-amt-${key}" style="width:100px">
        <button class="btn" data-invest="${key}">Invest</button>
        <button class="btn danger" data-cashout="${key}">Cash Out</button>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-invest]').forEach(btn=>{ btn.onclick = () => investIn(btn.dataset.invest); });
  grid.querySelectorAll('[data-cashout]').forEach(btn=>{ btn.onclick = () => cashOut(btn.dataset.cashout); });
}

async function buyBusiness(key){
  const b = BUSINESSES[key];
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  if (!p || p.cash < b.cost) { alert("Not enough cash!"); return; }
  const owned = (p.businesses||{})[key] || 0;
  const updates = {};
  updates['cash'] = p.cash - b.cost;
  updates['businesses/'+key] = owned + 1;
  if (owned === 0) updates['lastCollect/'+key] = now();
  await pRef.update(updates);
  pushTicker(`${p.name} bought a ${b.name}!`);
}

async function collectIncome(key){
  const b = BUSINESSES[key];
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  const owned = (p.businesses||{})[key] || 0;
  const last = (p.lastCollect||{})[key] || now();
  const minutes = (now() - last) / 60000;
  const earned = Math.round(minutes * b.income * owned);
  await pRef.update({ cash: p.cash + earned, ['lastCollect/'+key]: now() });
}

async function investIn(key){
  const amtInput = document.getElementById('inv-amt-'+key);
  const amt = Number(amtInput.value);
  if (!amt || amt <= 0) return;
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  if (p.cash < amt) { alert("Not enough cash!"); return; }
  await pRef.update({ cash: p.cash - amt, ['investments/'+key]: ((p.investments||{})[key]||0) + amt });
  amtInput.value = '';
}

async function cashOut(key){
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  const val = (p.investments||{})[key] || 0;
  if (val <= 0) return;
  await pRef.update({ cash: p.cash + val, ['investments/'+key]: 0 });
}

if (fbReady) {
  ref('players').on('value', snap => {
    const players = snap.val() || {};
    if (myPlayerId && players[myPlayerId]) {
      const p = players[myPlayerId];
      document.getElementById('pName').textContent = p.name;
      document.getElementById('pCash').textContent = money(p.cash);
      document.getElementById('pNetWorth').textContent = money(netWorthOf(p));
      renderBizGrid(p);
      renderInvestGrid(p);
      renderCooldowns(p);
    }
  });

  ref('game').on('value', snap => {
    const g = snap.val() || {};
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    if (g.started && g.endsAt) {
      function tick(){
        const remain = Math.max(0, g.endsAt - now());
        const m = Math.floor(remain/60000), s = Math.floor((remain%60000)/1000);
        timerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
        if (remain > 0) setTimeout(tick,1000);
      }
      tick();
    } else {
      timerEl.textContent = "Not started";
    }
  });
}

if (myPlayerId) document.getElementById('joinMsg').textContent = "Welcome back!";

// ====== PLAYER ACTIONS ======
function renderCooldowns(p){
  const la = p.lastAction || {};
  Object.entries(ACTIONS).forEach(([key,cfg])=>{
    const el = document.getElementById(key+'Cd');
    const btn = document.getElementById(key+'Btn');
    if (!el || !btn) return;
    const last = la[key] || 0;
    const remain = Math.ceil((last + cfg.cooldownSec*1000 - now())/1000);
    if (remain > 0) {
      el.textContent = `Cooldown: ${remain}s`;
      btn.disabled = true;
    } else {
      el.textContent = '';
      btn.disabled = false;
    }
  });
  // re-check every second
  clearTimeout(window._cdTimer);
  window._cdTimer = setTimeout(()=> renderCooldowns(p), 1000);
}

async function getMe(){
  const snap = await ref('players/'+myPlayerId).once('value');
  return snap.val();
}
function onCooldown(p, key){
  const last = (p.lastAction||{})[key] || 0;
  return now() < last + ACTIONS[key].cooldownSec*1000;
}

document.getElementById('riskBtn').onclick = async () => {
  if (!myPlayerId) return;
  const p = await getMe();
  if (onCooldown(p,'risk')) return;
  const amt = Number(document.getElementById('riskAmt').value);
  if (!amt || amt <= 0 || amt > p.cash) { alert("Enter a valid amount you actually have."); return; }
  const win = Math.random() < 0.5;
  const newCash = win ? p.cash + amt : p.cash - amt;
  await ref('players/'+myPlayerId).update({ cash: Math.max(0,newCash), ['lastAction/risk']: now() });
  document.getElementById('riskAmt').value = '';
  if (win) { pushTicker(`${p.name} risked ${money(amt)} and DOUBLED it! 🎉`); }
  else { pushTicker(`${p.name} risked ${money(amt)} and lost it all. 💀`); }
};

document.getElementById('stealBtn').onclick = async () => {
  if (!myPlayerId) return;
  const p = await getMe();
  if (onCooldown(p,'steal')) return;
  const players = lastPlayersSnapshot;
  const rivals = Object.keys(players).filter(id => id !== myPlayerId);
  if (!rivals.length) { alert("No rivals to steal from yet!"); return; }
  const targetId = rivals[Math.floor(Math.random()*rivals.length)];
  const target = players[targetId];
  const success = Math.random() < STEAL_SUCCESS_CHANCE;
  const updates = { ['lastAction/steal']: now() };
  if (success) {
    const amt = Math.min(STEAL_AMOUNT, target.cash || 0);
    await ref('players/'+targetId+'/cash').set(Math.max(0,(target.cash||0) - amt));
    updates['cash'] = p.cash + amt;
    pushTicker(`🦹 ${p.name} stole ${money(amt)} from ${target.name}!`);
  } else {
    updates['cash'] = Math.max(0, p.cash - STEAL_FAIL_FINE);
    pushTicker(`🚨 ${p.name} got caught trying to rob ${target.name} and paid a ${money(STEAL_FAIL_FINE)} fine!`);
  }
  await ref('players/'+myPlayerId).update(updates);
};

let activeTrivia = null;
document.getElementById('triviaBtn').onclick = async () => {
  if (!myPlayerId) return;
  const p = await getMe();
  if (onCooldown(p,'trivia')) return;
  activeTrivia = TRIVIA_QUESTIONS[Math.floor(Math.random()*TRIVIA_QUESTIONS.length)];
  document.getElementById('triviaQ').textContent = activeTrivia.q;
  const opts = document.getElementById('triviaOpts');
  opts.innerHTML = activeTrivia.a.map((a,i)=>`<button class="btn alt" data-idx="${i}" style="display:block;width:100%">${a}</button>`).join('');
  opts.querySelectorAll('button').forEach(btn=>{
    btn.onclick = async () => {
      const idx = Number(btn.dataset.idx);
      const correct = idx === activeTrivia.correct;
      const me = await getMe();
      const updates = { ['lastAction/trivia']: now() };
      if (correct) {
        updates['cash'] = me.cash + TRIVIA_BONUS;
        pushTicker(`🧠 ${me.name} nailed a trivia question for +${money(TRIVIA_BONUS)}!`);
      } else {
        pushTicker(`🧠 ${me.name} flubbed a trivia question. No bonus.`);
      }
      await ref('players/'+myPlayerId).update(updates);
      document.getElementById('trivia-modal').classList.add('hidden');
    };
  });
  document.getElementById('trivia-modal').classList.remove('hidden');
};

document.getElementById('giftBtn').onclick = async () => {
  if (!myPlayerId) return;
  const targetId = document.getElementById('giftTarget').value;
  const amt = Number(document.getElementById('giftAmt').value);
  if (!targetId || !amt || amt <= 0) return;
  const p = await getMe();
  if (amt > p.cash) { alert("Not enough cash!"); return; }
  const tSnap = await ref('players/'+targetId).once('value');
  const t = tSnap.val();
  if (!t) return;
  await ref('players/'+myPlayerId+'/cash').set(p.cash - amt);
  await ref('players/'+targetId+'/cash').set((t.cash||0) + amt);
  pushTicker(`🤝 ${p.name} sent ${money(amt)} to ${t.name}!`);
  document.getElementById('giftAmt').value = '';
};

// ====== VIEWER VOTE ======
if (fbReady) {
  ref('poll').on('value', snap => {
    const poll = snap.val();
    const area = document.getElementById('voteArea');
    if (!poll || !poll.active) {
      area.innerHTML = `<p class="muted">No active vote right now. Check back soon — events fire every couple minutes!</p>`;
      return;
    }
    const votes = poll.votes || {};
    const optionLabels = poll.options || [];
    const counts = optionLabels.map((_,i)=>Object.values(votes).filter(v=>v===i).length);
    const total = counts.reduce((a,b)=>a+b,0) || 1;
    const myVote = votes[myVoterId];
    area.innerHTML = `<h3>${poll.question}</h3>` + optionLabels.map((opt,i)=>{
      const pct = Math.round((counts[i]/total)*100);
      return `<div class="vote-opt">
        <div style="flex:1">
          <b>${i+1}. ${opt}</b>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="muted">${counts[i]} votes (${pct}%)</span>
        </div>
        <button class="btn ${myVote===i?'gold':'purple'}" ${myVote!==undefined?'disabled':''} data-vote="${i}">
          ${myVote===i ? '✓ Voted' : 'Vote'}
        </button>
      </div>`;
    }).join('') + (myVote!==undefined ? `<p class="muted">You voted for option ${myVote+1}. Each person votes once per poll.</p>` : '');

    area.querySelectorAll('[data-vote]').forEach(btn=>{
      btn.onclick = async () => {
        const i = Number(btn.dataset.vote);
        const voteRef = ref('poll/votes/'+myVoterId);
        const exists = await voteRef.once('value');
        if (exists.exists()) return;
        await voteRef.set(i);
      };
    });
  });
}

// ====== EFFECT APPLICATION (shared by direct events + poll results) ======
async function applyToAllPlayers(applyFn, targetMode){
  const snap = await ref('players').once('value');
  const players = snap.val() || {};
  const ids = Object.keys(players);
  if (!ids.length) return;
  if (targetMode === 'random') {
    const id = ids[Math.floor(Math.random()*ids.length)];
    const result = applyFn(players[id]);
    await ref('players/'+id).update(result);
    return;
  }
  const updates = {};
  ids.forEach(id => {
    const result = applyFn(players[id]) || {};
    Object.entries(result).forEach(([k,v]) => updates[id+'/'+k] = v);
  });
  await ref('players').update(updates);
}

async function fireDirectEvent(ev){
  await applyToAllPlayers(ev.apply, 'all');
  pushTicker(`${ev.title} — ${ev.desc}`);
}

async function startPollEvent(pollDef){
  let options = pollDef.dynamicPlayers
    ? Object.entries(lastPlayersSnapshot).map(([id,p]) => ({ id, label: p.name }))
    : pollDef.options.map((o,i)=>({...o, idx:i}));

  if (pollDef.dynamicPlayers && !options.length) return; // no players yet, skip

  await ref('poll').set({
    question: pollDef.question,
    options: options.map(o => o.label),
    votes: {},
    active: true,
    endsAt: now() + POLL_VOTE_SECONDS*1000
  });
  pushTicker(`🗳️ NEW VOTE: ${pollDef.question} — head to the Viewer Vote tab!`);

  setTimeout(async () => {
    const snap = await ref('poll').once('value');
    const poll = snap.val();
    await ref('poll/active').set(false);
    if (!poll) return;
    const votes = poll.votes || {};
    const tally = options.map((_,i)=>Object.values(votes).filter(v=>v===i).length);
    const max = Math.max(...tally,0);
    const winners = tally.map((c,i)=>c===max?i:-1).filter(i=>i!==-1);
    if (!winners.length) { pushTicker(`Poll closed: no votes cast, no effect.`); return; }
    const winIdx = winners[Math.floor(Math.random()*winners.length)];

    if (pollDef.dynamicPlayers) {
      const winnerId = options[winIdx].id;
      const pSnap = await ref('players/'+winnerId).once('value');
      const p = pSnap.val();
      await ref('players/'+winnerId).update(pollDef.apply(p, true));
      pushTicker(`🏆 ${p.name} won the vote and grabbed a $5,000 bonus!`);
    } else {
      const winOpt = options[winIdx];
      if (winOpt.randomTarget) {
        await applyToAllPlayers(winOpt.apply, 'random');
      } else {
        await applyToAllPlayers(winOpt.apply, 'all');
      }
      pushTicker(`🏆 Poll result: "${winOpt.label}" wins! Effect applied.`);
    }
  }, POLL_VOTE_SECONDS*1000);
}

// ====== ADMIN ======
let adminUnlocked = false;
document.getElementById('adminLoginBtn').onclick = () => {
  if (document.getElementById('adminPass').value === ADMIN_PASSWORD) {
    adminUnlocked = true;
    document.getElementById('adminPanel').classList.remove('hidden');
  } else {
    alert("Wrong password");
  }
};

document.getElementById('setCodeBtn').onclick = async () => {
  const code = document.getElementById('streamerCode').value.trim().toUpperCase();
  if (!code) return;
  await ref('game/code').set(code);
  alert("Streamer code set to: " + code);
};

document.getElementById('startGameBtn').onclick = async () => {
  const mins = Number(document.getElementById('durationMin').value) || 60;
  await ref('game').update({ started: true, durationMin: mins, endsAt: now() + mins*60000 });
  pushTicker(`Game started! ${mins} minutes on the clock. Good luck!`);
};
document.getElementById('endGameBtn').onclick = async () => {
  await ref('game').update({ started: false });
  autoModeOn = false;
  document.getElementById('autoModeBtn').textContent = '🔥 Auto Events: OFF';
  const snap = await ref('players').once('value');
  const players = snap.val() || {};
  const rows = Object.values(players).map(p=>({name:p.name, nw:netWorthOf(p)})).sort((a,b)=>b.nw-a.nw);
  pushTicker(`🏁 GAME OVER! Winner: ${rows[0] ? rows[0].name + ' with ' + money(rows[0].nw) : 'nobody'}`);
  alert("🏆 WINNER: " + (rows[0] ? rows[0].name + " with " + money(rows[0].nw) : "No players"));
};

// ---- auto event scheduler (runs while this admin tab stays open & game is started) ----
let autoModeOn = false;
let autoTimer = null;
document.getElementById('autoModeBtn').onclick = () => {
  autoModeOn = !autoModeOn;
  document.getElementById('autoModeBtn').textContent = autoModeOn ? '🔥 Auto Events: ON' : '🔥 Auto Events: OFF';
  if (autoModeOn) scheduleNextAutoEvent();
  else clearTimeout(autoTimer);
};
function scheduleNextAutoEvent(){
  const delay = Math.floor(Math.random()*(MAX_EVENT_SECONDS-MIN_EVENT_SECONDS+1)+MIN_EVENT_SECONDS)*1000;
  autoTimer = setTimeout(async () => {
    if (!autoModeOn) return;
    const isDirect = Math.random() < 0.4;
    if (isDirect) {
      const ev = DIRECT_EVENTS[Math.floor(Math.random()*DIRECT_EVENTS.length)];
      await fireDirectEvent(ev);
    } else {
      const pollDef = POLL_EVENTS[Math.floor(Math.random()*POLL_EVENTS.length)];
      await startPollEvent(pollDef);
    }
    if (autoModeOn) scheduleNextAutoEvent();
  }, delay);
}

// manual event buttons (built from config so they always match)
const manualEventWrap = document.getElementById('manualEventBtns');
DIRECT_EVENTS.forEach(ev=>{
  const b = document.createElement('button');
  b.className = 'btn alt';
  b.textContent = ev.title;
  b.onclick = () => fireDirectEvent(ev);
  manualEventWrap.appendChild(b);
});
const manualPollWrap = document.getElementById('manualPollBtns');
POLL_EVENTS.forEach(pd=>{
  const b = document.createElement('button');
  b.className = 'btn purple';
  b.textContent = pd.question;
  b.onclick = () => { startPollEvent(pd); document.getElementById('pollStatus').textContent = 'Poll live for ' + POLL_VOTE_SECONDS + 's'; };
  manualPollWrap.appendChild(b);
});

if (fbReady) {
  ref('players').on('value', snap => {
    const players = snap.val() || {};
    const body = document.getElementById('adminPlayerBody');
    if (!body) return;
    body.innerHTML = Object.entries(players).map(([id,p])=>`
      <tr>
        <td>${p.name}</td><td>${money(p.cash)}</td><td class="gold">${money(netWorthOf(p))}</td>
        <td><button class="btn alt" data-give="${id}">+$500</button> <button class="btn danger" data-take="${id}">-$500</button></td>
      </tr>`).join('');
    body.querySelectorAll('[data-give]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.give; await ref('players/'+id+'/cash').set((players[id].cash||0)+500);
    });
    body.querySelectorAll('[data-take]').forEach(b=>b.onclick=async()=>{
      const id=b.dataset.take; await ref('players/'+id+'/cash').set(Math.max(0,(players[id].cash||0)-500));
    });
  });
}
