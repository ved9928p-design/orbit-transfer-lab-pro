'use strict';

const BODIES = {
  earth: { name: 'Earth', radius: 6371, mu: 398600.4418, maxAltitude: 1000000, colors: ['#8fd1ff', '#2869a4', '#0a1d3d'] },
  moon:  { name: 'Moon',  radius: 1737.4, mu: 4902.8001, maxAltitude: 200000, colors: ['#f1f1ec', '#999a9b', '#32343a'] },
  mars:  { name: 'Mars',  radius: 3389.5, mu: 42828.3752, maxAltitude: 500000, colors: ['#ffb07c', '#bd4f2f', '#42190f'] }
};

const $ = (id) => document.getElementById(id);
const bodySelect = $('bodySelect');
const initialAltitude = $('initialAltitude');
const targetAltitude = $('targetAltitude');
const canvas = $('orbitCanvas');
const ctx = canvas.getContext('2d');
let lastMission = null;
let animationFrame = null;
let animationStart = 0;

function formatNumber(value, digits = 2) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function calculateTransfer(bodyKey, h1, h2) {
  const body = BODIES[bodyKey];
  const r1 = body.radius + h1;
  const r2 = body.radius + h2;
  const a = (r1 + r2) / 2;
  const vCircular1 = Math.sqrt(body.mu / r1);
  const vCircular2 = Math.sqrt(body.mu / r2);
  const vTransfer1 = Math.sqrt(body.mu * (2 / r1 - 1 / a));
  const vTransfer2 = Math.sqrt(body.mu * (2 / r2 - 1 / a));
  const signedDv1 = vTransfer1 - vCircular1;
  const signedDv2 = vCircular2 - vTransfer2;
  const deltaV1 = Math.abs(signedDv1);
  const deltaV2 = Math.abs(signedDv2);
  const totalDeltaV = deltaV1 + deltaV2;
  const transferSeconds = Math.PI * Math.sqrt((a ** 3) / body.mu);
  const raising = h2 > h1;

  return { bodyKey, body, h1, h2, r1, r2, a, vCircular1, vCircular2, vTransfer1, vTransfer2, signedDv1, signedDv2, deltaV1, deltaV2, totalDeltaV, transferSeconds, raising };
}

function validateInputs() {
  const body = BODIES[bodySelect.value];
  const h1 = Number(initialAltitude.value);
  const h2 = Number(targetAltitude.value);
  let message = '';
  if (!Number.isFinite(h1) || !Number.isFinite(h2)) message = 'Enter a numerical altitude in both fields.';
  else if (h1 < 1 || h2 < 1) message = 'Both altitudes must be at least 1 km above the surface.';
  else if (h1 === h2) message = 'Choose two different altitudes to create a transfer orbit.';
  else if (h1 > body.maxAltitude || h2 > body.maxAltitude) message = `For this educational model, use altitudes below ${body.maxAltitude.toLocaleString()} km around ${body.name}.`;
  $('formError').textContent = message;
  return message ? null : { h1, h2 };
}

function updateBodyInfo() {
  const b = BODIES[bodySelect.value];
  $('bodyInfo').innerHTML = `<strong>${b.name}</strong> · Radius ${b.radius.toLocaleString()} km · μ ${b.mu.toLocaleString()} km³/s²`;
}

function updateMissionType() {
  const h1 = Number(initialAltitude.value);
  const h2 = Number(targetAltitude.value);
  const badge = $('missionTypeBadge');
  if (Number.isFinite(h1) && Number.isFinite(h2) && h2 < h1) {
    badge.textContent = 'Orbital lowering';
  } else {
    badge.textContent = 'Orbital raising';
  }
}

function runMission(scroll = false) {
  const valid = validateInputs();
  if (!valid) return;
  lastMission = calculateTransfer(bodySelect.value, valid.h1, valid.h2);
  renderMission(lastMission);
  animateOrbit(lastMission);
  if (scroll) $('resultsSection').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderMission(m) {
  $('deltaV1').textContent = `${formatNumber(m.deltaV1, 3)} km/s`;
  $('deltaV2').textContent = `${formatNumber(m.deltaV2, 3)} km/s`;
  $('totalDeltaV').textContent = `${formatNumber(m.totalDeltaV, 3)} km/s`;
  $('transferTime').textContent = formatDuration(m.transferSeconds);
  $('burn1Direction').textContent = m.raising ? 'Prograde departure burn' : 'Retrograde departure burn';
  $('burn2Direction').textContent = m.raising ? 'Prograde circularization burn' : 'Retrograde circularization burn';
  $('simulationStatus').textContent = `${m.body.name} · ${m.raising ? 'raising' : 'lowering'} transfer complete`;
  $('missionTypeBadge').textContent = m.raising ? 'Orbital raising' : 'Orbital lowering';
  $('reportTimestamp').textContent = `Generated ${new Date().toLocaleString()}`;

  const reportItems = [
    ['Central body', m.body.name], ['Transfer type', m.raising ? 'Hohmann orbital raising' : 'Hohmann orbital lowering'], ['Initial altitude', `${formatNumber(m.h1, 0)} km`],
    ['Target altitude', `${formatNumber(m.h2, 0)} km`], ['Initial orbital radius', `${formatNumber(m.r1, 1)} km`], ['Target orbital radius', `${formatNumber(m.r2, 1)} km`],
    ['Initial circular velocity', `${formatNumber(m.vCircular1, 4)} km/s`], ['Target circular velocity', `${formatNumber(m.vCircular2, 4)} km/s`], ['Transfer semimajor axis', `${formatNumber(m.a, 1)} km`],
    ['Burn 1 magnitude', `${formatNumber(m.deltaV1, 4)} km/s`], ['Burn 2 magnitude', `${formatNumber(m.deltaV2, 4)} km/s`], ['Total delta-v', `${formatNumber(m.totalDeltaV, 4)} km/s`],
    ['Transfer time', formatDuration(m.transferSeconds)], ['Model', 'Ideal two-body, coplanar, impulsive'], ['Purpose', 'Educational visualization only']
  ];
  $('reportGrid').innerHTML = reportItems.map(([label, value]) => `<div class="report-item"><span>${label}</span><strong>${value}</strong></div>`).join('');
  renderSteps(m);
}

function renderSteps(m) {
  const steps = [
    `<strong>Convert altitude to orbital radius:</strong> r₁ = ${formatNumber(m.body.radius,1)} + ${formatNumber(m.h1,1)} = ${formatNumber(m.r1,1)} km; r₂ = ${formatNumber(m.body.radius,1)} + ${formatNumber(m.h2,1)} = ${formatNumber(m.r2,1)} km.`,
    `<strong>Find the transfer semimajor axis:</strong> a = (r₁ + r₂) / 2 = (${formatNumber(m.r1,1)} + ${formatNumber(m.r2,1)}) / 2 = ${formatNumber(m.a,1)} km.`,
    `<strong>Calculate circular velocities:</strong> v₁ = √(μ/r₁) = ${formatNumber(m.vCircular1,4)} km/s; v₂ = √(μ/r₂) = ${formatNumber(m.vCircular2,4)} km/s.`,
    `<strong>Use vis-viva on the transfer ellipse:</strong> vₜ₁ = ${formatNumber(m.vTransfer1,4)} km/s and vₜ₂ = ${formatNumber(m.vTransfer2,4)} km/s.`,
    `<strong>Calculate each impulse:</strong> |Δv₁| = ${formatNumber(m.deltaV1,4)} km/s; |Δv₂| = ${formatNumber(m.deltaV2,4)} km/s.`,
    `<strong>Add the maneuver cost:</strong> Δv total = ${formatNumber(m.deltaV1,4)} + ${formatNumber(m.deltaV2,4)} = ${formatNumber(m.totalDeltaV,4)} km/s.`,
    `<strong>Calculate transfer time:</strong> t = π√(a³/μ) = ${formatDuration(m.transferSeconds)}.`
  ];
  $('calculationSteps').innerHTML = steps.map((s, i) => `<div class="step-row"><span class="step-index">${i+1}</span><p>${s}</p></div>`).join('');
}

function formatDuration(seconds) {
  const hours = seconds / 3600;
  if (hours < 1) return `${formatNumber(seconds / 60, 1)} min`;
  if (hours < 48) return `${formatNumber(hours, 2)} hr`;
  return `${formatNumber(hours / 24, 2)} days`;
}

function reportText(m) {
  return `ORBIT TRANSFER LAB — MISSION REPORT\n\nCreated by Ved Patel\nGenerated: ${new Date().toLocaleString()}\n\nCentral body: ${m.body.name}\nTransfer type: ${m.raising ? 'Hohmann orbital raising' : 'Hohmann orbital lowering'}\nInitial altitude: ${formatNumber(m.h1,0)} km\nTarget altitude: ${formatNumber(m.h2,0)} km\nInitial orbital velocity: ${formatNumber(m.vCircular1,4)} km/s\nTarget orbital velocity: ${formatNumber(m.vCircular2,4)} km/s\nBurn 1: ${formatNumber(m.deltaV1,4)} km/s\nBurn 2: ${formatNumber(m.deltaV2,4)} km/s\nTotal delta-v: ${formatNumber(m.totalDeltaV,4)} km/s\nTransfer time: ${formatDuration(m.transferSeconds)}\n\nAssumptions: ideal two-body motion, circular coplanar orbits, instantaneous burns, no atmospheric drag or perturbations. Educational use only.`;
}

async function copyReport() {
  if (!lastMission) runMission();
  try {
    await navigator.clipboard.writeText(reportText(lastMission));
    $('copyButton').textContent = 'Copied';
    setTimeout(() => $('copyButton').textContent = 'Copy results', 1400);
  } catch {
    $('formError').textContent = 'Clipboard access was blocked. Use Download report instead.';
  }
}

function downloadReport() {
  if (!lastMission) runMission();
  const blob = new Blob([reportText(lastMission)], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `orbit-transfer-${lastMission.bodyKey}-${Date.now()}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

function resizeCanvasForDisplay() {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(Math.max(390, rect.width * .68) * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (lastMission) drawOrbit(lastMission, 1);
}

function animateOrbit(m) {
  cancelAnimationFrame(animationFrame);
  animationStart = performance.now();
  const loop = (now) => {
    const progress = Math.min((now - animationStart) / 3200, 1);
    drawOrbit(m, progress);
    if (progress < 1) animationFrame = requestAnimationFrame(loop);
  };
  animationFrame = requestAnimationFrame(loop);
}

function drawOrbit(m, progress) {
  const w = canvas.clientWidth;
  const h = Math.max(390, w * .68);
  ctx.clearRect(0, 0, w, h);
  drawCanvasStars(w, h);
  const cx = w / 2, cy = h / 2;
  const minR = Math.min(w, h) * .19;
  const maxR = Math.min(w, h) * .39;
  const smaller = Math.min(m.r1, m.r2), larger = Math.max(m.r1, m.r2);
  const scale = (value) => minR + ((value - smaller) / Math.max(larger - smaller, 1)) * (maxR - minR);
  const rStart = scale(m.r1), rTarget = scale(m.r2);
  const planetR = Math.min(w,h) * .105;

  drawCircle(cx, cy, rStart, '#72b8ff', .58);
  drawCircle(cx, cy, rTarget, '#76e6b5', .58);

  const rp = Math.min(rStart, rTarget), ra = Math.max(rStart, rTarget);
  const ellipseA = (rp + ra) / 2;
  const ellipseC = (ra - rp) / 2;
  const ellipseCenterX = cx + (m.raising ? ellipseC : -ellipseC);
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(ellipseCenterX, cy, ellipseA, Math.sqrt(rp * ra), 0, Math.PI, Math.PI * 2);
  ctx.strokeStyle = '#ff7a2f'; ctx.lineWidth = 2.3; ctx.setLineDash([8,7]); ctx.stroke(); ctx.restore();

  const grad = ctx.createRadialGradient(cx-planetR*.35,cy-planetR*.35,planetR*.08,cx,cy,planetR);
  grad.addColorStop(0,m.body.colors[0]); grad.addColorStop(.5,m.body.colors[1]); grad.addColorStop(1,m.body.colors[2]);
  ctx.fillStyle=grad; ctx.shadowColor=m.body.colors[1];ctx.shadowBlur=28;ctx.beginPath();ctx.arc(cx,cy,planetR,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='rgba(255,255,255,.86)';ctx.font='700 13px Inter';ctx.textAlign='center';ctx.fillText(m.body.name,cx,cy+5);

  const angle = Math.PI + Math.PI * easeInOut(progress);
  const x = ellipseCenterX + ellipseA * Math.cos(angle);
  const y = cy + Math.sqrt(rp * ra) * Math.sin(angle);
  ctx.fillStyle='#fff';ctx.shadowColor='#fff';ctx.shadowBlur=18;ctx.beginPath();ctx.arc(x,y,5.5,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
  ctx.fillStyle='#a8b3cc';ctx.font='12px Inter';ctx.textAlign='left';ctx.fillText(progress < .97 ? 'SPACECRAFT' : 'TRANSFER COMPLETE', x+10, y-8);

  burnMarker(cx-rStart,cy,'Δv₁');
  burnMarker(cx+rTarget,cy,'Δv₂');
}

function drawCircle(cx,cy,r,color,alpha){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=1.5;ctx.setLineDash([]);ctx.stroke();ctx.globalAlpha=1;}
function burnMarker(x,y,label){ctx.fillStyle='#ff7a2f';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();ctx.font='700 11px Inter';ctx.fillText(label,x+9,y-8);}
function easeInOut(t){return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function drawCanvasStars(w,h){for(let i=0;i<55;i++){const x=(i*83.71)%w,y=(i*47.33)%h;ctx.fillStyle=`rgba(255,255,255,${.12+(i%5)*.05})`;ctx.fillRect(x,y,i%8===0?1.6:1,i%8===0?1.6:1);}}

function setupStarfield() {
  const starCanvas = $('starfield'); const sctx = starCanvas.getContext('2d');
  const draw = () => { const dpr=Math.min(devicePixelRatio||1,2); starCanvas.width=innerWidth*dpr;starCanvas.height=innerHeight*dpr;sctx.scale(dpr,dpr);sctx.clearRect(0,0,innerWidth,innerHeight);for(let i=0;i<150;i++){const x=(i*179.13)%innerWidth,y=(i*97.71)%innerHeight,r=i%17===0?1.4:.65;sctx.fillStyle=`rgba(255,255,255,${.12+(i%7)*.035})`;sctx.beginPath();sctx.arc(x,y,r,0,Math.PI*2);sctx.fill();}};
  draw(); window.addEventListener('resize', draw);
}

function resetMission() { bodySelect.value='earth';initialAltitude.value='400';targetAltitude.value='35786';$('formError').textContent='';updateBodyInfo();runMission(); }

bodySelect.addEventListener('change',()=>{updateBodyInfo();runMission();});
[initialAltitude,targetAltitude].forEach(el=>el.addEventListener('input',updateMissionType));
$('calculateButton').addEventListener('click',()=>runMission(true));
$('resetButton').addEventListener('click',resetMission);
$('replayButton').addEventListener('click',()=>lastMission&&animateOrbit(lastMission));
$('copyButton').addEventListener('click',copyReport);
$('downloadButton').addEventListener('click',downloadReport);
$('printButton').addEventListener('click',()=>window.print());

document.querySelectorAll('.preset').forEach(button=>button.addEventListener('click',()=>{bodySelect.value=button.dataset.body;initialAltitude.value=button.dataset.start;targetAltitude.value=button.dataset.target;updateBodyInfo();runMission();}));

$('loadChallengeButton').addEventListener('click',()=>{bodySelect.value='earth';initialAltitude.value='400';targetAltitude.value='35786';updateBodyInfo();runMission();$('simulator').scrollIntoView({behavior:'smooth'});});
$('challengeButton').addEventListener('click',()=>{const guess=Number($('challengeGuess').value);if(!Number.isFinite(guess)||guess<=0){$('challengeFeedback').textContent='Enter a positive estimate first.';return;}const correct=calculateTransfer('earth',400,35786).totalDeltaV;const difference=Math.abs(guess-correct);const percent=difference/correct*100;$('challengeFeedback').textContent=`Calculated result: ${formatNumber(correct,3)} km/s. Your estimate differs by ${formatNumber(percent,1)}%. ${percent<5?'Excellent prediction.':percent<15?'Strong estimate.':'Try again after reviewing the equations.'}`;});

window.addEventListener('resize',()=>{clearTimeout(window.__resizeTimer);window.__resizeTimer=setTimeout(resizeCanvasForDisplay,120);});
$('year').textContent=new Date().getFullYear();
setupStarfield();updateBodyInfo();runMission();setTimeout(resizeCanvasForDisplay,50);
