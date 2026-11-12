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
let island = [], biome = BIOMES[0], props = [], river = [];

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
    let rx = t * Math.cos(rAng) - perp * Math.sin(rAng);
    let ry = t * Math.sin(rAng) + perp * Math.cos(rAng);
    river.push({ x: (0.5 + rx) * W, y: (0.5 + ry) * H });
  }
    props = [];
  for (let i = 0; i < 36; i++) {
    let px = (0.15 + Math.random() * 0.7) * W, py = (0.15 + Math.random() * 0.7) * H;
    if (pointInPoly({ x: px, y: py }, island)) {
      props.push({ x: px, y: py, kind: i % 4 === 0 ? 'mtn' : 'flora', sz: 4 + Math.random() * 4 });
    }
  }

  let count = Math.min(8, 5 + Math.floor(lvl / 2));
  let rot = Math.random() * Math.PI * 2;
  let seeds = [];
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
    if (!e.touches || !e.touches.length) return;
    let r = canvas.getBoundingClientRect();
    let pt = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    let hit = getHitNode(pt);
    if (hit && hit.team === 'player') { selectedChain = [hit]; dragPos = pt; }
  };
   canvas.ontouchmove = function(e) {
    e.preventDefault();
    if (!selectedChain.length || !e.touches || !e.touches.length) return;
    let r = canvas.getBoundingClientRect();
    let pt = { x: e.touches[0].clientX - r.left, y: e.touches[0].clientY - r.top };
    dragPos = pt;
    let hit = getHitNode(pt);
    if (hit && hit.team === 'player' && !selectedChain.includes(hit)) selectedChain.push(hit);
  };
  canvas.ontouchend = function() {
    if (selectedChain.length && dragPos) {
      let target = getHitNode(dragPos);
      if (target) selectedChain.forEach(src => { if (src.id !== target.id && src.team === 'player') sendTroops(src, target); });
    }
    selectedChain = []; dragPos = null;
  };

  if (loop) clearInterval(loop);
  loop = setInterval(tick, 33);
}
function sendTroops(src, dst) {
  let dots = Math.floor((src.count * 0.5) / 5);
  if (dots <= 0) return;
  src.count -= dots * 5;
  let spd = src.team === 'player' ? 3.2 + (upg.speed - 1) * 0.7 : 3.2;
  for (let i = 0; i < dots; i++) {
    troops.push({ x: src.x + (Math.random() * 10 - 5), y: src.y + (Math.random() * 10 - 5), dst, team: src.team, color: src.color, spd, delay: i * 2 });
  }
}
function drawScenery() {
  let W = canvas.width, H = canvas.height;
  ctx.fillStyle = "#38bdf8";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  for (let y = 25; y < H; y += 38) {
    ctx.beginPath();
    for (let x = 15; x < W - 15; x += 45) {
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 12, y - 5, x + 24, y);
    }
    ctx.stroke();
  }
if (!island.length) return;
ctx.save();
ctx.beginPath();
ctx.moveTo(island[0].x, island[0].y);
for (let i = 1; i < island.length; i++) ctx.lineTo(island[i].x, island[i].y);
ctx.closePath();
ctx.lineWidth = 14;
ctx.strokeStyle = "rgba(255,255,255,0.45)";
ctx.stroke();
ctx.lineWidth = 7;
ctx.strokeStyle = biome.shore;
ctx.stroke();
ctx.fillStyle = biome.bg;
ctx.fill();
ctx.clip();
if (river.length) {
ctx.beginPath();
ctx.moveTo(river[0].x, river[0].y);
for (let i = 1; i < river.length; i++) ctx.lineTo(river[i].x, river[i].y);
ctx.strokeStyle = "#38bdf8";
ctx.lineWidth = 9;
ctx.lineCap = "round";
ctx.stroke();
}
props.forEach(p => {
if (p.kind === 'mtn') {
ctx.fillStyle = "rgba(71,85,105,0.35)";
ctx.beginPath();
ctx.moveTo(p.x, p.y - p.sz * 1.4);
ctx.lineTo(p.x - p.sz * 1.2, p.y + p.sz);
ctx.lineTo(p.x + p.sz * 1.2, p.y + p.sz);
ctx.closePath();
ctx.fill();
} else if (biome.type === 'desert') {
ctx.fillStyle = "rgba(21,128,61,0.45)";
ctx.fillRect(p.x - 1.5, p.y - p.sz, 3, p.sz * 2);
ctx.fillRect(p.x - 4, p.y - p.sz * 0.4, 8, 2.5);
} else {
ctx.fillStyle = biome.type === 'tundra' ? "rgba(100,116,139,0.35)" : "rgba(21,128,61,0.35)";
ctx.beginPath();
ctx.arc(p.x, p.y, p.sz * 0.85, 0, Math.PI * 2);
ctx.fill();
}
});
ctx.restore();
}
function tick() {
ctx.clearRect(0, 0, canvas.width, canvas.height);
drawScenery();
aiTick++;
if (aiTick % 80 === 0) {
let aiNodes = nodes.filter(n => n.team === 'blue' || n.team === 'red');
if (aiNodes.length) {
let src = aiNodes[Math.floor(Math.random() * aiNodes.length)], targets = nodes.filter(n => n.team !== src.team);
if (targets.length && src.count > 80) sendTroops(src, targets[Math.floor(Math.random() * targets.length)]);
}
}
nodes.forEach(n => {
if (!n.pts.length) return;
ctx.beginPath();
ctx.moveTo(n.pts[0].x, n.pts[0].y);
for (let i = 1; i < n.pts.length; i++) ctx.lineTo(n.pts[i].x, n.pts[i].y);
ctx.closePath();
ctx.fillStyle = n.color + '66';
ctx.fill();
ctx.strokeStyle = 'rgba(255,255,255,0.85)';
ctx.lineWidth = 2;
ctx.stroke();
if (n.count < n.max) {
if (n.team === 'player') n.count += 0.12 + (upg.repro - 1) * 0.05;
else if (n.team === 'neutral') n.count += 0.03;
else n.count += 0.11;
}
if (selectedChain.includes(n)) {
ctx.beginPath(); ctx.arc(n.x, n.y, 23, 0, Math.PI * 2); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3.5; ctx.stroke();
}
ctx.beginPath(); ctx.arc(n.x, n.y, 16, 0, Math.PI * 2); ctx.fillStyle = n.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(Math.floor(n.count), n.x, n.y);
});
 if (selectedChain.length && dragPos) {
selectedChain.forEach(src => {
ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(dragPos.x, dragPos.y);
ctx.strokeStyle = 'rgba(234, 179, 8, 0.9)'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
});
}
for (let i = troops.length - 1; i >= 0; i--) {
let a = troops[i];
if (!a) continue;
if (a.delay > 0) { a.delay--; continue; }
let hitIndex = -1;
for (let j = i - 1; j >= 0; j--) {
let b = troops[j];
if (b && b.delay <= 0 && a.team !== b.team && Math.hypot(a.x - b.x, a.y - b.y) < 9) { hitIndex = j; break; }
}
if (hitIndex !== -1) { troops.splice(i, 1); troops.splice(hitIndex, 1); i--; continue; }
let dx = a.dst.x - a.x, dy = a.dst.y - a.y, dist = Math.hypot(dx, dy);
if (dist < 14) {
if (a.dst.team === a.team) a.dst.count = Math.min(a.dst.max, a.dst.count + 5);
else {
a.dst.count -= 5;
if (a.dst.count <= 0) { a.dst.team = a.team; a.dst.color = a.color; a.dst.count = Math.abs(a.dst.count) + 5; }
}
troops.splice(i, 1);
} else {
a.x += (dx / dist) * a.spd; a.y += (dy / dist) * a.spd;
ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, Math.PI * 2); ctx.fillStyle = a.color; ctx.fill();
}
}
let hasEnemy = nodes.some(n => n.team === 'blue' || n.team === 'red') || troops.some(t => t.team === 'blue' || t.team === 'red');
let hasPlayer = nodes.some(n => n.team === 'player') || troops.some(t => t.team === 'player');
if (!hasEnemy && !won) {
won = true; stars += 3; lvl++; saveData();
document.getElementById('game-status').textContent = "Victory! +3 ⭐️ Earned!";
document.getElementById('next-btn').style.display = 'block';
} else if (!hasPlayer && !won) {
document.getElementById('game-status').textContent = "Defeated! Tap Lobby to retry.";
}
}
loadData();
updateUI();  
