import { TURBO_DURATION, TURBO_COOLDOWN, TRACK_DISTANCE_UNITS } from './config.js';
import { getSpeedMultiplier, TURBO_BOOST_AMOUNT } from './speed.js';
import { setSecondaryActionType, updateJumpUI, updateTimer, updateTurboUI, updateStaminaUI } from './ui.js';
import { characters, updateRunnerAppearance } from './characters.js';
import { DEFAULT_EVENT_ID, EVENT_DASH, EVENT_HURDLES, getRaceEventMeta, normalizeEventId } from './events.js';

const LANE_COUNT = 6;
const PLAYER_LANE_INDEX = 2;
const MAIN_CPU_LANE_INDEX = 3;
const REFERENCE_LANE_INDEX = 0;
const STAGGER_STEP_UNITS = 1.35;
const EXTRA_CPU_RUNNERS = [
  { id: 'cpu-extra-1', laneIndex: 0 },
  { id: 'cpu-extra-2', laneIndex: 1 },
  { id: 'cpu-extra-3', laneIndex: 4 },
  { id: 'cpu-extra-4', laneIndex: 5 }
];

const RUNNER_STAMINA_MIN_SPEED_FACTOR = 0.42;
const TURBO_SECOND_WIND = 0.2;
const SECOND_WIND_DECAY_PER_SECOND = 0.06;
const TAP_BOOST_WINDOW_MS = 500;
const RUN_TAP_STAMINA_COST = 1 / 20;
const TAP_FATIGUE_SCALE = 0.08;
const MAX_EXTRA_FATIGUE = 0.22;
const STEADY_RECOVERY_PER_SECOND = 0.0075;
const RUN_PULSE_DECAY_PER_SECOND = 2.25;
const RUN_PULSE_FLOOR = 0.1;
const AI_TAP_INTERVAL_JITTER_MS = 10;
const AI_STYLE_SEQUENCE = ['steady', 'fast-start', 'strong-finish', 'steady', 'strong-finish'];
const STAMINA_CURVE_POINTS = [
  100, 98, 96, 94, 92, 90, 88, 86, 84, 82,
  80, 78, 76, 74, 72, 70, 68, 66, 64, 62,
  60, 58, 56, 54, 52, 50, 47, 44, 41, 38,
  35, 31, 27, 23, 19, 15, 12, 9, 6, 3, 0
];
const FAST_TURBO_COOLDOWN_MS = 4000;
const SPEED_PERK_ACCEL_MULT = 1.06;
const SPEED_PERK_MAX_MULT = 1.05;
const HURDLE_METERS = [45, 80, 115, 150, 185, 220, 255, 290, 325, 360];
const HURDLE_CLEAR_WINDOW_METERS = 2.8;
const HURDLE_LATE_WINDOW_METERS = 1.2;
const JUMP_DURATION_MS = 560;
const JUMP_VISUAL_HEIGHT = 22;
const HURDLE_HIT_MS = 620;
const HURDLE_HIT_SPEED_FACTOR = 0.56;
const AI_JUMP_LOOKAHEAD_BASE = 1.05;
const AI_JUMP_LOOKAHEAD_SPEED_FACTOR = 0.05;
const AI_JUMP_MISS_CHANCE = 0.09;
const HURDLE_FATIGUE_PENALTY = 0.028;
const HURDLES_FINISH_BASELINE_STAMINA = 0.9;
const HURDLES_MAX_EXTRA_FATIGUE = 0.3;
const HURDLES_RECOVERY_START_METERS = 18;
const HURDLES_RECOVERY_MULT = 4.4;
const HURDLES_RHYTHM_RECOVERY_PER_TAP = 0.0016;

let currentEvent = DEFAULT_EVENT_ID;
let isGameRunning=false; let isGameOver=false; let startTime=0;
let playerPos=0; let playerSpeed=0;
let isTurboReady=true;
let runInputActive=false;
let playerTurboUntil=0;
let playerRacePerk='speed';
let playerTurboCooldownMs=TURBO_COOLDOWN;
let playerJumpUntil=0;
let playerHurdleHitUntil=0;
let playerNextHurdleIndex=0;
let playerFinishTimeMs=null;

let cpuHasStarted=false;
let aiRunners=[];

let bananaUsed=false; let bananaActive=false; let bananaPosition=-1;
let animationFrameId=0;

let playerAccelRate=16; let playerMaxSpeed=11.2; let playerBrakeRate=18;
let playerStamina=1;
let playerExtraFatigue=0; let playerSecondWindBoost=0;
let playerRunBoostUntil=0; let lastRunTapAt=0; let playerTapCadence=0;
let playerTapCadenceDecay=RUN_PULSE_DECAY_PER_SECOND;
let playerTapBonusSpeed=0; let playerCoastSpeed=1.35;
let cpuAccelRate=14; let cpuCruiseSpeed=8.9; let cpuMaxSpeed=10.6;
let turboPeakBonus=3.4;
let playerTurboCooldownIntervalId=0;

let lastTime=0; let accumulator=0; const STEP=1/60;

let cameraX=0; let cameraY=0;
const RUNNER_HALF_SIZE=32;

const trackGeom = {
  worldWidth: 2200,
  worldHeight: 1300,
  centerX: 1100,
  centerY: 650,
  cameraFollowEnabled: false
};

function getLapUnits(){ return TRACK_DISTANCE_UNITS; }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }
function moveTowards(current, target, maxDelta){
  if(current < target){ return Math.min(current + maxDelta, target); }
  return Math.max(current - maxDelta, target);
}
function resetTimerDisplay(){
  const timer = document.getElementById('timer');
  if(timer){ timer.textContent = '00:00:000'; }
}
function clearPlayerTurboCooldownInterval(){
  if(playerTurboCooldownIntervalId){
    clearInterval(playerTurboCooldownIntervalId);
    playerTurboCooldownIntervalId = 0;
  }
}

export function setPlayerRacePerk(perk){
  playerRacePerk = (perk === 'turbo') ? 'turbo' : 'speed';
  playerTurboCooldownMs = playerRacePerk === 'turbo' ? FAST_TURBO_COOLDOWN_MS : TURBO_COOLDOWN;
}

export function setRaceEvent(eventId){
  currentEvent = normalizeEventId(eventId);
  const meta = getRaceEventMeta(currentEvent);
  setSecondaryActionType(meta.secondaryActionType);
}

export function getCurrentEvent(){
  return currentEvent;
}

export function isRaceActive(){
  return isGameRunning && !isGameOver;
}

function isHurdlesEvent(){
  return currentEvent === EVENT_HURDLES;
}

function configureRaceTuning(){
  const mult = clamp(getSpeedMultiplier(), 0.9, 1.15);
  playerAccelRate = 17.2 * mult;
  playerMaxSpeed = 10.4 * mult;
  playerBrakeRate = 19.2 * mult;
  playerTapCadenceDecay = RUN_PULSE_DECAY_PER_SECOND;
  playerTapBonusSpeed = 0;
  playerCoastSpeed = 1.35 * mult;

  if(currentEvent === EVENT_DASH && playerRacePerk === 'speed'){
    playerAccelRate *= SPEED_PERK_ACCEL_MULT;
    playerMaxSpeed *= SPEED_PERK_MAX_MULT;
  }
  playerTurboCooldownMs = (currentEvent === EVENT_DASH && playerRacePerk === 'turbo') ? FAST_TURBO_COOLDOWN_MS : TURBO_COOLDOWN;

  cpuAccelRate = 17.2 * mult;
  cpuCruiseSpeed = 1.35 * mult;
  cpuMaxSpeed = 10.4 * mult;

  turboPeakBonus = clamp(TURBO_BOOST_AMOUNT * 0.095 * mult, 2.8, 4.8);
}

function randomRange(min, max){
  return min + Math.random() * (max - min);
}

function createAiRunnerState(id, laneIndex){
  return {
    id,
    laneIndex,
    pos: 0,
    speed: 0,
    turboReady: true,
    turboLastUsed: 0,
    turboUntil: 0,
    slipped: false,
    slipEndTime: 0,
    startOffset: 0,
    stamina: 1,
    extraFatigue: 0,
    secondWindBoost: 0,
    runBoostUntil: 0,
    lastTapAt: 0,
    tapCadence: 0,
    nextTapAt: 0,
    jumpUntil: 0,
    hurdleHitUntil: 0,
    nextHurdleIndex: 0,
    jumpAttemptedForHurdle: -1,
    finishTimeMs: null,
    style: 'steady',
    styleVariance: 0
  };
}

function assignAiProfiles(){
  const styleOffset = Math.floor(Math.random() * AI_STYLE_SEQUENCE.length);
  for(const ai of aiRunners){
    ai.stamina = 1;
    ai.extraFatigue = 0;
    ai.secondWindBoost = 0;
    ai.speed = 0;
    ai.runBoostUntil = 0;
    ai.lastTapAt = 0;
    ai.tapCadence = 0;
    ai.nextTapAt = 0;
    ai.style = AI_STYLE_SEQUENCE[(styleOffset + ai.laneIndex) % AI_STYLE_SEQUENCE.length];
    ai.styleVariance = randomRange(-0.03, 0.03);
    ai.turboReady = true;
    ai.turboUntil = 0;
    ai.turboLastUsed = 0;
    ai.jumpUntil = 0;
    ai.hurdleHitUntil = 0;
    ai.nextHurdleIndex = 0;
    ai.jumpAttemptedForHurdle = -1;
    ai.finishTimeMs = null;
  }
}

function getTrackNodes(){
  const area = document.getElementById('track-area');
  const world = document.getElementById('track-world');
  const oval = document.getElementById('track-oval');
  const divider = document.getElementById('lane-divider');
  const infield = document.getElementById('infield');
  const finish = document.getElementById('finish-line');
  const hurdleLayer = document.getElementById('hurdle-layer');
  return { area, world, oval, divider, infield, finish, hurdleLayer };
}

function ensureExtraRunners(){
  const world = document.getElementById('track-world');
  if(!world) return;

  for(const cfg of EXTRA_CPU_RUNNERS){
    if(!document.getElementById(cfg.id)){
      const el = document.createElement('div');
      el.id = cfg.id;
      el.className = 'runner ai-runner absolute';
      el.style.width = '64px';
      el.style.height = '64px';
      world.appendChild(el);
    }
  }
}

function ensureLaneDividers(){
  const divider = document.getElementById('lane-divider');
  if(!divider) return [];
  if(!Array.isArray(trackGeom.dividerEls) || trackGeom.dividerEls.length !== LANE_COUNT - 1){
    divider.innerHTML = '';
    trackGeom.dividerEls = [];
    trackGeom.startMarkerEls = [];
    for(let i=0;i<LANE_COUNT-1;i++){
      const el = document.createElement('div');
      el.className = 'lane-divider-line';
      divider.appendChild(el);
      trackGeom.dividerEls.push(el);
    }
    for(let i=0;i<LANE_COUNT;i++){
      const marker = document.createElement('div');
      marker.className = 'lane-start-line';
      marker.style.position = 'absolute';
      marker.style.width = '5px';
      marker.style.borderRadius = '3px';
      marker.style.border = '1px solid rgba(17,17,17,0.7)';
      marker.style.backgroundImage = 'repeating-linear-gradient(0deg, #fff, #fff 4px, #111 4px, #111 8px)';
      marker.style.transformOrigin = '50% 50%';
      marker.style.zIndex = '15';
      divider.appendChild(marker);
      trackGeom.startMarkerEls.push(marker);
    }
  }
  return trackGeom.dividerEls;
}

function laneRaceSpanUnits(laneIndex){
  return Math.max(1, getLapUnits() - getStartOffsetUnits(laneIndex));
}

function laneUnitsFromMeters(meters, laneIndex){
  return (clamp(meters, 0, 400) / 400) * laneRaceSpanUnits(laneIndex);
}

function laneProgressUnitsFromMeters(meters, laneIndex){
  return getStartOffsetUnits(laneIndex) + laneUnitsFromMeters(meters, laneIndex);
}

function ensureHurdleEls(){
  const { hurdleLayer } = getTrackNodes();
  if(!hurdleLayer) return [];

  if(currentEvent !== EVENT_HURDLES){
    hurdleLayer.innerHTML = '';
    trackGeom.hurdleEls = [];
    return [];
  }

  const total = LANE_COUNT * HURDLE_METERS.length;
  if(!Array.isArray(trackGeom.hurdleEls) || trackGeom.hurdleEls.length !== total){
    hurdleLayer.innerHTML = '';
    trackGeom.hurdleEls = [];
    for(let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex++){
      for(let hurdleIndex = 0; hurdleIndex < HURDLE_METERS.length; hurdleIndex++){
        const el = document.createElement('div');
        el.className = 'track-hurdle';
        const leftStand = document.createElement('span');
        leftStand.className = 'hurdle-stand hurdle-stand-left';
        const rightStand = document.createElement('span');
        rightStand.className = 'hurdle-stand hurdle-stand-right';
        const bar = document.createElement('span');
        bar.className = 'hurdle-bar';
        el.appendChild(leftStand);
        el.appendChild(rightStand);
        el.appendChild(bar);
        hurdleLayer.appendChild(el);
        trackGeom.hurdleEls.push(el);
      }
    }
  }

  return trackGeom.hurdleEls;
}

function renderHurdles(){
  const { hurdleLayer } = getTrackNodes();
  if(!hurdleLayer) return;

  if(currentEvent !== EVENT_HURDLES){
    hurdleLayer.innerHTML = '';
    trackGeom.hurdleEls = [];
    return;
  }

  const hurdleEls = ensureHurdleEls();
  const laneWidth = trackGeom.laneWidth || 44;
  let idx = 0;
  for(let laneIndex = 0; laneIndex < LANE_COUNT; laneIndex++){
    for(const hurdleMeters of HURDLE_METERS){
      const el = hurdleEls[idx++];
      if(!el) continue;
      const point = getPointOnTrack(laneProgressUnitsFromMeters(hurdleMeters, laneIndex), laneIndex);
      const angle = (Math.atan2(point.dy, point.dx) * 180 / Math.PI) + 90;
      const hurdleWidth = Math.max(28, Math.round(laneWidth * 0.78));
      const hurdleHeight = Math.max(18, Math.round(laneWidth * 0.5));
      el.style.left = `${Math.round(point.x)}px`;
      el.style.top = `${Math.round(point.y)}px`;
      el.style.width = `${hurdleWidth}px`;
      el.style.height = `${hurdleHeight}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${Math.round(angle)}deg)`;
    }
  }
}

function randomCharacterKey(){
  const keys = Object.keys(characters).filter(k => k !== 'mystery');
  return keys[Math.floor(Math.random() * keys.length)] || 'blue-racer';
}

function randomizeExtraRacerLooks(){
  const used = new Set();
  const playerEl = document.getElementById('player');
  const cpuEl = document.getElementById('computer');
  if(playerEl && playerEl.dataset.characterKey){ used.add(playerEl.dataset.characterKey); }
  if(cpuEl && cpuEl.dataset.characterKey){ used.add(cpuEl.dataset.characterKey); }

  const pool = Object.keys(characters).filter(k => k !== 'mystery' && !used.has(k));
  let idx = 0;
  for(const cfg of EXTRA_CPU_RUNNERS){
    const el = document.getElementById(cfg.id);
    if(!el) continue;
    const key = pool[idx] || Object.keys(characters).find(k => k !== 'mystery' && !used.has(k)) || randomCharacterKey();
    idx++;
    used.add(key);
    updateRunnerAppearance(el, key);
  }
}

function computeTrackGeometry(){
  const { area, world, oval, infield, finish } = getTrackNodes();
  if(!area || !world || !oval || !infield || !finish) return;

  const viewportW = Math.max(320, area.clientWidth || 1000);
  const viewportH = Math.max(240, area.clientHeight || 420);
  const ratioStraightToRadius = 84.39 / 36.5;
  const laneWidth = Math.max(44, Math.round(Math.min(viewportW, viewportH) * 0.07));
  const innerRadius = Math.max(120, Math.round(viewportH * 0.30));
  const outerRadius = innerRadius + laneWidth * LANE_COUNT;
  const straightLen = Math.max(240, Math.round(innerRadius * ratioStraightToRadius));

  const trackOuterW = straightLen + outerRadius * 2;
  const trackOuterH = outerRadius * 2;
  const worldPadX = Math.max(80, Math.round(viewportW * 0.18));
  const crowdBandHeight = Math.max(74, Math.min(132, Math.round(viewportH * 0.22)));
  const crowdGap = Math.max(10, Math.round(viewportH * 0.03));
  const worldPadBottom = Math.max(52, Math.round(viewportH * 0.12));

  trackGeom.worldWidth = Math.max(Math.round(viewportW * 1.55), trackOuterW + worldPadX * 2);
  trackGeom.worldHeight = Math.max(Math.round(viewportH * 1.45), crowdBandHeight + crowdGap + trackOuterH + worldPadBottom);
  trackGeom.centerX = Math.round(trackGeom.worldWidth * 0.5);
  trackGeom.centerY = Math.round(crowdBandHeight + crowdGap + outerRadius);
  trackGeom.laneWidth = laneWidth;
  trackGeom.innerRadius = innerRadius;
  trackGeom.outerRadius = outerRadius;
  trackGeom.straightLen = straightLen;
  trackGeom.leftTurnCx = Math.round(trackGeom.centerX - straightLen * 0.5);
  trackGeom.rightTurnCx = Math.round(trackGeom.centerX + straightLen * 0.5);

  world.style.width = `${trackGeom.worldWidth}px`;
  world.style.height = `${trackGeom.worldHeight}px`;

  const crowdArea = document.getElementById('crowd-area');
  if(crowdArea){
    crowdArea.style.left = '0px';
    crowdArea.style.top = '0px';
    crowdArea.style.height = `${crowdBandHeight}px`;
  }

  const outerLeft = trackGeom.leftTurnCx - outerRadius;
  const outerTop = trackGeom.centerY - outerRadius;
  oval.style.left = `${outerLeft}px`;
  oval.style.top = `${outerTop}px`;
  oval.style.width = `${trackOuterW}px`;
  oval.style.height = `${trackOuterH}px`;
  oval.style.borderRadius = `${Math.round(outerRadius)}px`;

  const innerLeft = trackGeom.leftTurnCx - innerRadius;
  const innerTop = trackGeom.centerY - innerRadius;
  const innerW = straightLen + innerRadius * 2;
  const innerH = innerRadius * 2;
  infield.style.left = `${innerLeft}px`;
  infield.style.top = `${innerTop}px`;
  infield.style.width = `${innerW}px`;
  infield.style.height = `${innerH}px`;
  infield.style.borderRadius = `${Math.round(innerRadius)}px`;

  const topOuterY = trackGeom.centerY - outerRadius;
  const topInnerY = trackGeom.centerY - innerRadius;
  finish.style.left = `${trackGeom.centerX}px`;
  finish.style.top = `${Math.round(topOuterY)}px`;
  finish.style.height = `${Math.max(24, Math.round(topInnerY - topOuterY))}px`;

  const dividerEls = ensureLaneDividers();
  for(let i=1;i<LANE_COUNT;i++){
    const r = innerRadius + laneWidth * i;
    const el = dividerEls[i-1];
    if(!el) continue;
    const l = trackGeom.leftTurnCx - r;
    const t = trackGeom.centerY - r;
    const w = straightLen + r * 2;
    const h = r * 2;
    el.style.left = `${Math.round(l)}px`;
    el.style.top = `${Math.round(t)}px`;
    el.style.width = `${Math.round(w)}px`;
    el.style.height = `${Math.round(h)}px`;
    el.style.borderRadius = `${Math.round(r)}px`;
  }

  if(Array.isArray(trackGeom.startMarkerEls)){
    for(let i=0;i<LANE_COUNT;i++){
      const marker = trackGeom.startMarkerEls[i];
      if(!marker) continue;
      const startUnits = getStartOffsetUnits(i);
      const point = getPointOnTrack(startUnits, i);
      const angle = (Math.atan2(point.dy, point.dx) * 180 / Math.PI) + 90;
      marker.style.left = `${Math.round(point.x)}px`;
      marker.style.top = `${Math.round(point.y)}px`;
      marker.style.height = `${Math.max(24, Math.round(laneWidth - 8))}px`;
      marker.style.transform = `translate(-50%, -50%) rotate(${Math.round(angle)}deg)`;
    }
  }

  renderHurdles();
}

function laneMetrics(laneIndex){
  const i = clamp(laneIndex, 0, LANE_COUNT - 1);
  const r = (trackGeom.innerRadius || 100) + (trackGeom.laneWidth || 18) * (i + 0.5);
  const straight = trackGeom.straightLen || 300;
  const halfStraight = straight * 0.5;
  const laneLength = straight * 2 + Math.PI * r * 2;
  return { r, straight, halfStraight, laneLength };
}

function getStartOffsetUnits(laneIndex){
  const laneDelta = clamp(laneIndex - REFERENCE_LANE_INDEX, 0, LANE_COUNT - 1);
  return laneDelta * STAGGER_STEP_UNITS;
}

function getPointOnTrack(units, laneIndex){
  const m = laneMetrics(laneIndex);
  const leftCx = trackGeom.leftTurnCx || (trackGeom.centerX - m.halfStraight);
  const rightCx = trackGeom.rightTurnCx || (trackGeom.centerX + m.halfStraight);
  const cy = trackGeom.centerY;

  const progress = clamp(units / getLapUnits(), 0, 1);
  let s = progress * m.laneLength;

  const segTopHalf = m.halfStraight;
  const segRightArc = Math.PI * m.r;
  const segBottom = m.straight;
  const segLeftArc = Math.PI * m.r;

  if(s <= segTopHalf){
    return { x: trackGeom.centerX + s, y: cy - m.r, dx: 1, dy: 0, segment: 'home-straight' };
  }
  s -= segTopHalf;

  if(s <= segRightArc){
    const a = -Math.PI / 2 + s / m.r;
    const x = rightCx + m.r * Math.cos(a);
    const y = cy + m.r * Math.sin(a);
    const dx = -Math.sin(a);
    const dy = Math.cos(a);
    return { x, y, dx, dy, segment: 'right-bend' };
  }
  s -= segRightArc;

  if(s <= segBottom){
    return { x: rightCx - s, y: cy + m.r, dx: -1, dy: 0, segment: 'backstretch' };
  }
  s -= segBottom;

  if(s <= segLeftArc){
    const a = Math.PI / 2 + s / m.r;
    const x = leftCx + m.r * Math.cos(a);
    const y = cy + m.r * Math.sin(a);
    const dx = -Math.sin(a);
    const dy = Math.cos(a);
    return { x, y, dx, dy, segment: 'left-bend' };
  }
  s -= segLeftArc;

  return { x: leftCx + s, y: cy - m.r, dx: 1, dy: 0, segment: 'home-straight' };
}

function getJumpArcOffset(nowMs, jumpUntil){
  if(nowMs >= jumpUntil){ return 0; }
  const progress = 1 - ((jumpUntil - nowMs) / JUMP_DURATION_MS);
  return -Math.sin(clamp(progress, 0, 1) * Math.PI) * JUMP_VISUAL_HEIGHT;
}

function placeRunner(el, units, laneIndex, verticalOffset=0){
  if(!el) return;
  const p = getPointOnTrack(units, laneIndex);
  const x = Math.round(p.x - RUNNER_HALF_SIZE);
  const y = Math.round(p.y - RUNNER_HALF_SIZE + verticalOffset);
  el.style.setProperty('--runner-flip', p.dx >= 0 ? '1' : '-1');
  const heading = (Math.atan2(p.dy, p.dx) * 180) / Math.PI;
  el.style.setProperty('--shadow-rot', `${Math.round(heading * 0.35)}deg`);
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function updateCamera(){
  const { area, world } = getTrackNodes();
  if(!area || !world) return;

  const viewportW = area.clientWidth || 1;
  const viewportH = area.clientHeight || 1;

  const playerPoint = getPointOnTrack(playerPos, PLAYER_LANE_INDEX);

  const targetX = clamp(playerPoint.x - viewportW * 0.5, 0, Math.max(0, trackGeom.worldWidth - viewportW));
  const targetY = clamp(playerPoint.y - viewportH * 0.5, 0, Math.max(0, trackGeom.worldHeight - viewportH));

  if(playerPos > getStartOffsetUnits(PLAYER_LANE_INDEX) + 1.6){
    trackGeom.cameraFollowEnabled = true;
  }

  if(!trackGeom.cameraFollowEnabled){
    cameraX = targetX;
    cameraY = targetY;
  } else {
    cameraX += (targetX - cameraX) * 0.11;
    cameraY += (targetY - cameraY) * 0.11;
  }

  world.style.transform = `translate(${-Math.round(cameraX)}px, ${-Math.round(cameraY)}px)`;
}

function getTurboBonus(nowMs, turboUntil){
  if(nowMs >= turboUntil) return 0;
  const remaining = (turboUntil - nowMs) / TURBO_DURATION;
  return turboPeakBonus * clamp(remaining, 0, 1);
}

function updateRunnerAnimationState(nowMs){
  const playerEl=document.getElementById('player');
  const playerMoving=(playerSpeed + getTurboBonus(nowMs, playerTurboUntil)) > 0.7;
  if(playerEl){
    playerEl.classList.toggle('running', playerMoving);
    playerEl.classList.toggle('jumping', nowMs < playerJumpUntil);
    playerEl.classList.toggle('hurdle-hit', nowMs < playerHurdleHitUntil);
  }

  for(const ai of aiRunners){
    const el = document.getElementById(ai.id);
    if(!el) continue;
    const moving = cpuHasStarted && (ai.speed + getTurboBonus(nowMs, ai.turboUntil)) > 0.7;
    el.classList.toggle('running', moving);
    el.classList.toggle('jumping', nowMs < ai.jumpUntil);
    el.classList.toggle('hurdle-hit', nowMs < ai.hurdleHitUntil);
  }
}

function renderScene(nowMs){
  const playerEl=document.getElementById('player');
  placeRunner(playerEl, playerPos, PLAYER_LANE_INDEX, getJumpArcOffset(nowMs, playerJumpUntil));
  for(const ai of aiRunners){
    const el = document.getElementById(ai.id);
    placeRunner(el, ai.pos, ai.laneIndex, getJumpArcOffset(nowMs, ai.jumpUntil));
  }
  updateRunnerAnimationState(nowMs);
  updateCamera();
}

function registerFinishTimes(nowMs){
  if(!startTime || startTime <= 0){ return; }
  const elapsedMs = Math.max(0, Math.floor(nowMs - startTime));
  const lapUnits = getLapUnits();

  if(playerFinishTimeMs == null && playerPos >= lapUnits){
    playerFinishTimeMs = elapsedMs;
  }

  for(const ai of aiRunners){
    if(ai.finishTimeMs == null && ai.pos >= lapUnits){
      ai.finishTimeMs = elapsedMs;
    }
  }
}

function removeBananaPeel(){ const banana=document.getElementById('banana-peel'); if(banana&&banana.parentNode) banana.parentNode.removeChild(banana); }

function placeBananaPeel(){
  const banana=document.getElementById('banana-peel');
  if(!banana) return;
  const p = getPointOnTrack(bananaPosition, MAIN_CPU_LANE_INDEX);
  banana.style.left = `${Math.round(p.x)}px`;
  banana.style.top = `${Math.round(p.y)}px`;
  banana.style.transform = 'translate(-50%, -50%) rotate(-35deg)';
}

function createBananaPeel(){
  const trackWorld=document.getElementById('track-world');
  if(!trackWorld) return;
  const banana=document.createElement('div');
  banana.id='banana-peel';
  banana.className='absolute text-2xl z-20';
  banana.textContent='\u{1F34C}';
  trackWorld.appendChild(banana);
  placeBananaPeel();
}

function resetWorldView(){
  cameraX = 0;
  cameraY = 0;
  trackGeom.cameraFollowEnabled = false;
  computeTrackGeometry();
  renderScene(performance.now());
}

function resetAiStates(){
  aiRunners = [
    createAiRunnerState('computer', MAIN_CPU_LANE_INDEX),
    ...EXTRA_CPU_RUNNERS.map(cfg => createAiRunnerState(cfg.id, cfg.laneIndex))
  ];
  assignAiProfiles();
}

function applyStaggeredStarts(){
  playerPos = getStartOffsetUnits(PLAYER_LANE_INDEX);
  playerStamina = 1;
  playerExtraFatigue = 0;
  playerSecondWindBoost = 0;
  playerRunBoostUntil = 0;
  lastRunTapAt = 0;
  playerTapCadence = 0;
  playerJumpUntil = 0;
  playerHurdleHitUntil = 0;
  playerNextHurdleIndex = 0;
  playerFinishTimeMs = null;
  for(const ai of aiRunners){
    ai.startOffset = getStartOffsetUnits(ai.laneIndex);
    ai.pos = ai.startOffset;
    ai.speed = 0;
    ai.turboReady = true;
    ai.turboLastUsed = 0;
    ai.turboUntil = 0;
    ai.slipped = false;
    ai.slipEndTime = 0;
    ai.stamina = 1;
    ai.extraFatigue = 0;
    ai.secondWindBoost = 0;
    ai.runBoostUntil = 0;
    ai.lastTapAt = 0;
    ai.tapCadence = 0;
    ai.nextTapAt = 0;
    ai.jumpUntil = 0;
    ai.hurdleHitUntil = 0;
    ai.nextHurdleIndex = 0;
    ai.jumpAttemptedForHurdle = -1;
    ai.finishTimeMs = null;
  }
}

function getRunnerMeta(id){
  const el = document.getElementById(id);
  const characterKey = (el && el.dataset.characterKey) || 'blue-racer';
  const characterName = (characters[characterKey] && characters[characterKey].name) || 'Racer';
  if(id === 'player'){
    return { id, name: 'You', characterKey, isPlayer: true };
  }
  if(id === 'computer'){
    return { id, name: characterName, characterKey, isPlayer: false };
  }
  return { id, name: characterName, characterKey, isPlayer: false };
}

function compareStandingsEntries(a, b){
  const aFinished = Number.isFinite(a.finishTimeMs);
  const bFinished = Number.isFinite(b.finishTimeMs);
  if(aFinished && bFinished){
    if(a.finishTimeMs !== b.finishTimeMs){
      return a.finishTimeMs - b.finishTimeMs;
    }
    return b.pos - a.pos;
  }
  if(aFinished !== bFinished){
    return aFinished ? -1 : 1;
  }
  return b.pos - a.pos;
}

function buildStandings(){
  const standings = [{
    id: 'player',
    laneIndex: PLAYER_LANE_INDEX,
    pos: playerPos,
    finishTimeMs: playerFinishTimeMs
  }].concat(aiRunners.map(ai => ({
    id: ai.id,
    laneIndex: ai.laneIndex,
    pos: ai.pos,
    finishTimeMs: ai.finishTimeMs
  })));
  standings.sort(compareStandingsEntries);
  return standings.map((entry, index) => ({
    place: index + 1,
    pos: entry.pos,
    laneIndex: entry.laneIndex,
    finishTimeMs: entry.finishTimeMs,
    ...getRunnerMeta(entry.id)
  }));
}

function resetRunnerVisualStates(){
  const playerEl = document.getElementById('player');
  if(playerEl){
    playerEl.classList.remove('turbo-effect');
    playerEl.classList.remove('jumping');
    playerEl.classList.remove('hurdle-hit');
  }
  for(const ai of aiRunners){
    const el = document.getElementById(ai.id);
    if(!el) continue;
    el.classList.remove('turbo-effect');
    el.classList.remove('slipped');
    el.classList.remove('jumping');
    el.classList.remove('hurdle-hit');
  }
}

export function initializeTrackView(){
  setRaceEvent(currentEvent);
  ensureExtraRunners();
  resetAiStates();
  randomizeExtraRacerLooks();
  clearPlayerTurboCooldownInterval();
  bananaUsed = false;
  bananaActive = false;
  bananaPosition = -1;
  removeBananaPeel();
  applyStaggeredStarts();
  resetRunnerVisualStates();
  resetTimerDisplay();
  updateStaminaUI(playerStamina);
  if(isHurdlesEvent()){
    updateJumpUI('ready');
  } else {
    updateTurboUI(true, 0);
  }
  resetWorldView();
}

export function startGame(){
  configureRaceTuning();
  ensureExtraRunners();
  resetAiStates();
  randomizeExtraRacerLooks();
  clearPlayerTurboCooldownInterval();

  isGameOver=false;
  isGameRunning=true;
  playerSpeed=0;
  playerStamina=1;
  playerExtraFatigue=0;
  playerSecondWindBoost=0;
  isTurboReady=true;
  runInputActive=false;
  playerTurboUntil=0;
  playerRunBoostUntil=0;
  lastRunTapAt=0;
  playerTapCadence=0;
  playerJumpUntil=0;
  playerHurdleHitUntil=0;
  playerNextHurdleIndex=0;
  cpuHasStarted=false;

  startTime=0;
  bananaUsed=false;
  bananaActive=false;
  bananaPosition=-1;
  lastTime=performance.now();
  accumulator=0;
  removeBananaPeel();
  if(isHurdlesEvent()){
    updateJumpUI('ready');
  } else {
    updateTurboUI(true,0);
  }
  updateStaminaUI(playerStamina);

  applyStaggeredStarts();

  resetRunnerVisualStates();

  resetWorldView();

  if(animationFrameId){ cancelAnimationFrame(animationFrameId); }
  animationFrameId=requestAnimationFrame(gameLoop);
}

function gameLoop(){
  if(!isGameRunning||isGameOver) return;
  const now=performance.now();
  const delta=Math.min((now-lastTime)/1000,0.25);
  accumulator+=delta;
  lastTime=now;

  while(accumulator>=STEP){
    step(STEP, now);
    accumulator-=STEP;
  }

  updateTimer(startTime);
  updateStaminaUI(playerStamina);
  if(isHurdlesEvent()){
    const playerActionState = now < playerHurdleHitUntil ? 'hit' : (now < playerJumpUntil ? 'air' : 'ready');
    updateJumpUI(playerActionState);
  }
  renderScene(now);

  if(playerFinishTimeMs != null){
    const standings = buildStandings();
    const winner = standings[0]?.isPlayer ? 'player' : 'cpu';
    endGame(winner, true);
    return;
  }

  animationFrameId=requestAnimationFrame(gameLoop);
}

function maybeTriggerAiTurbo(ai, nowMs){
  if(isHurdlesEvent()) return;
  if(ai.slipped) return;
  if(!ai.turboReady) return;
  const meters = metersFromUnits(ai.pos);
  if(ai.stamina > 0.32 && meters < 250) return;
  if(nowMs - ai.turboLastUsed <= TURBO_COOLDOWN) return;
  ai.turboReady=false;
  ai.turboLastUsed=nowMs;
  ai.turboUntil=nowMs + TURBO_DURATION;
  ai.secondWindBoost = clamp(ai.secondWindBoost + TURBO_SECOND_WIND, 0, 1);
  const el=document.getElementById(ai.id);
  if(el) el.classList.add('turbo-effect');
  setTimeout(()=>{ const e=document.getElementById(ai.id); if(e) e.classList.remove('turbo-effect'); }, TURBO_DURATION);
  setTimeout(()=>{ ai.turboReady=true; }, TURBO_COOLDOWN);
}

function lerp(a, b, t){
  return a + (b - a) * clamp(t, 0, 1);
}

function metersFromUnits(units){
  return clamp(units / getLapUnits(), 0, 1) * 400;
}

function metersFromLaneProgress(units, laneIndex){
  const startOffset = getStartOffsetUnits(laneIndex);
  const span = laneRaceSpanUnits(laneIndex);
  return clamp((units - startOffset) / span, 0, 1) * 400;
}

function hurdleWindowUnits(meters, laneIndex){
  return laneUnitsFromMeters(meters, laneIndex);
}

function getNextHurdleUnits(laneIndex, hurdleIndex){
  if(hurdleIndex < 0 || hurdleIndex >= HURDLE_METERS.length){ return null; }
  return laneProgressUnitsFromMeters(HURDLE_METERS[hurdleIndex], laneIndex);
}

function markHurdleHit(runnerId){
  const el = document.getElementById(runnerId);
  if(el){ el.classList.add('hurdle-hit'); }
}

function activatePlayerJump(nowMs){
  if(nowMs < playerJumpUntil) return;
  playerJumpUntil = nowMs + JUMP_DURATION_MS;
  updateJumpUI('air');
}

function activateAiJump(ai, nowMs){
  if(nowMs < ai.jumpUntil) return;
  ai.jumpUntil = nowMs + JUMP_DURATION_MS;
}

function handlePlayerHurdles(nowMs){
  if(!isHurdlesEvent()) return;
  const hurdleUnits = getNextHurdleUnits(PLAYER_LANE_INDEX, playerNextHurdleIndex);
  if(hurdleUnits == null) return;

  const earlyWindow = hurdleWindowUnits(HURDLE_CLEAR_WINDOW_METERS, PLAYER_LANE_INDEX);
  const lateWindow = hurdleWindowUnits(HURDLE_LATE_WINDOW_METERS, PLAYER_LANE_INDEX);
  if(playerPos < hurdleUnits - earlyWindow){ return; }

  if(playerPos <= hurdleUnits + lateWindow && nowMs < playerJumpUntil){
    playerNextHurdleIndex++;
    return;
  }

  playerHurdleHitUntil = nowMs + HURDLE_HIT_MS;
  playerSpeed *= HURDLE_HIT_SPEED_FACTOR;
  playerExtraFatigue = clamp(playerExtraFatigue + HURDLE_FATIGUE_PENALTY, 0, 1);
  playerNextHurdleIndex++;
  markHurdleHit('player');
  updateJumpUI('hit');
}

function maybeHandleAiJump(ai, nowMs){
  if(!isHurdlesEvent()) return;
  const hurdleUnits = getNextHurdleUnits(ai.laneIndex, ai.nextHurdleIndex);
  if(hurdleUnits == null) return;
  if(ai.jumpAttemptedForHurdle === ai.nextHurdleIndex){ return; }

  const distanceToHurdle = hurdleUnits - ai.pos;
  const lookAhead = clamp(AI_JUMP_LOOKAHEAD_BASE + ai.speed * AI_JUMP_LOOKAHEAD_SPEED_FACTOR, 0.9, 1.65);
  if(distanceToHurdle > lookAhead){ return; }

  ai.jumpAttemptedForHurdle = ai.nextHurdleIndex;
  if(Math.random() > AI_JUMP_MISS_CHANCE){
    activateAiJump(ai, nowMs);
  }
}

function handleAiHurdles(ai, nowMs){
  if(!isHurdlesEvent()) return;
  const hurdleUnits = getNextHurdleUnits(ai.laneIndex, ai.nextHurdleIndex);
  if(hurdleUnits == null) return;

  const earlyWindow = hurdleWindowUnits(HURDLE_CLEAR_WINDOW_METERS, ai.laneIndex);
  const lateWindow = hurdleWindowUnits(HURDLE_LATE_WINDOW_METERS, ai.laneIndex);
  if(ai.pos < hurdleUnits - earlyWindow){ return; }

  if(ai.pos <= hurdleUnits + lateWindow && nowMs < ai.jumpUntil){
    ai.nextHurdleIndex++;
    ai.jumpAttemptedForHurdle = -1;
    return;
  }

  ai.hurdleHitUntil = nowMs + HURDLE_HIT_MS;
  ai.speed *= HURDLE_HIT_SPEED_FACTOR;
  ai.extraFatigue = clamp(ai.extraFatigue + HURDLE_FATIGUE_PENALTY, 0, 1);
  ai.nextHurdleIndex++;
  ai.jumpAttemptedForHurdle = -1;
  markHurdleHit(ai.id);
}

function getBaselineStaminaFromMeters(meters){
  const clamped = clamp(meters, 0, 400);
  const baseIndex = Math.floor(clamped / 10);
  const nextIndex = Math.min(STAMINA_CURVE_POINTS.length - 1, baseIndex + 1);
  const frac = (clamped - baseIndex * 10) / 10;
  const stamina = lerp(STAMINA_CURVE_POINTS[baseIndex], STAMINA_CURVE_POINTS[nextIndex], frac);
  return stamina / 100;
}

function getRaceSpeedFactorFromMeters(meters){
  if(meters <= 50){ return lerp(0.24, 0.99, meters / 50); }
  if(meters <= 80){ return lerp(0.99, 1.0, (meters - 50) / 30); }
  if(meters <= 200){ return lerp(0.98, 0.92, (meters - 80) / 120); }
  if(meters <= 300){ return lerp(0.92, 0.82, (meters - 200) / 100); }
  return lerp(0.82, 0.56, (meters - 300) / 100);
}

function getAiCadenceTargetFromMeters(meters){
  if(meters <= 50){ return lerp(0.8, 0.96, meters / 50); }
  if(meters <= 80){ return 0.95; }
  if(meters <= 200){ return lerp(0.9, 0.8, (meters - 80) / 120); }
  if(meters <= 300){ return lerp(0.8, 0.68, (meters - 200) / 100); }
  return lerp(0.68, 0.58, (meters - 300) / 100);
}

function getAiCadenceByStyle(style, meters){
  const phaseCadence = getAiCadenceTargetFromMeters(meters);
  if(style === 'fast-start'){
    if(meters <= 120){ return clamp(phaseCadence + 0.08, 0, 1); }
    if(meters <= 280){ return clamp(phaseCadence - 0.07, 0, 1); }
    return clamp(phaseCadence - 0.02, 0, 1);
  }
  if(style === 'strong-finish'){
    if(meters <= 140){ return clamp(phaseCadence - 0.08, 0, 1); }
    if(meters <= 280){ return clamp(phaseCadence - 0.02, 0, 1); }
    return clamp(phaseCadence + 0.09, 0, 1);
  }
  return phaseCadence;
}

function getStaminaSpeedFactor(stamina){
  return RUNNER_STAMINA_MIN_SPEED_FACTOR + (1 - RUNNER_STAMINA_MIN_SPEED_FACTOR) * clamp(stamina, 0, 1);
}

function getFatigueCapByMeters(meters){
  if(isHurdlesEvent()){
    const progress = clamp(meters / 400, 0, 1);
    return lerp(0.04, HURDLES_MAX_EXTRA_FATIGUE, Math.pow(progress, 0.86));
  }
  const progress = clamp(meters / 400, 0, 1);
  return lerp(0.02, MAX_EXTRA_FATIGUE, Math.pow(progress, 0.92));
}

function getRhythmFit(cadence){
  const cadenceCenter = isHurdlesEvent() ? 0.66 : 0.6;
  const cadenceHalfWidth = isHurdlesEvent() ? 0.18 : 0.2;
  return clamp(1 - Math.abs(cadence - cadenceCenter) / cadenceHalfWidth, 0, 1);
}

function getTapFatigueGain(cadence){
  const baseGain = RUN_TAP_STAMINA_COST * TAP_FATIGUE_SCALE * (0.7 + cadence * 0.6);
  if(!isHurdlesEvent()){ return baseGain; }
  const rhythmFit = getRhythmFit(cadence);
  return baseGain * lerp(1.05, 0.4, rhythmFit);
}

function getTapRecoveryBonus(cadence){
  if(!isHurdlesEvent()){ return 0; }
  return HURDLES_RHYTHM_RECOVERY_PER_TAP * getRhythmFit(cadence);
}

function applySteadyPaceRecovery(extraFatigue, currentSpeed, phaseTarget, cadence, meters, dt){
  const recoveryStartMeters = isHurdlesEvent() ? HURDLES_RECOVERY_START_METERS : 70;
  if(meters < recoveryStartMeters || phaseTarget <= 0){ return extraFatigue; }

  const paceRatio = clamp(currentSpeed / phaseTarget, 0, 1.2);
  const paceCenter = isHurdlesEvent() ? 0.84 : 0.8;
  const paceHalfWidth = isHurdlesEvent() ? 0.24 : 0.16;
  const paceFit = clamp(1 - Math.abs(paceRatio - paceCenter) / paceHalfWidth, 0, 1);

  const cadenceFit = getRhythmFit(cadence);

  const lastCornerFactor = isHurdlesEvent() ? 1 : (meters < 280 ? 1 : lerp(1, 1.35, (meters - 280) / 120));
  const recoveryMult = isHurdlesEvent() ? HURDLES_RECOVERY_MULT : 1;
  const recovery = STEADY_RECOVERY_PER_SECOND * recoveryMult * paceFit * cadenceFit * lastCornerFactor * dt;
  return clamp(extraFatigue - recovery, 0, 1);
}

function computeEffectiveStamina(meters, extraFatigue, secondWindBoost){
  const base = isHurdlesEvent()
    ? lerp(1, HURDLES_FINISH_BASELINE_STAMINA, clamp(meters / 400, 0, 1))
    : getBaselineStaminaFromMeters(meters);
  const fatigueCap = getFatigueCapByMeters(meters);
  const fatigue = clamp(extraFatigue, 0, fatigueCap);
  return clamp(base - fatigue + clamp(secondWindBoost, 0, 1), 0, 1);
}

function getTapCadenceFromInterval(intervalMs){
  const minInterval = 105;
  const maxInterval = 440;
  if(!Number.isFinite(intervalMs)){ return 0; }
  return 1 - clamp((intervalMs - minInterval) / (maxInterval - minInterval), 0, 1);
}

function registerRunTap(nowMs){
  const interval = lastRunTapAt > 0 ? (nowMs - lastRunTapAt) : Number.NaN;
  const cadenceFromTap = lastRunTapAt > 0 ? getTapCadenceFromInterval(interval) : 0.42;
  playerTapCadence = clamp((playerTapCadence * 0.45) + (cadenceFromTap * 0.95) + 0.22, RUN_PULSE_FLOOR, 1);
  lastRunTapAt = nowMs;
  playerRunBoostUntil = Math.max(playerRunBoostUntil, nowMs + TAP_BOOST_WINDOW_MS);

  const meters = metersFromUnits(playerPos);
  playerStamina = computeEffectiveStamina(meters, playerExtraFatigue, playerSecondWindBoost);
  const staminaLimitedMax = playerMaxSpeed * getStaminaSpeedFactor(playerStamina);
  const tapImpulse = (playerAccelRate * (0.38 + playerTapCadence * 0.85)) * STEP * 2.0;
  playerSpeed = clamp(playerSpeed + tapImpulse, 0, staminaLimitedMax);

  const playerFatigueGain = getTapFatigueGain(playerTapCadence);
  const playerRecoveryBonus = getTapRecoveryBonus(playerTapCadence);
  playerExtraFatigue = clamp(playerExtraFatigue + playerFatigueGain - playerRecoveryBonus, 0, 1);
  playerStamina = computeEffectiveStamina(meters, playerExtraFatigue, playerSecondWindBoost);
}

function registerAiRunTap(ai, nowMs){
  const interval = ai.lastTapAt > 0 ? (nowMs - ai.lastTapAt) : Number.NaN;
  const cadenceFromTap = ai.lastTapAt > 0 ? getTapCadenceFromInterval(interval) : 0.42;
  ai.tapCadence = clamp((ai.tapCadence * 0.45) + (cadenceFromTap * 0.95) + 0.22, RUN_PULSE_FLOOR, 1);
  ai.lastTapAt = nowMs;
  ai.runBoostUntil = Math.max(ai.runBoostUntil, nowMs + TAP_BOOST_WINDOW_MS);

  const meters = metersFromUnits(ai.pos);
  ai.stamina = computeEffectiveStamina(meters, ai.extraFatigue, ai.secondWindBoost);
  const staminaLimitedMax = cpuMaxSpeed * getStaminaSpeedFactor(ai.stamina);
  const tapImpulse = (cpuAccelRate * (0.38 + ai.tapCadence * 0.85)) * STEP * 2.0;
  ai.speed = clamp(ai.speed + tapImpulse, 0, staminaLimitedMax);

  const aiFatigueGain = getTapFatigueGain(ai.tapCadence);
  const aiRecoveryBonus = getTapRecoveryBonus(ai.tapCadence);
  ai.extraFatigue = clamp(ai.extraFatigue + aiFatigueGain - aiRecoveryBonus, 0, 1);
  ai.stamina = computeEffectiveStamina(meters, ai.extraFatigue, ai.secondWindBoost);
}

function scheduleAiNextTap(ai, nowMs){
  const meters = metersFromUnits(ai.pos);
  const cadenceTarget = clamp(getAiCadenceByStyle(ai.style, meters) + ai.styleVariance, 0.42, 0.99);
  const baseInterval = lerp(345, 118, cadenceTarget);
  const jitter = randomRange(-AI_TAP_INTERVAL_JITTER_MS, AI_TAP_INTERVAL_JITTER_MS);
  ai.nextTapAt = nowMs + clamp(baseInterval + jitter, 115, 340);
}

function step(dt, nowMs){
  const playerMeters = metersFromUnits(playerPos);
  playerSecondWindBoost = clamp(playerSecondWindBoost - SECOND_WIND_DECAY_PER_SECOND * dt, 0, 1);
  playerStamina = computeEffectiveStamina(playerMeters, playerExtraFatigue, playerSecondWindBoost);

  const playerBoostActive = nowMs < playerRunBoostUntil;
  const playerPhaseTarget = playerMaxSpeed * getRaceSpeedFactorFromMeters(playerMeters);
  if(playerBoostActive){
    const cadenceIntensity = clamp(0.34 + playerTapCadence * 0.66, 0, 1);
    const targetSpeed = lerp(playerCoastSpeed, playerPhaseTarget, cadenceIntensity);
    const accel = playerAccelRate * (0.72 + playerTapCadence * 0.76);
    playerSpeed = moveTowards(playerSpeed, targetSpeed, accel * dt);
  } else {
    playerTapCadence = clamp(playerTapCadence - playerTapCadenceDecay * dt, RUN_PULSE_FLOOR, 1);
    if(startTime > 0){
      const coastTarget = Math.min(playerCoastSpeed, playerPhaseTarget * 0.35) * (0.82 + 0.18 * getStaminaSpeedFactor(playerStamina));
      playerSpeed = moveTowards(playerSpeed, coastTarget, (playerBrakeRate * 1.15) * dt);
    } else {
      playerSpeed = 0;
    }
  }

  playerExtraFatigue = applySteadyPaceRecovery(playerExtraFatigue, playerSpeed, playerPhaseTarget, playerTapCadence, playerMeters, dt);
  playerStamina = computeEffectiveStamina(playerMeters, playerExtraFatigue, playerSecondWindBoost);
  const playerSpeedCap = playerMaxSpeed * getStaminaSpeedFactor(playerStamina);
  playerSpeed = clamp(playerSpeed, 0, playerSpeedCap);
  if(nowMs < playerHurdleHitUntil){ playerSpeed *= HURDLE_HIT_SPEED_FACTOR; }

  const lapUnits = getLapUnits();
  const playerTurboBonus = isHurdlesEvent() ? 0 : getTurboBonus(nowMs, playerTurboUntil);
  playerPos = clamp(playerPos + (playerSpeed + playerTurboBonus) * dt, 0, lapUnits);
  handlePlayerHurdles(nowMs);

  if(cpuHasStarted){
    for(const ai of aiRunners){
      ai.secondWindBoost = clamp(ai.secondWindBoost - SECOND_WIND_DECAY_PER_SECOND * dt, 0, 1);
      const aiMeters = metersFromUnits(ai.pos);
      ai.stamina = computeEffectiveStamina(aiMeters, ai.extraFatigue, ai.secondWindBoost);

      if(ai.nextTapAt <= 0){ scheduleAiNextTap(ai, nowMs); }
      if(nowMs >= ai.nextTapAt){
        registerAiRunTap(ai, nowMs);
        scheduleAiNextTap(ai, nowMs);
      }
      maybeHandleAiJump(ai, nowMs);

      const aiBoostActive = nowMs < ai.runBoostUntil;
      const aiPhaseTarget = cpuMaxSpeed * getRaceSpeedFactorFromMeters(aiMeters);
      if(aiBoostActive){
        const cadenceIntensity = clamp(0.34 + ai.tapCadence * 0.66, 0, 1);
        const targetSpeed = lerp(playerCoastSpeed, aiPhaseTarget, cadenceIntensity);
        const accel = cpuAccelRate * (0.72 + ai.tapCadence * 0.76);
        ai.speed = moveTowards(ai.speed, targetSpeed, accel * dt);
      } else {
        ai.tapCadence = clamp(ai.tapCadence - playerTapCadenceDecay * dt, RUN_PULSE_FLOOR, 1);
        const coastTarget = Math.min(playerCoastSpeed, aiPhaseTarget * 0.35) * (0.82 + 0.18 * getStaminaSpeedFactor(ai.stamina));
        ai.speed = moveTowards(ai.speed, coastTarget, (playerBrakeRate * 1.15) * dt);
      }

      if(ai.slipped){ ai.speed *= 0.55; }
      ai.extraFatigue = applySteadyPaceRecovery(ai.extraFatigue, ai.speed, aiPhaseTarget, ai.tapCadence, aiMeters, dt);
      ai.stamina = computeEffectiveStamina(aiMeters, ai.extraFatigue, ai.secondWindBoost);
      const aiSpeedCap = cpuMaxSpeed * getStaminaSpeedFactor(ai.stamina);
      ai.speed = clamp(ai.speed, 0, aiSpeedCap);
      if(nowMs < ai.hurdleHitUntil){ ai.speed *= HURDLE_HIT_SPEED_FACTOR; }

      const turboBonus = isHurdlesEvent() ? 0 : getTurboBonus(nowMs, ai.turboUntil);
      ai.pos = clamp(ai.pos + (ai.speed + turboBonus) * dt, 0, lapUnits);
      handleAiHurdles(ai, nowMs);

      maybeTriggerAiTurbo(ai, nowMs);

      if(ai.slipped && nowMs > ai.slipEndTime){
        ai.slipped = false;
        const el=document.getElementById(ai.id);
        if(el) el.classList.remove('slipped');
      }
    }
  }

  if(cpuHasStarted && bananaActive && currentEvent === EVENT_DASH){
    const hitter = aiRunners.find(ai => Math.abs(ai.pos - bananaPosition) <= 2.2 && !ai.slipped);
    if(hitter){
      hitter.slipped = true;
      hitter.slipEndTime = nowMs + 850;
      const el=document.getElementById(hitter.id);
      if(el) el.classList.add('slipped');
      bananaActive = false;
      removeBananaPeel();
    }
  }

  registerFinishTimes(nowMs);
}

export function endGame(winner, playerFinished){
  isGameRunning=false;
  isGameOver=true;
  runInputActive=false;
  playerRunBoostUntil=0;
  clearPlayerTurboCooldownInterval();
  if(animationFrameId){ cancelAnimationFrame(animationFrameId); animationFrameId=0; }
  const ms=(playerFinishTimeMs != null)
    ? playerFinishTimeMs
    : Math.max(0, Math.floor(performance.now()-startTime));
  const standings = buildStandings();
  const ev=new CustomEvent('raceFinished', {
    detail:{
      timeMs: ms,
      winner,
      playerFinished,
      standings
    }
  });
  document.dispatchEvent(ev);
}

export function cancelRace(){
  isGameRunning = false;
  isGameOver = false;
  cpuHasStarted = false;
  runInputActive = false;
  startTime = 0;
  playerSpeed = 0;
  playerTurboUntil = 0;
  playerRunBoostUntil = 0;
  playerJumpUntil = 0;
  playerHurdleHitUntil = 0;
  playerNextHurdleIndex = 0;
  isTurboReady = true;
  clearPlayerTurboCooldownInterval();
  if(animationFrameId){ cancelAnimationFrame(animationFrameId); animationFrameId = 0; }
  initializeTrackView();
}

function startComputerIfNeeded(){
  if(!cpuHasStarted){
    cpuHasStarted=true;
    const now = performance.now();
    for(const ai of aiRunners){
      ai.nextTapAt = now + randomRange(70, 150);
    }
  }
}

function startTimerIfNeeded(){ if(!startTime||startTime<=0){ startTime=performance.now(); } }

export function onRunPress(){
  if(isGameOver) return;
  if(!isGameRunning){
    if(window.gameReady===true){ startGame(); }
    else { return; }
  }
  startTimerIfNeeded();
  startComputerIfNeeded();
  runInputActive=true;
  registerRunTap(performance.now());
}

export function onRunRelease(){ runInputActive=false; }

export function activateTurbo(){
  if(isHurdlesEvent()) return;
  if(isGameOver) return;
  if(!isGameRunning){
    if(window.gameReady===true){ startGame(); }
    else { return; }
  }
  startTimerIfNeeded();
  startComputerIfNeeded();
  if(bananaUsed||!isTurboReady) return;
  isTurboReady=false;

  const playerEl=document.getElementById('player');
  if(playerEl) playerEl.classList.add('turbo-effect');
  playerTurboUntil = performance.now() + TURBO_DURATION;
  playerSecondWindBoost = clamp(playerSecondWindBoost + TURBO_SECOND_WIND, 0, 1);
  updateTurboUI(false, Math.floor(playerTurboCooldownMs/1000));

  setTimeout(()=>{ const el=document.getElementById('player'); if(el) el.classList.remove('turbo-effect'); }, TURBO_DURATION);

  let cooldownTime=playerTurboCooldownMs/1000;
  clearPlayerTurboCooldownInterval();
  playerTurboCooldownIntervalId=setInterval(()=>{
    cooldownTime--;
    updateTurboUI(false, Math.max(0,cooldownTime));
    if(cooldownTime<=0){
      clearPlayerTurboCooldownInterval();
      isTurboReady=true;
      updateTurboUI(true,0);
    }
  },1000);
}

export function activateJump(){
  if(!isHurdlesEvent()) return;
  if(isGameOver) return;
  if(!isGameRunning){
    if(window.gameReady===true){ startGame(); }
    else { return; }
  }
  startTimerIfNeeded();
  startComputerIfNeeded();
  activatePlayerJump(performance.now());
}

export function triggerSecondaryAction(){
  if(isHurdlesEvent()){
    activateJump();
    return;
  }
  activateTurbo();
}

export function throwBananaPeel(){
  if(currentEvent !== EVENT_DASH) return;
  if(bananaUsed||isGameOver||!isGameRunning) return;
  bananaUsed=true;
  bananaActive=true;
  bananaPosition=clamp(playerPos+4, 0, getLapUnits());
  createBananaPeel();
  updateTurboUI(isTurboReady, Math.floor(playerTurboCooldownMs/1000));
}

window.addEventListener('resize', ()=>{
  computeTrackGeometry();
  renderScene(performance.now());
  if(bananaActive){ placeBananaPeel(); }
});












































