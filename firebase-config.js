// ====== FIREBASE CONFIG ======
// 1. Go to https://console.firebase.google.com -> Create Project
// 2. Build > Realtime Database > Create Database (start in TEST mode for a quick stream event,
//    or lock it down with rules later — see README.md)
// 3. Project settings > General > Your apps > Web app (</>) > copy the config object below
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Password admin types into the Admin tab to unlock controls.
// This is NOT real security (anyone can view source) - fine for a casual stream event.
const ADMIN_PASSWORD = "changeme123";

// ====== GAME CONSTANTS ======
const STARTING_CASH = 1000;

const BUSINESSES = {
  lemonstand: { name: "Lemon Stand",  emoji: "🍋", cost: 500,    income: 100  },
  foodtruck:  { name: "Food Truck",   emoji: "🚚", cost: 2000,   income: 400  },
  gamestudio: { name: "Game Studio",  emoji: "🎮", cost: 10000,  income: 2000 },
  bank:       { name: "Bank",         emoji: "🏦", cost: 25000,  income: 5000 }
};
// income = $ earned per minute per unit owned, collected manually via "Collect Income"

const INVESTMENTS = {
  crypto: { name: "Crypto", emoji: "🪙", risk: "High"   },
  stocks: { name: "Stocks", emoji: "📊", risk: "Medium" },
  bonds:  { name: "Bonds",  emoji: "📜", risk: "Low"    }
};

// ====== PLAYER ACTION TUNING ======
const ACTIONS = {
  risk:    { cooldownSec: 25, label: "🎲 Risk It" },
  steal:   { cooldownSec: 40, label: "🦹 Sabotage" },
  trivia:  { cooldownSec: 30, label: "🧠 Trivia Rush" },
  gift:    { cooldownSec: 10, label: "🤝 Send Cash" }
};

const STEAL_AMOUNT = 400;       // amount attempted to steal
const STEAL_FAIL_FINE = 250;    // fine if caught failing
const STEAL_SUCCESS_CHANCE = 0.5;

const TRIVIA_BONUS = 350;
const TRIVIA_QUESTIONS = [
  { q: "What does ROI stand for?", a: ["Return on Investment", "Rate of Interest", "Risk of Inflation", "Return on Income"], correct: 0 },
  { q: "Which is generally the LOWEST risk investment?", a: ["Crypto", "Bonds", "Stocks", "Lottery"], correct: 1 },
  { q: "A 'bear market' means prices are generally...", a: ["Rising fast", "Falling", "Frozen", "Doubling"], correct: 1 },
  { q: "What's a common term for a company's first stock sale to the public?", a: ["IPO", "ROI", "LLC", "ETF"], correct: 0 },
  { q: "Diversifying your investments mainly helps reduce...", a: ["Taxes", "Risk", "Income", "Fees"], correct: 1 },
  { q: "Which usually has the HIGHEST volatility?", a: ["Bonds", "Savings account", "Crypto", "Cash"], correct: 2 },
  { q: "'Net worth' equals assets minus...", a: ["Income", "Liabilities", "Taxes", "Savings"], correct: 1 },
  { q: "A 'market crash' refers to a rapid...", a: ["Price increase", "Price decrease", "Interest freeze", "Tax hike"], correct: 1 }
];

// ====== RANDOM EVENT ENGINE (fires automatically while the game is running) ======
// type "direct": applies instantly to everyone, no vote.
// type "poll": viewers vote 1/2/3/4 on the Viewer Vote tab; the winning option's effect applies.
const MIN_EVENT_SECONDS = 90;   // ~1.5 min
const MAX_EVENT_SECONDS = 240;  // 4 min  (tune freely — spec said every 5-10 min, this is punchier/"action packed")
const POLL_VOTE_SECONDS = 35;

const DIRECT_EVENTS = [
  { title: "💰 Government Grant", desc: "Everyone gets +$500 cash, no strings attached.",
    apply: (p) => ({ cash: p.cash + 500 }) },
  { title: "📉 Market Crash", desc: "Panic selling! Everyone loses 20% of their cash.",
    apply: (p) => ({ cash: Math.round(p.cash * 0.8) }) },
  { title: "🚀 Tech Boom", desc: "Investments are mooning — all investment values +30%.",
    apply: (p) => ({ investments: scaleInvestments(p, 1.3) }) },
  { title: "🌪️ Freak Storm", desc: "Business income halved for the next collection — collect now before it passes!",
    apply: (p) => (p) },
  { title: "🎉 Viral Clip", desc: "Someone's stream went viral — everyone gets +$250.",
    apply: (p) => ({ cash: p.cash + 250 }) }
];

const POLL_EVENTS = [
  {
    question: "Which disaster strikes the economy?!",
    options: [
      { label: "📉 Market Crash (-20% cash, everyone)", apply: (p) => ({ cash: Math.round(p.cash * 0.8) }) },
      { label: "💸 Inflation (-10% cash, everyone)", apply: (p) => ({ cash: Math.round(p.cash * 0.9) }) },
      { label: "🏦 Tax Hike (random player -$750)", randomTarget: true, apply: (p) => ({ cash: Math.max(0, p.cash - 750) }) },
      { label: "📈 Business Boom (+25% biz income next collect)", apply: (p) => (p) }
    ]
  },
  {
    question: "Should crypto go UP or DOWN?!",
    options: [
      { label: "🪙 Crypto UP +40%", apply: (p) => ({ investments: scaleInvestments(p, 1.4, 'crypto') }) },
      { label: "🪙 Crypto DOWN -40%", apply: (p) => ({ investments: scaleInvestments(p, 0.6, 'crypto') }) }
    ]
  },
  {
    question: "Stocks: bull run or correction?",
    options: [
      { label: "📈 Bull Run +25%", apply: (p) => ({ investments: scaleInvestments(p, 1.25, 'stocks') }) },
      { label: "📉 Correction -25%", apply: (p) => ({ investments: scaleInvestments(p, 0.75, 'stocks') }) }
    ]
  },
  {
    question: "Who deserves a $5,000 bonus?!",
    dynamicPlayers: true,
    apply: (p, won) => won ? { cash: p.cash + 5000 } : p
  }
];

function scaleInvestments(p, factor, onlyKey) {
  const inv = { ...(p.investments || {}) };
  Object.keys(inv).forEach(k => {
    if (!onlyKey || k === onlyKey) inv[k] = Math.round((inv[k] || 0) * factor);
  });
  return inv;
}
