// ============================================================
// FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
const ADMIN_PASSWORD = "changeme123";

// ============================================================
// ECONOMY TUNING
// ============================================================
const STARTING_CASH = 1000;

const BUSINESSES = {
  lemonstand: { name:"Lemon Stand",  emoji:"🍋", cost:500,   income:80  },
  foodtruck:  { name:"Food Truck",   emoji:"🚚", cost:2000,  income:320 },
  gamestudio: { name:"Game Studio",  emoji:"🎮", cost:8000,  income:1200},
  bank:       { name:"Bank",         emoji:"🏦", cost:20000, income:4000}
};

const INVESTMENTS = {
  crypto: { name:"Crypto",    emoji:"🪙", volatility:0.18, label:"High Risk" },
  stocks: { name:"Stocks",    emoji:"📊", volatility:0.07, label:"Medium Risk" },
  bonds:  { name:"Gov Bonds", emoji:"📜", volatility:0.02, label:"Low Risk"  }
};

const ACTIONS = {
  risk:   { cooldownSec:20 },
  steal:  { cooldownSec:35 },
  trivia: { cooldownSec:25 },
  slots:  { cooldownSec:15 },
};
const STEAL_AMOUNT = 450;
const STEAL_FAIL_FINE = 300;
const STEAL_SUCCESS_CHANCE = 0.5;
const SLOTS_COST = 200;
const TRIVIA_ANSWER_SECS = 15;
const TRIVIA_MAX_BONUS = 600;

// market updates from admin auto-mode
const MARKET_UPDATE_MS = 60000;
const MIN_EVENT_SECONDS = 90;
const MAX_EVENT_SECONDS = 210;
const POLL_VOTE_SECONDS  = 35;

// ============================================================
// TRIVIA — 60 QUESTIONS across 6 categories
// ============================================================
const TRIVIA_QUESTIONS = [
  // FINANCE / BUSINESS
  {q:"What does ROI stand for?", a:["Return on Investment","Rate of Interest","Risk of Inflation","Revenue on Income"], c:0},
  {q:"A 'bear market' means prices are generally...", a:["Rising","Falling","Flat","Doubling"], c:1},
  {q:"Which is generally the LOWEST risk?", a:["Crypto","Penny stocks","Gov Bonds","NFTs"], c:2},
  {q:"IPO stands for...", a:["International Purchase Order","Initial Public Offering","Interest Payment Option","Index Price Output"], c:1},
  {q:"Diversifying your portfolio mainly helps reduce...", a:["Taxes","Risk","Income","Fees"], c:1},
  {q:"'Net worth' = assets minus...", a:["Income","Taxes","Liabilities","Savings"], c:2},
  {q:"ETF stands for...", a:["Equity Trading Fund","Exchange Traded Fund","Emerging Tech Finance","Electronic Transfer Fee"], c:1},
  {q:"Inflation means your money...", a:["Buys more over time","Buys less over time","Stays the same","Doubles annually"], c:1},
  {q:"The S&P 500 tracks how many companies?", a:["100","250","500","1000"], c:2},
  {q:"'Liquid assets' are assets that...", a:["Are underwater","Can be quickly converted to cash","Require long notice to sell","Are only in banks"], c:1},
  // GAMING
  {q:"What hostile mob explodes in Minecraft?", a:["Zombie","Skeleton","Creeper","Enderman"], c:2},
  {q:"'It's dangerous to go alone! Take this.' is from which game?", a:["Mario","Legend of Zelda","Final Fantasy","Metroid"], c:1},
  {q:"In Among Us, crewmates win by...", a:["Collecting coins","Completing tasks or voting out impostors","Building a base","Escaping first"], c:1},
  {q:"What is Fortnite's shrinking zone called?", a:["The Circle","The Ring","The Storm","The Zone"], c:2},
  {q:"Roblox's in-game currency is called...", a:["Robits","Robucks","Robux","RoCoins"], c:2},
  {q:"In GTA, what does GTA stand for?", a:["Go To Action","Grand Theft Auto","Great Traffic Anarchy","Gang Territory Area"], c:1},
  {q:"Mario's dinosaur companion is named...", a:["Rex","Bowser","Yoshi","Koopa"], c:2},
  {q:"What game has the map 'Verdansk'?", a:["Fortnite","Apex Legends","Call of Duty Warzone","PUBG"], c:2},
  {q:"In League of Legends, what do you destroy to win?", a:["The Baron","The Dragon","The Nexus","The Fountain"], c:2},
  {q:"Minecraft was originally made by...", a:["Todd Howard","Notch (Markus Persson)","Phil Spencer","Gabe Newell"], c:1},
  // POP CULTURE
  {q:"Spider-Man's real name is...", a:["Peter Parker","Miles Morales","Tony Stark","Wade Wilson"], c:0},
  {q:"'I am Groot' is from which movie?", a:["Avengers","Thor","Guardians of the Galaxy","Black Panther"], c:2},
  {q:"Which show features the phrase 'Winter is Coming'?", a:["The Witcher","Game of Thrones","Vikings","Rings of Power"], c:1},
  {q:"The Mandalorian's tiny companion is nicknamed...", a:["Baby Yoda","Mini Yoda","Child Yoda","Grogu Wan"], c:0},
  {q:"Drake's hometown is...", a:["New York","Los Angeles","Toronto","Atlanta"], c:2},
  {q:"TikTok was originally called...", a:["Vine","Dubsmash","Musical.ly","Lasso"], c:2},
  {q:"What color pill does Neo take in The Matrix?", a:["Blue","Green","Red","White"], c:2},
  {q:"MrBeast's real first name is...", a:["James","Tyler","Jimmy","Logan"], c:2},
  {q:"Which artist released 'God's Plan'?", a:["Kendrick Lamar","Travis Scott","Drake","J. Cole"], c:2},
  {q:"The TV show 'Squid Game' is from which country?", a:["Japan","China","South Korea","Thailand"], c:2},
  // SCIENCE / GENERAL
  {q:"Water's chemical formula is...", a:["HO2","H2O","H3O","OH2"], c:1},
  {q:"Fastest land animal on Earth?", a:["Lion","Peregrine Falcon","Cheetah","Greyhound"], c:2},
  {q:"How many sides does a hexagon have?", a:["5","6","7","8"], c:1},
  {q:"Largest planet in our solar system?", a:["Saturn","Neptune","Uranus","Jupiter"], c:3},
  {q:"What does DNA stand for?", a:["Deoxyribonucleic Acid","Dynamic Nucleic Array","Dual Nitrogen Agent","Direct Neural Access"], c:0},
  {q:"Closest star to Earth (other than the Sun)?", a:["Sirius","Betelgeuse","Proxima Centauri","Vega"], c:2},
  {q:"What gas do plants absorb during photosynthesis?", a:["Oxygen","Nitrogen","Carbon Dioxide","Hydrogen"], c:2},
  {q:"Boiling point of water in Celsius at sea level?", a:["90°","95°","100°","105°"], c:2},
  {q:"How many bones does an adult human body have?", a:["186","196","206","216"], c:2},
  {q:"Which planet is known as the Red Planet?", a:["Venus","Jupiter","Saturn","Mars"], c:3},
  // SPORTS
  {q:"How many players are on a basketball court per team?", a:["4","5","6","7"], c:1},
  {q:"FIFA World Cup is held every how many years?", a:["2","3","4","5"], c:2},
  {q:"How many holes on a standard golf course?", a:["9","12","18","24"], c:2},
  {q:"F1 stands for...", a:["First Formula","Formula One","Fast Racing 1","Final One"], c:1},
  {q:"How many points is a touchdown worth in the NFL?", a:["3","4","6","7"], c:2},
  {q:"The Super Bowl is the championship for which sport?", a:["Baseball","Basketball","American Football","Ice Hockey"], c:2},
  {q:"Which country has won the most FIFA World Cups?", a:["Germany","Argentina","Brazil","France"], c:2},
  {q:"How many sets to win a men's Grand Slam tennis match?", a:["2","3","4","5"], c:1},
  {q:"The NBA champion gets the...", a:["Lombardi Trophy","Larry O'Brien Trophy","Stanley Cup","Commissioner's Trophy"], c:1},
  {q:"Track and field sprint 'short sprint' distance (meters)?", a:["50","60","100","200"], c:2},
  // FOOD & GEOGRAPHY
  {q:"Sushi originated from which country?", a:["China","Korea","Japan","Thailand"], c:2},
  {q:"Capital city of Australia?", a:["Sydney","Melbourne","Perth","Canberra"], c:3},
  {q:"Pizza is traditionally from which country?", a:["France","Spain","Greece","Italy"], c:3},
  {q:"The Amazon rainforest is mainly in which country?", a:["Colombia","Peru","Brazil","Venezuela"], c:2},
  {q:"Tacos are associated with which cuisine?", a:["Spanish","Tex-Mex / Mexican","Peruvian","Cuban"], c:1},
  {q:"What type of food is spaghetti?", a:["Rice","Bread","Pasta","Dumpling"], c:2},
  {q:"Longest river in the world?", a:["Amazon","Mississippi","Yangtze","Nile"], c:3},
  {q:"French fries were popularized in which country?", a:["France","Belgium","USA","Netherlands"], c:1},
  {q:"What is the national dish of Japan?", a:["Ramen","Sushi","Curry","There isn't one official dish"], c:3},
  {q:"Which country invented chocolate?", a:["Switzerland","Belgium","Ancient Mesoamerica (Mexico/Central America)","Spain"], c:2}
];

// ============================================================
// DIRECT EVENTS (admin or auto-fires — apply to everyone instantly)
// ============================================================
const DIRECT_EVENTS = [
  { id:"grant",   title:"💰 Government Grant",  desc:"Everyone gets +$500!",                        apply:(p)=>({cash:p.cash+500})         },
  { id:"crash",   title:"📉 Market Crash",       desc:"Everyone loses 20% cash.",                    apply:(p)=>({cash:Math.round(p.cash*0.8)}) },
  { id:"boom",    title:"🚀 Tech Boom",           desc:"All investments +30%!",                      apply:(p)=>({investments:scaleInv(p,1.3)}) },
  { id:"viral",   title:"🎉 Viral Moment",        desc:"Everyone gets +$250!",                        apply:(p)=>({cash:p.cash+250})         },
  { id:"heist",   title:"🚨 Bank Heist",          desc:"A random player loses 30% cash to thieves!", apply:(p)=>({cash:Math.round(p.cash*0.7)}), randomTarget:true },
  { id:"windfall",title:"🌟 Windfall",            desc:"A random player wins $1,500!",                apply:(p)=>({cash:p.cash+1500}),          randomTarget:true },
  { id:"tax",     title:"🏛️ Tax Season",          desc:"Everyone pays 15% tax.",                     apply:(p)=>({cash:Math.round(p.cash*0.85)}) },
  { id:"bonus",   title:"🎁 Streamer Bonus",      desc:"Everyone gets +$300!",                        apply:(p)=>({cash:p.cash+300})         }
];

const POLL_EVENTS = [
  {
    question:"Which disaster strikes the economy?!",
    options:[
      { label:"📉 Market Crash (everyone -20% cash)",    apply:(p)=>({cash:Math.round(p.cash*0.8)}) },
      { label:"💸 Inflation (everyone -10% cash)",        apply:(p)=>({cash:Math.round(p.cash*0.9)}) },
      { label:"🏦 Tax Hike (random player -$750)",        apply:(p)=>({cash:Math.max(0,p.cash-750)}), randomTarget:true },
      { label:"🎉 Business Boom (everyone +$400)",        apply:(p)=>({cash:p.cash+400}) }
    ]
  },
  {
    question:"Should CRYPTO go UP or DOWN?!",
    options:[
      { label:"🪙 Crypto MOONS +50%",  apply:(p)=>({investments:scaleInv(p,1.5,'crypto')}) },
      { label:"🪙 Crypto CRASHES -50%",apply:(p)=>({investments:scaleInv(p,0.5,'crypto')}) }
    ]
  },
  {
    question:"Stocks: bull run or correction?",
    options:[
      { label:"📈 Bull Run +30%",   apply:(p)=>({investments:scaleInv(p,1.3,'stocks')}) },
      { label:"📉 Correction -30%", apply:(p)=>({investments:scaleInv(p,0.7,'stocks')}) }
    ]
  },
  {
    question:"Pick a player to receive a $5,000 bonus!",
    dynamicPlayers:true,
    apply:(p,won)=> won ? {cash:p.cash+5000} : {}
  },
  {
    question:"Double or nothing on all investments?!",
    options:[
      { label:"💰 DOUBLE all investments!",  apply:(p)=>({investments:scaleInv(p,2.0)}) },
      { label:"💀 HALVE all investments...", apply:(p)=>({investments:scaleInv(p,0.5)}) }
    ]
  }
];

function scaleInv(p, factor, onlyKey){
  const inv = {...(p.investments||{})};
  Object.keys(inv).forEach(k=>{ if (!onlyKey||k===onlyKey) inv[k]=Math.round((inv[k]||0)*factor); });
  return inv;
}
