let lvl = 1, stars = 0, upg = { speed: 1, repro: 1, cap: 1, start: 1 };
let energy = 30, lastEnergyTs = Date.now();
const MAX_ENERGY = 30, ENERGY_COST = 3, RECOVER_MS = 180000;

function loadData() {
  try {
    if (localStorage.getItem('gt_lvl')) lvl = +localStorage.getItem('gt_lvl');
    if (localStorage.getItem('gt_stars')) stars = +localStorage.getItem('gt_stars');
    if (localStorage.getItem('gt_upg')) upg = JSON.parse(localStorage.getItem('gt_upg'));
    if (localStorage.getItem('gt_nrg') !== null) energy = +localStorage.getItem('gt_nrg');
    if (localStorage.getItem('gt_ts')) lastEnergyTs = +localStorage.getItem('gt_ts');
  } catch (e) {}
  syncEnergy();
}

function saveData() {
  try {
    localStorage.setItem('gt_lvl', lvl);
    localStorage.setItem('gt_stars', stars);
    localStorage.setItem('gt_upg', JSON.stringify(upg));
    localStorage.setItem('gt_nrg', energy);
    localStorage.setItem('gt_ts', lastEnergyTs);
  } catch (e) {}
}

function syncEnergy() {
  if (energy >= MAX_ENERGY) {
    energy = MAX_ENERGY;
    lastEnergyTs = Date.now();
    return;
  }
  let now = Date.now(), elapsed = now - lastEnergyTs;
  if (elapsed >= RECOVER_MS) {
    let gained = Math.floor(elapsed / RECOVER_MS);
    energy = Math.min(MAX_ENERGY, energy + gained);
    lastEnergyTs = energy >= MAX_ENERGY ? now : lastEnergyTs + gained * RECOVER_MS;
    saveData();
  }
}

window.resetSave = function() {
  localStorage.clear();
  lvl = 1; stars = 0; energy = 30; lastEnergyTs = Date.now();
  upg = { speed: 1, repro: 1, cap: 1, start: 1 };
  saveData(); updateUI();
};

window.buyUpgrade = function(k) {
  if (stars >= upg[k]) {
    stars -= upg[k]; upg[k]++; saveData(); updateUI();
  }
};

const THEATRES = ["Heartland Basin", "Sunscorched Dunes", "Frostfang Tundra", "Emerald Delta", "Crimson Canyon", "Shattered Coast"];
const BIOMES = [
  { bg: "#86efac", shore: "#fef08a", accent: "#22c55e", type: "grass" },
  { bg: "#fde047", shore: "#fef9c3", accent: "#eab308", type: "desert" },
  { bg: "#e2e8f0", shore: "#f8fafc", accent: "#94a3b8", type: "tundra" }
];

function updateUI() {
  syncEnergy();
  document.getElementById('menu-stars').textContent = stars;
  document.getElementById('menu-energy').textContent = energy;
  document.getElementById('highest-lvl').textContent = lvl - 1;
  document.getElementById('next-lvl-btn').textContent = lvl;
  document.getElementById('region-preview').textContent = "Next Theatre: " + THEATRES[(lvl - 1) % THEATRES.length];
  let timerEl = document.getElementById('energy-timer');
  if (energy >= MAX_ENERGY) {
    timerEl.textContent = "(Full)";
  } else {
    let rem = Math.max(0, RECOVER_MS - (Date.now() - lastEnergyTs));
    let m = Math.floor(rem / 60000), s = Math.floor((rem % 60000) / 1000);
    timerEl.textContent = `(+1 in ${m}:${s < 10 ? '0' : ''}${s})`;
  }
  ['speed', 'repro', 'cap', 'start'].forEach(k => {
    document.getElementById('lvl-' + k).textContent = upg[k];
    document.getElementById('cost-' + k).textContent = upg[k];
  });
}
setInterval(updateUI, 1000);

window.startBattle = function() {
  syncEnergy();
  let msg = document.getElementById('energy-msg');
  if (energy < ENERGY_COST) {
    msg.textContent = `Not enough energy! Need ${ENERGY_COST} ⚡ to invade.`;
    return;
  }
  msg.textContent = "";
  if (energy === MAX_ENERGY) lastEnergyTs = Date.now();
  energy -= ENERGY_COST;
  saveData();
  openGame('state-page');
};

window.openGame = function(id) {
  if (loop) clearInterval(loop);
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  updateUI();
  if (id === 'state-page') setTimeout(initGame, 50);
};
function pointInPoly(pt, vs) {
  let x = pt.x, y = pt.y, inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i].x, yi = vs[i].y, xj = vs[j].x, yj = vs[j].y;
    if (((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function makeContinent(W, H) {
  let pts = [], steps = 28, p1 = Math.random() * 6, p2 = Math.random() * 6, p3 = Math.random() * 6;
  for (let i = 0; i < steps; i++) {
    let a = (i / steps) * Math.PI * 2;
    let r = 0.39 + 0.05 * Math.sin(a * 3 + p1) + 0.035 * Math.cos(a * 5 + p2) + 0.02 * Math.sin(a * 7 + p3);
    pts.push({ x: (0.5 + Math.cos(a) * r) * W, y: (0.5 + Math.sin(a) * r) * H });
  }
  return pts;
}

function carveMap(seeds, islandPoly) {
  return seeds.map((s, idx) => {
    let poly = islandPoly.map(p => ({ x: p.x, y: p.y }));
    seeds.forEach((o, j) => {
      if (idx === j) return;
      let mx = (s.x + o.x) / 2, my = (s.y + o.y) / 2, nx = o.x - s.x, ny = o.y - s.y;
      let out = [];
      for (let i = 0; i < poly.length; i++) {
        let a = poly[i], b = poly[(i + 1) % poly.length];
        let da = (a.x - mx) * nx + (a.y - my) * ny, db = (b.x - mx) * nx + (b.y - my) * ny;
        if (da <= 0) out.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
          let t = da / (da - db);
          out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
        }
      }
      poly = out;
    });
    return poly;
  });
}

let canvas, ctx, nodes = [], troops = [], selectedChain = [], dragPos = null, loop, aiTick = 0, won = false;
let island = [], biome = BIOMES.at(0), props = [], river = [];

function initGame() {
  canvas = document.getElementById('stateCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = canvas.parentElement.clientHeight;
  let W = canvas.width, H = canvas.height;
  troops = []; selectedChain = []; dragPos = null; aiTick = 0; won = false;
  document.getElementById('next-btn').style.display = 'none';
  let name = THEATRES[(lvl - 1) % THEATRES.length];
  biome = BIOMES[(lvl - 1) % BIOMES.length];
  document.getElementById('game-status').textContent = `Lvl ${lvl}: ${name}`;
  island = makeContinent(W, H);

  let rAng = Math.random() * Math.PI * 2, rPhase = Math.random() * 6;
  river = [];
  for (let i = 0; i <= 20; i++) {
    let t = (i / 20) - 0.5;
    let perp = Math.sin(t * 9 + rPhase) * 0.06;
    river.push({ x: (0.5 + t * Math.cos(rAng) - perp * Math.sin(rAng)) * W, y: (0.5 + t * Math.sin(rAng) + perp * Math.cos(rAng)) * H });
  }

  props = [];
  for (let i = 0; i < 36; i++) {
    let px = (0.15 + Math.random() * 0.7) * W, py = (0.15 + Math.random() * 0.7) * H;
    if (pointInPoly({ x: px, y: py }, island)) {
      props.push({ x: px, y: py, kind: i % 4 === 0 ? 'mtn' : 'flora', sz: 4 + Math.random() * 4 });
    }
  }

  let count = Math.min(8, 5 + Math.floor(lvl / 2)), rot = Math.random() * Math.PI * 2, seeds = [];
  for (let i = 0; i < count; i++) {
    let ang = rot + (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
    let rad = i === 0 ? 0.05 : 0.23 + Math.random() * 0.06;
    seeds.push({ x: (0.5 + Math.cos(ang) * rad) * W, y: (0.5 + Math.sin(ang) * rad) * H });
  }

  let polys = carveMap(seeds, island);
  let indices = seeds.map((_, i) => i).sort(() => Math.random() - 0.5);
  let enemyCount = Math.min(3, 1 + Math.floor(lvl / 2));

  nodes = seeds.map((s, i) => {
    let pts = polys[i];
    let cx = pts.length ? pts.reduce((sum, p) => sum + p.x, 0) / pts.length : s.x;
    let cy = pts.length ? pts.reduce((sum, p) => sum + p.y, 0) / pts.length : s.y;
    let rank = indices.indexOf(i), team = 'neutral', color = '#64748b', cnt = 120 + Math.floor(Math.random() * 90), max = 600;
    if (rank === 0) {
      team = 'player'; color = '#eab308'; cnt = 400 + (upg.start - 1) * 120; max = 1000 + (upg.cap - 1) * 250;
    } else if (rank <= enemyCount) {
      team = rank % 2 === 1 ? 'blue' : 'red'; color = team === 'blue' ? '#3b82f6' : '#ef4444'; cnt = 300 + lvl * 25; max = 1000 + lvl * 50;
    }
    return { id: i, x: cx, y: cy, pts, team, color, count: cnt, max };
  });

  function getHitNode(pt) {
    return nodes.find(n => (n.pts.length && pointInPoly(pt, n.pts)) || Math.hypot(n.x - pt.x, n.y - pt.y) < 35);
  }

  canvas.ontouchstart = function(e) {
    e.preventDefault();
    let t = e.touches && e.touches.item(0);
    if (!t) return;
    let r = canvas.getBoundingClientRect();
    let pt = { x: t.clientX - r.left, y: t.clientY - r.top };
    let hit = getHitNode(pt);
    if (hit && hit.team === 'player') { selectedChain = [hit]; dragPos = pt; }
  };

  canvas.ontouchmove = function(e) {
    e.preventDefault();
    let t = e.touches && e.touches.item(0);
    if (!selectedChain.length || !t) return;
    let r = canvas.getBoundingClientRect();
    dragPos = { x: t.clientX - r.left, y: t.clientY - r.top };
    let hit = getHitNode(dragPos);
    if (hit && hit.team === 'player' && !selectedChain.includes(hit)) selectedChain.push(hit);
  };

  canvas.ontouchend = function(e) {
    e.preventDefault();
    if (selectedChain.length && dragPos) {
      let target = getHitNode(dragPos);
      if (target) selectedChain.forEach(src => { if (src !== target) sendTroops(src, target); });
    }
    selectedChain = []; dragPos = null;
  };

  if (loop) clearInterval(loop);
  loop = setInterval(updateGame, 40);
}

function sendTroops(src, target) {
  let amount = Math.floor(src.count * 0.65);
  if (amount <= 0) return;
  src.count -= amount;
  let spd = (src.team === 'player' ? 3.2 + (upg.speed - 1) * 0.45 : 3.0);
  let waves = Math.min(18, Math.max(4, Math.ceil(amount / 20)));
  let perDot = amount / waves;
  for (let i = 0; i < waves; i++) {
    setTimeout(() => {
      if (src && target) {
        troops.push({ x: src.x + (Math.random() - 0.5) * 14, y: src.y + (Math.random() - 0.5) * 14, target, team: src.team, color: src.color, val: perDot, spd });
      }
    }, i * 55);
  }
}
function updateGame() {
  let W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 0, W, H);

  if (island.length) {
    ctx.beginPath();
    island.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    ctx.lineWidth = 18; ctx.strokeStyle = biome.shore; ctx.stroke();
    ctx.fillStyle = biome.bg; ctx.fill();
  }

  if (river.length) {
    ctx.save();
    ctx.beginPath();
    island.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.clip();
    ctx.beginPath();
    river.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.strokeStyle = "#38bdf8"; ctx.lineWidth = 9; ctx.lineCap = "round"; ctx.stroke();
    ctx.restore();
  }

  props.forEach(pr => {
    ctx.fillStyle = pr.kind === 'mtn' ? "rgba(100,116,139,0.35)" : biome.accent;
    ctx.beginPath();
    if (pr.kind === 'mtn') {
      ctx.moveTo(pr.x, pr.y - pr.sz); ctx.lineTo(pr.x + pr.sz, pr.y + pr.sz); ctx.lineTo(pr.x - pr.sz, pr.y + pr.sz);
    } else {
      ctx.arc(pr.x, pr.y, pr.sz * 0.65, 0, Math.PI * 2);
    }
    ctx.fill();
  });

  aiTick++;
  nodes.forEach(n => {
    if (n.team !== 'neutral' && n.count < n.max) {
      let rate = n.team === 'player' ? 0.35 + (upg.repro - 1) * 0.12 : 0.32 + lvl * 0.02;
      n.count = Math.min(n.max, n.count + rate);
    }
    if (n.pts.length) {
      ctx.beginPath();
      n.pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
      ctx.closePath();
      ctx.fillStyle = n.team === 'neutral' ? 'rgba(255,255,255,0.22)' : n.color + '55';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = n.team === 'neutral' ? 'rgba(15,23,42,0.25)' : n.color;
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(n.x, n.y, 20, 0, Math.PI * 2);
    ctx.fillStyle = n.color; ctx.fill();
    ctx.lineWidth = selectedChain.includes(n) ? 4 : 2.5;
    ctx.strokeStyle = selectedChain.includes(n) ? "#ffffff" : "#0f172a"; ctx.stroke();
    ctx.fillStyle = "#ffffff"; ctx.font = "800 13px sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(Math.floor(n.count), n.x, n.y);
  });

  if (selectedChain.length && dragPos) {
    selectedChain.forEach(src => {
      ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(dragPos.x, dragPos.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)"; ctx.lineWidth = 4;
      ctx.setLineDash([6, 6]); ctx.stroke(); ctx.setLineDash([]);
    });
  }

  if (aiTick % Math.max(25, 65 - lvl * 2) === 0) {
    ['blue', 'red'].forEach(t => {
      let aiNodes = nodes.filter(n => n.team === t && n.count > 120);
      if (aiNodes.length) {
        let src = aiNodes[Math.floor(Math.random() * aiNodes.length)];
        let targets = nodes.filter(n => n.team !== t);
        if (targets.length) {
          targets.sort((a, b) => a.count - b.count);
          sendTroops(src, targets.at(0));
        }
      }
    });
  }

  for (let i = troops.length - 1; i >= 0; i--) {
    let tr = troops[i], dx = tr.target.x - tr.x, dy = tr.target.y - tr.y, dist = Math.hypot(dx, dy);
    if (dist < 18) {
      if (tr.target.team === tr.team) tr.target.count = Math.min(tr.target.max, tr.target.count + tr.val);
      else {
        tr.target.count -= tr.val;
        if (tr.target.count <= 0) { tr.target.count = Math.abs(tr.target.count) + 15; tr.target.team = tr.team; tr.target.color = tr.color; }
      }
      troops.splice(i, 1); continue;
    }
    tr.x += (dx / dist) * tr.spd; tr.y += (dy / dist) * tr.spd;
    ctx.beginPath(); ctx.arc(tr.x, tr.y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = tr.color; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "#fff"; ctx.stroke();
  }

  let playerAlive = nodes.some(n => n.team === 'player') || troops.some(t => t.team === 'player');
  let enemyAlive = nodes.some(n => n.team === 'blue' || n.team === 'red') || troops.some(t => t.team === 'blue' || t.team === 'red');

  if (!won && !enemyAlive && playerAlive) {
    won = true; clearInterval(loop); stars += 2 + Math.floor(lvl / 3); lvl++; saveData();
    document.getElementById('game-status').textContent = "VICTORY! Theatre Conquered!";
    document.getElementById('next-btn').style.display = 'inline-block';
  } else if (!won && !playerAlive) {
    won = true; clearInterval(loop);
    document.getElementById('game-status').textContent = "DEFEAT! Forces Overrun.";
  }
}

window.nextLevel = function() { startBattle(); };

loadData();
updateUI();

const AdMobPlugin = window.Capacitor?.registerPlugin ? window.Capacitor.registerPlugin('AdMob') : window.Capacitor?.Plugins?.AdMob;
const REWARDED_AD_ID = 'ca-app-pub-4888916688985697/3721133365';

if (AdMobPlugin && AdMobPlugin.initialize) {
  AdMobPlugin.initialize({ initializeForTesting: true }).catch(() => {});
}

window.watchRewardAd = async function(rewardType) {
  let msg = document.getElementById('energy-msg');
  msg.style.color = "#0284c7";
  msg.textContent = "Loading video ad...";
  if (AdMobPlugin && AdMobPlugin.prepareRewardVideoAd) {
    try {
      await AdMobPlugin.prepareRewardVideoAd({ adId: REWARDED_AD_ID });
      const rewardItem = await AdMobPlugin.showRewardVideoAd();
      if (rewardItem) {
        if (rewardType === 'energy') { energy = Math.min(MAX_ENERGY, energy + 15); msg.textContent = "Reward claimed: +15 Energy! ⚡"; }
        else if (rewardType === 'stars') { stars += 3; msg.textContent = "Reward claimed: +3 Stars! ⭐️"; }
        saveData(); updateUI();
      }
    } catch (err) {
      msg.style.color = "#dc2626";
      msg.textContent = "Ad loading... tap again in 3s!";
    }
  } else {
    setTimeout(() => {
      if (rewardType === 'energy') { energy = Math.min(MAX_ENERGY, energy + 15); msg.textContent = "Reward claimed: +15 Energy! ⚡"; }
      else if (rewardType === 'stars') { stars += 3; msg.textContent = "Reward claimed: +3 Stars! ⭐️"; }
      saveData(); updateUI();
    }, 1500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const invadeBtn = document.getElementById('invade-btn');
  if (invadeBtn) invadeBtn.addEventListener('click', window.startBattle);
  const nextBtn = document.getElementById('next-btn');
  if (nextBtn) nextBtn.addEventListener('click', window.nextLevel);
});
