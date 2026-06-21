// Streamer Economy War — Discord Event Bot
// Posts a random event/poll on a random timer, pins it, and only counts ONE vote
// per user (they type 1, 2, 3, or 4 in the channel). After the timer, it tallies
// votes, announces the winner, unpins, and (optionally) pushes the result into
// the same Firebase Realtime Database the web game uses.

require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');
const fetch = require('node-fetch');

const {
  DISCORD_TOKEN,
  EVENT_CHANNEL_ID,
  MIN_INTERVAL_MINUTES = 5,
  MAX_INTERVAL_MINUTES = 10,
  VOTE_DURATION_SECONDS = 60,
  FIREBASE_DB_URL,
  FIREBASE_DB_SECRET
} = process.env;

if (!DISCORD_TOKEN || !EVENT_CHANNEL_ID) {
  console.error('Missing DISCORD_TOKEN or EVENT_CHANNEL_ID in .env — copy .env.example to .env and fill it in.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel]
});

// ====== EVENT POOL ======
// "direct" events apply to everyone immediately, no vote needed.
// "poll" events ask the chat to decide between numbered options.
const DIRECT_EVENTS = [
  {
    title: '💰 Government Grant',
    desc: 'Every streamer receives **+$500** in cash!',
    color: 0x4ee1a0,
    firebase: { type: 'cashAll', amount: 500 }
  },
  {
    title: '📉 Market Crash',
    desc: 'Panic in the markets — every streamer loses **20% of their cash**.',
    color: 0xff5c7a,
    firebase: { type: 'cashAllPct', pct: -0.20 }
  },
  {
    title: '🚀 Tech Boom',
    desc: 'Investments are surging — all investment values **+30%**.',
    color: 0x5da9ff,
    firebase: { type: 'investAllPct', pct: 0.30 }
  }
];

const POLL_EVENTS = [
  {
    question: 'Which disaster strikes the economy?',
    options: ['Market Crash (-20% cash)', 'Inflation (-10% cash)', 'Tax Increase (random player -$750)', 'Business Boom (+25% business income)'],
    onResult: (winnerIndex) => {
      switch (winnerIndex) {
        case 0: return { type: 'cashAllPct', pct: -0.20 };
        case 1: return { type: 'cashAllPct', pct: -0.10 };
        case 2: return { type: 'cashRandomPlayer', amount: -750 };
        case 3: return { type: 'businessBoomNote' }; // informational; apply manually or extend web app
      }
    }
  },
  {
    question: 'Should crypto go up or down?',
    options: ['Crypto UP +40%', 'Crypto DOWN -40%'],
    onResult: (winnerIndex) => ({
      type: 'investKeyPct',
      key: 'crypto',
      pct: winnerIndex === 0 ? 0.40 : -0.40
    })
  },
  {
    question: 'Who deserves a bonus?',
    options: ['Vote for your favorite streamer to win +$5,000 (type their number)'],
    custom: 'bonus' // handled specially - see below, needs live player list
  }
];

let currentPoll = null; // { messageId, channelId, options, votes: Map(userId->index), endsAt }

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function scheduleNextEvent() {
  const minMs = Number(MIN_INTERVAL_MINUTES) * 60000;
  const maxMs = Number(MAX_INTERVAL_MINUTES) * 60000;
  const delay = randomInt(minMs, maxMs);
  console.log(`Next event in ${(delay / 60000).toFixed(1)} minutes`);
  setTimeout(async () => {
    try { await fireRandomEvent(); } catch (e) { console.error(e); }
    scheduleNextEvent();
  }, delay);
}

async function fireRandomEvent() {
  const channel = await client.channels.fetch(EVENT_CHANNEL_ID);
  if (!channel) return console.error('Could not find event channel');

  const isDirect = Math.random() < 0.4; // 40% chance of an instant event, 60% a vote
  if (isDirect) {
    const ev = DIRECT_EVENTS[randomInt(0, DIRECT_EVENTS.length - 1)];
    const embed = new EmbedBuilder()
      .setTitle(ev.title)
      .setDescription(ev.desc)
      .setColor(ev.color)
      .setFooter({ text: 'Streamer Economy War — Live Event' })
      .setTimestamp();
    const msg = await channel.send({ embeds: [embed] });
    try { await msg.pin(); } catch {}
    await applyEffect(ev.firebase);
  } else {
    await startPoll(channel);
  }
}

async function startPoll(channel) {
  const pollDef = POLL_EVENTS[randomInt(0, POLL_EVENTS.length - 1)];
  const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];

  let optionsList = pollDef.options;
  let playersForBonus = null;

  if (pollDef.custom === 'bonus' && FIREBASE_DB_URL) {
    // fetch current players to build a real numbered list for the bonus vote
    playersForBonus = await fetchPlayers();
    if (playersForBonus && Object.keys(playersForBonus).length) {
      optionsList = Object.values(playersForBonus).map(p => p.name);
    } else {
      optionsList = ['(no players joined yet)'];
    }
  }

  const desc = optionsList.map((opt, i) => `**${i + 1}.** ${opt}`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('🗳️ ' + pollDef.question)
    .setDescription(desc + `\n\nType the **number** in chat to vote! One vote per person. Voting closes in ${VOTE_DURATION_SECONDS}s.`)
    .setColor(0xf4c95d)
    .setFooter({ text: 'Streamer Economy War — Viewer Vote' })
    .setTimestamp();

  const msg = await channel.send({ embeds: [embed] });
  try { await msg.pin(); } catch {}

  currentPoll = {
    messageId: msg.id,
    channelId: channel.id,
    options: optionsList,
    votes: new Map(),
    endsAt: Date.now() + Number(VOTE_DURATION_SECONDS) * 1000
  };

  setTimeout(async () => {
    await closePoll(pollDef, playersForBonus);
  }, Number(VOTE_DURATION_SECONDS) * 1000);
}

async function closePoll(pollDef, playersForBonus) {
  if (!currentPoll) return;
  const channel = await client.channels.fetch(currentPoll.channelId);

  const tally = new Array(currentPoll.options.length).fill(0);
  for (const choice of currentPoll.votes.values()) {
    if (choice >= 0 && choice < tally.length) tally[choice]++;
  }
  const maxVotes = Math.max(...tally, 0);
  const winners = tally.map((c, i) => (c === maxVotes ? i : -1)).filter(i => i !== -1);
  const winnerIndex = winners.length ? winners[randomInt(0, winners.length - 1)] : -1;

  const resultLines = currentPoll.options.map((opt, i) => `**${i + 1}.** ${opt} — ${tally[i]} vote${tally[i] === 1 ? '' : 's'}`);
  const winnerText = winnerIndex >= 0
    ? `🏆 **Winner: ${currentPoll.options[winnerIndex]}**`
    : 'No votes were cast — no effect applied.';

  const embed = new EmbedBuilder()
    .setTitle('📊 Poll Results: ' + (pollDef.question || ''))
    .setDescription(resultLines.join('\n') + '\n\n' + winnerText)
    .setColor(0x4ee1a0)
    .setTimestamp();

  const resultMsg = await channel.send({ embeds: [embed] });

  // unpin the original poll to keep the pin list tidy
  try {
    const oldMsg = await channel.messages.fetch(currentPoll.messageId);
    await oldMsg.unpin();
  } catch {}

  if (winnerIndex >= 0) {
    if (pollDef.custom === 'bonus' && playersForBonus) {
      const playerIds = Object.keys(playersForBonus);
      const winnerId = playerIds[winnerIndex];
      if (winnerId) await applyEffect({ type: 'cashSpecificPlayer', playerId: winnerId, amount: 5000 });
    } else if (pollDef.onResult) {
      const effect = pollDef.onResult(winnerIndex);
      await applyEffect(effect);
    }
  }

  currentPoll = null;
}

// listen for numeric votes in the event channel
client.on('messageCreate', (msg) => {
  if (msg.author.bot) return;
  if (!currentPoll) return;
  if (msg.channelId !== currentPoll.channelId) return;

  const trimmed = msg.content.trim();
  if (!/^\d+$/.test(trimmed)) return;

  const choice = parseInt(trimmed, 10) - 1;
  if (choice < 0 || choice >= currentPoll.options.length) return;

  if (currentPoll.votes.has(msg.author.id)) {
    // already voted — silently ignore (or react ❌ to let them know)
    msg.react('❌').catch(() => {});
    return;
  }
  currentPoll.votes.set(msg.author.id, choice);
  msg.react('✅').catch(() => {});
});

// ====== FIREBASE SYNC (optional) ======
async function fetchPlayers() {
  if (!FIREBASE_DB_URL) return null;
  const url = `${FIREBASE_DB_URL.replace(/\/$/, '')}/players.json${FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function applyEffect(effect) {
  if (!effect) return;
  console.log('Event effect (apply in web admin panel if Firebase sync is off):', effect);
  if (!FIREBASE_DB_URL) return;

  const players = await fetchPlayers();
  if (!players) return;
  const base = FIREBASE_DB_URL.replace(/\/$/, '');
  const authQ = FIREBASE_DB_SECRET ? `?auth=${FIREBASE_DB_SECRET}` : '';

  async function patch(path, body) {
    await fetch(`${base}/${path}.json${authQ}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  if (effect.type === 'cashAll') {
    const updates = {};
    Object.entries(players).forEach(([id, p]) => updates[id] = { cash: (p.cash || 0) + effect.amount });
    await patch('players', updates);
  }
  if (effect.type === 'cashAllPct') {
    const updates = {};
    Object.entries(players).forEach(([id, p]) => updates[id] = { cash: Math.round((p.cash || 0) * (1 + effect.pct)) });
    await patch('players', updates);
  }
  if (effect.type === 'investAllPct') {
    const updates = {};
    Object.entries(players).forEach(([id, p]) => {
      const inv = p.investments || {};
      const newInv = {};
      Object.keys(inv).forEach(k => newInv[k] = Math.round((inv[k] || 0) * (1 + effect.pct)));
      updates[id] = { investments: newInv };
    });
    await patch('players', updates);
  }
  if (effect.type === 'investKeyPct') {
    const updates = {};
    Object.entries(players).forEach(([id, p]) => {
      const cur = (p.investments || {})[effect.key] || 0;
      updates[id] = { investments: { ...(p.investments || {}), [effect.key]: Math.round(cur * (1 + effect.pct)) } };
    });
    await patch('players', updates);
  }
  if (effect.type === 'cashRandomPlayer') {
    const ids = Object.keys(players);
    if (!ids.length) return;
    const id = ids[Math.floor(Math.random() * ids.length)];
    await patch(`players/${id}`, { cash: Math.max(0, (players[id].cash || 0) + effect.amount) });
  }
  if (effect.type === 'cashSpecificPlayer') {
    await patch(`players/${effect.playerId}`, { cash: (players[effect.playerId]?.cash || 0) + effect.amount });
  }
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  scheduleNextEvent();
});

client.login(DISCORD_TOKEN);
