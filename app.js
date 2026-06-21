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
      lastCollect: {}, joinedAt: Date.now()
    });
  }
  myPlayerId = id;
  localStorage.setItem('sew_playerId', id);
  msg.textContent = "✅ Joined as " + name + "! Switch to the Player tab.";
  showView('player');
};

// ====== LEADERBOARD (shared render) ======
function netWorthOf(p){
  let nw = p.cash || 0;
  const biz = p.businesses || {};
  Object.keys(biz).forEach(k => { if (BUSINESSES[k]) nw += BUSINESSES[k].cost * biz[k]; });
  const inv = p.investments || {};
  Object.keys(inv).forEach(k => { nw += inv[k] || 0; });
  return nw;
}
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
  ref('players').on('value', snap => renderLeaderboard(snap.val()));
}

// ====== PLAYER VIEW ======
function renderBizGrid(player, market){
  const grid = document.getElementById('bizGrid');
  if (!grid) return;
  const biz = player.businesses || {};
  grid.innerHTML = Object.entries(BUSINESSES).map(([key,b])=>{
    const owned = biz[key] || 0;
    const lastCollect = (player.lastCollect||{})[key];
    let pending = 0;
    if (owned > 0 && lastCollect) {
      const minutes = (Date.now() - lastCollect) / 60000;
      pending = minutes * b.income * owned;
    }
    return `<div class="biz">
      <h3>${b.emoji} ${b.name}</h3>
      <div class="meta">Cost: ${money(b.cost)} • Income: ${money(b.income)}/min each<br>Owned: <b>${owned}</b></div>
      <div class="row">
        <button class="btn" data-buy="${key}">Buy ($${b.cost})</button>
        ${owned>0 ? `<button class="btn alt" data-collect="${key}">Collect ${money(pending)}</button>` : ''}
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('[data-buy]').forEach(btn=>{
    btn.onclick = () => buyBusiness(btn.dataset.buy);
  });
  grid.querySelectorAll('[data-collect]').forEach(btn=>{
    btn.onclick = () => collectIncome(btn.dataset.collect);
  });
}

function renderInvestGrid(player, market){
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

  grid.querySelectorAll('[data-invest]').forEach(btn=>{
    btn.onclick = () => investIn(btn.dataset.invest);
  });
  grid.querySelectorAll('[data-cashout]').forEach(btn=>{
    btn.onclick = () => cashOut(btn.dataset.cashout);
  });
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
  if (owned === 0) updates['lastCollect/'+key] = Date.now();
  await pRef.update(updates);
}

async function collectIncome(key){
  const b = BUSINESSES[key];
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  const owned = (p.businesses||{})[key] || 0;
  const last = (p.lastCollect||{})[key] || Date.now();
  const minutes = (Date.now() - last) / 60000;
  const earned = Math.round(minutes * b.income * owned);
  await pRef.update({
    cash: p.cash + earned,
    ['lastCollect/'+key]: Date.now()
  });
}

async function investIn(key){
  const amtInput = document.getElementById('inv-amt-'+key);
  const amt = Number(amtInput.value);
  if (!amt || amt <= 0) return;
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  if (p.cash < amt) { alert("Not enough cash!"); return; }
  await pRef.update({
    cash: p.cash - amt,
    ['investments/'+key]: ((p.investments||{})[key]||0) + amt
  });
  amtInput.value = '';
}

async function cashOut(key){
  const pRef = ref('players/'+myPlayerId);
  const snap = await pRef.once('value');
  const p = snap.val();
  const val = (p.investments||{})[key] || 0;
  if (val <= 0) return;
  await pRef.update({
    cash: p.cash + val,
    ['investments/'+key]: 0
  });
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
    }
  });

  // timer
  ref('game').on('value', snap => {
    const g = snap.val() || {};
    const timerEl = document.getElementById('timer');
    if (!timerEl) return;
    if (g.started && g.endsAt) {
      function tick(){
        const remain = Math.max(0, g.endsAt - Date.now());
        const m = Math.floor(remain/60000), s = Math.floor((remain%60000)/1000);
        timerEl.textContent = `${m}:${String(s).padStart(2,'0')}`;
        if (remain > 0) requestAnimationFrame(()=>setTimeout(tick,1000));
      }
      tick();
    } else {
      timerEl.textContent = "Not started";
    }
  });
}

// resume session
if (myPlayerId) {
  document.getElementById('joinMsg').textContent = "Welcome back!";
}

// ====== VIEWER VOTE ======
if (fbReady) {
  ref('poll').on('value', snap => {
    const poll = snap.val();
    const area = document.getElementById('voteArea');
    if (!poll || !poll.active) {
      area.innerHTML = `<p class="muted">No active vote right now. Check back soon!</p>`;
      return;
    }
    const votes = poll.votes || {};
    const counts = (poll.options || []).map((_,i)=>Object.values(votes).filter(v=>v===i).length);
    const total = counts.reduce((a,b)=>a+b,0) || 1;
    const myVote = votes[myVoterId];
    area.innerHTML = `<h3>${poll.question}</h3>` + (poll.options||[]).map((opt,i)=>{
      const pct = Math.round((counts[i]/total)*100);
      return `<div class="vote-opt">
        <div style="flex:1">
          <b>${i+1}. ${opt}</b>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <span class="muted">${counts[i]} votes (${pct}%)</span>
        </div>
        <button class="btn ${myVote===i?'alt':''}" ${myVote!==undefined?'disabled':''} data-vote="${i}">
          ${myVote===i ? '✓ Voted' : 'Vote'}
        </button>
      </div>`;
    }).join('') + (myVote!==undefined ? `<p class="muted">You voted for option ${myVote+1}. Each person votes once per poll.</p>` : '');

    area.querySelectorAll('[data-vote]').forEach(btn=>{
      btn.onclick = async () => {
        const i = Number(btn.dataset.vote);
        const voteRef = ref('poll/votes/'+myVoterId);
        const exists = await voteRef.once('value');
        if (exists.exists()) return; // already voted
        await voteRef.set(i);
      };
    });
  });
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
  await ref('game').update({
    started: true,
    durationMin: mins,
    endsAt: Date.now() + mins*60000
  });
};
document.getElementById('endGameBtn').onclick = async () => {
  await ref('game').update({ started: false });
  const snap = await ref('players').once('value');
  const players = snap.val() || {};
  const rows = Object.values(players).map(p=>({name:p.name, nw:netWorthOf(p)})).sort((a,b)=>b.nw-a.nw);
  alert("🏆 WINNER: " + (rows[0] ? rows[0].name + " with " + money(rows[0].nw) : "No players"));
};

// random-event helpers
async function getAllPlayers(){
  const snap = await ref('players').once('value');
  return snap.val() || {};
}
function randomPlayerId(players){
  const ids = Object.keys(players);
  return ids[Math.floor(Math.random()*ids.length)];
}

document.getElementById('govGrant').onclick = async () => {
  const players = await getAllPlayers();
  const updates = {};
  Object.entries(players).forEach(([id,p])=> updates[id+'/cash'] = (p.cash||0) + 500);
  await ref('players').update(updates);
  alert("💰 Government Grant! Everyone +$500");
};

document.getElementById('crash').onclick = async () => {
  const players = await getAllPlayers();
  const updates = {};
  Object.entries(players).forEach(([id,p])=> updates[id+'/cash'] = Math.round((p.cash||0) * 0.8));
  await ref('players').update(updates);
  alert("📉 Market Crash! Everyone -20% cash");
};

document.getElementById('techBoom').onclick = async () => {
  const players = await getAllPlayers();
  const updates = {};
  Object.entries(players).forEach(([id,p])=>{
    const inv = p.investments || {};
    Object.keys(inv).forEach(k=> updates[id+'/investments/'+k] = Math.round((inv[k]||0) * 1.3));
  });
  await ref('players').update(updates);
  alert("🚀 Tech Boom! All investments +30%");
};

document.getElementById('taxAudit').onclick = async () => {
  const players = await getAllPlayers();
  const id = randomPlayerId(players);
  if (!id) return;
  const loss = Math.round((players[id].cash||0) * 0.25);
  await ref('players/'+id+'/cash').set((players[id].cash||0) - loss);
  alert(`🏦 Tax Audit! ${players[id].name} loses ${money(loss)}`);
};

document.getElementById('mysteryBox').onclick = async () => {
  const players = await getAllPlayers();
  const id = randomPlayerId(players);
  if (!id) return;
  const bonus = [250,500,750,1000][Math.floor(Math.random()*4)];
  await ref('players/'+id+'/cash').set((players[id].cash||0) + bonus);
  alert(`🎁 Mystery Box! ${players[id].name} gets +${money(bonus)}`);
};

// polls
document.getElementById('startPollBtn').onclick = async () => {
  const q = document.getElementById('pollQ').value.trim();
  const opts = [1,2,3,4].map(i=>document.getElementById('pollOpt'+i).value.trim()).filter(Boolean);
  const secs = Number(document.getElementById('pollSeconds').value) || 60;
  if (!q || opts.length < 2) { alert("Need a question and at least 2 options"); return; }
  await ref('poll').set({ question: q, options: opts, votes: {}, active: true, endsAt: Date.now()+secs*1000 });
  document.getElementById('pollStatus').textContent = "Poll live for " + secs + "s";
  setTimeout(async ()=>{
    await ref('poll/active').set(false);
    document.getElementById('pollStatus').textContent = "Poll closed.";
  }, secs*1000);
};
document.getElementById('closePollBtn').onclick = async () => {
  await ref('poll/active').set(false);
  document.getElementById('pollStatus').textContent = "Poll closed manually.";
};

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
