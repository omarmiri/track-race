import { DEFAULT_EVENT_ID, getRaceEventMeta, normalizeEventId } from './events.js';

let globalScores = [];
let personalScores = [];
let modalShowingGlobal = true;
let lastStatus = { offline: false, error: false };
let resultsShowingGlobal = false;
let currentScoreEvent = DEFAULT_EVENT_ID;
let supabaseClient = null;
const VISITOR_ID_STORAGE_KEY = 'track-race:visitor-id';

function hasSupabase(){
  return typeof window.supabase !== 'undefined' &&
    typeof window.SUPABASE_URL === 'string' &&
    typeof window.SUPABASE_ANON_KEY === 'string';
}

function createClient(){
  if(!hasSupabase()) return null;
  if(supabaseClient){ return supabaseClient; }
  try{
    supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return supabaseClient;
  }catch(e){
    supabaseClient = null;
    return null;
  }
}

function readStoredVisitorId(){
  try{
    return localStorage.getItem(VISITOR_ID_STORAGE_KEY) || '';
  }catch(e){
    return '';
  }
}

function writeStoredVisitorId(visitorId){
  if(!visitorId) return;
  try{
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
  }catch(e){}
}

function generateVisitorId(){
  if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
    return `trackrace_${crypto.randomUUID()}`;
  }

  if(typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'){
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes, (byte)=>byte.toString(16).padStart(2, '0')).join('');
    return `trackrace_${hex}`;
  }

  return `trackrace_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

function getNativeVisitorId(){
  try{
    if(window.AndroidBridge && typeof window.AndroidBridge.getVisitorId === 'function'){
      return window.AndroidBridge.getVisitorId() || '';
    }
  }catch(e){}
  return '';
}

function visitor(){
  if(window.visitorId){
    return window.visitorId;
  }

  const nativeVisitorId = getNativeVisitorId();
  if(nativeVisitorId){
    window.visitorId = nativeVisitorId;
    return nativeVisitorId;
  }

  const storedVisitorId = readStoredVisitorId();
  if(storedVisitorId){
    window.visitorId = storedVisitorId;
    return storedVisitorId;
  }

  const generatedVisitorId = generateVisitorId();
  window.visitorId = generatedVisitorId;
  writeStoredVisitorId(generatedVisitorId);
  return generatedVisitorId;
}

export function ensureVisitorId(){
  return visitor();
}

function getScoreMeta(eventId=currentScoreEvent){
  return getRaceEventMeta(eventId);
}

export function setScoreEvent(eventId){
  currentScoreEvent = normalizeEventId(eventId);
}

export async function initializeHighScores(){
  if(!visitor()) return;
  try{
    const c = createClient();
    if(!c) return;
    const { error } = await c.from('visitors').select('visitor_id').eq('visitor_id', visitor()).single();
    if(error && error.code === 'PGRST116'){
      await c.from('visitors').insert([{ visitor_id: visitor(), created_at: new Date().toISOString() }]);
    }
  }catch(e){}
}

export async function saveHighScore(ms, eventId=currentScoreEvent){
  if(ms <= 0) return;
  const meta = getScoreMeta(eventId);
  const us = Math.round(ms * 1000);
  const c = createClient();
  if(c && visitor()){
    try{
      await c.from('high_scores').insert([{
        visitor_id: visitor(),
        game_name: meta.scoreGameName,
        score: us,
        created_at: new Date().toISOString()
      }]);
    }catch(e){}
  }

  const raw = JSON.parse(localStorage.getItem(meta.localScoreKey) || '[]');
  const normalized = raw
    .map((record)=>({
      timeUs: (typeof record.timeUs === 'number'
        ? record.timeUs
        : (typeof record.timeMs === 'number' ? Math.round(record.timeMs * 1000) : 0)),
      createdAt: record.createdAt || Date.now()
    }))
    .filter((record)=>record.timeUs > 0);

  normalized.push({ timeUs: us, createdAt: Date.now() });
  normalized.sort((a, b)=>a.timeUs - b.timeUs);
  localStorage.setItem(meta.localScoreKey, JSON.stringify(normalized.slice(0, 50)));
}

async function loadAll(eventId=currentScoreEvent){
  const meta = getScoreMeta(eventId);
  const c = createClient();
  if(!c || !visitor()){
    lastStatus.offline = true;
    lastStatus.error = false;
    personalScores = [];
    globalScores = [];
    return;
  }

  try{
    const { data: personalData } = await c
      .from('high_scores')
      .select('score, created_at')
      .eq('visitor_id', visitor())
      .eq('game_name', meta.scoreGameName)
      .order('score', { ascending: true })
      .limit(10);

    const { data: globalData } = await c
      .from('high_scores')
      .select('score, created_at')
      .eq('game_name', meta.scoreGameName)
      .order('score', { ascending: true })
      .limit(10);

    personalScores = (personalData || []).map((record)=>({
      score: normalizeToUs(record.score),
      created_at: record.created_at
    }));
    globalScores = (globalData || []).map((record)=>({
      score: normalizeToUs(record.score),
      created_at: record.created_at
    }));
    lastStatus.offline = false;
    lastStatus.error = false;
  }catch(e){
    lastStatus.error = true;
    lastStatus.offline = false;
    personalScores = [];
    globalScores = [];
  }
}

function normalizeToUs(value){
  const n = Number(value) || 0;
  if(n <= 0) return 0;
  if(n < 1000) return n * 10000;
  if(n < 10000) return n * 1000;
  return n;
}

function scoreToSeconds(value){
  return normalizeToUs(value) / 1000000;
}

function getLocalPersonalScores(eventId=currentScoreEvent){
  const meta = getScoreMeta(eventId);
  const raw = JSON.parse(localStorage.getItem(meta.localScoreKey) || '[]');
  const normalized = raw
    .map((record)=>({
      score: (typeof record.timeUs === 'number'
        ? record.timeUs
        : (typeof record.timeMs === 'number' ? Math.round(record.timeMs * 1000) : 0))
    }))
    .filter((record)=>record.score > 0);

  normalized.sort((a, b)=>a.score - b.score);
  return normalized.slice(0, 10);
}

function renderModalHighScores(scores, eventId=currentScoreEvent){
  const meta = getScoreMeta(eventId);
  const container = document.getElementById('modal-scores-content');
  if(!container) return;

  const banner = document.createElement('div');
  const showOffline = lastStatus.offline;
  const showError = lastStatus.error;
  if(showOffline || showError){
    banner.className = showOffline
      ? 'mb-2 px-3 py-2 rounded bg-yellow-100 text-yellow-700 text-xs'
      : 'mb-2 px-3 py-2 rounded bg-red-100 text-red-700 text-xs';
    banner.textContent = showOffline
      ? (modalShowingGlobal ? 'Global scores unavailable offline' : 'Offline mode: showing local scores')
      : 'Scores temporarily unavailable';
  }

  const table = document.createElement('table');
  table.className = 'scores-table w-full rounded-lg overflow-hidden border-2 border-gray-300';
  table.innerHTML = `<thead><tr><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Rank</th><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Score</th></tr></thead><tbody>${(scores || []).map((score, index)=>{
    const time = scoreToSeconds(score.score).toFixed(2);
    const rankClass = index < 3 ? 'text-yellow-600 font-bold bg-yellow-50' : '';
    return `<tr class="odd:bg-gray-50 even:bg-white ${rankClass}"><td class="px-3 py-2 text-center border-b">${index + 1}</td><td class="px-3 py-2 text-center border-b">${time}s</td></tr>`;
  }).join('')}</tbody>`;

  container.innerHTML = '';
  if(showOffline || showError){
    container.appendChild(banner);
  }
  if(!scores || !scores.length){
    const empty = document.createElement('div');
    empty.className = 'text-center text-gray-500 italic py-4';
    empty.textContent = `No ${meta.shortName.toLowerCase()} times yet!`;
    container.appendChild(empty);
    return;
  }
  container.appendChild(table);
}

export async function showHighScoresModal(eventId=currentScoreEvent){
  setScoreEvent(eventId);
  const meta = getScoreMeta();
  const modal = document.getElementById('highscores-modal');
  if(!modal) return;
  modal.classList.remove('hidden');
  await loadAll();

  let scores = [];
  if(lastStatus.offline){
    scores = modalShowingGlobal ? [] : getLocalPersonalScores();
  } else {
    scores = modalShowingGlobal ? globalScores : personalScores;
  }

  renderModalHighScores(scores);

  const title = document.getElementById('modal-scores-title');
  const toggle = document.getElementById('modal-toggle-scores');
  if(modalShowingGlobal){
    if(title) title.textContent = `${meta.name} Global Best Times`;
    if(toggle){
      toggle.textContent = 'My Best Times';
      toggle.className = 'px-3 py-1 text-xs sm:text-sm font-bold rounded-full bg-blue-500 text-white';
    }
  } else {
    if(title) title.textContent = `${meta.name} My Best Times`;
    if(toggle){
      toggle.textContent = 'Global Best Times';
      toggle.className = 'px-3 py-1 text-xs sm:text-sm font-bold rounded-full bg-blue-600 text-white shadow';
    }
  }
}

export function closeHighScoresModal(){
  const modal = document.getElementById('highscores-modal');
  if(modal) modal.classList.add('hidden');
}

export function toggleModalScoreView(){
  modalShowingGlobal = !modalShowingGlobal;
  showHighScoresModal();
}

export async function loadPanelScores(type, eventId=currentScoreEvent){
  setScoreEvent(eventId);
  const c = createClient();
  if(type === 'personal'){
    if(!c || !visitor()){
      return getLocalPersonalScores();
    }
    await loadAll();
    return personalScores;
  }
  await loadAll();
  return globalScores;
}

export async function loadHighScores(type, eventId=currentScoreEvent){
  return loadPanelScores(type, eventId);
}

export function renderHighScores(scores){
  const container = document.getElementById('scores-list');
  if(!container) return;
  if(!scores || !scores.length){
    container.innerHTML = '<div class="text-center text-gray-500 italic py-2">No scores yet</div>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'scores-table w-full rounded-lg overflow-hidden border-2 border-gray-300';
  table.innerHTML = `<thead><tr><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Rank</th><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Score</th></tr></thead><tbody>${scores.map((score, index)=>{
    const time = scoreToSeconds(score.score).toFixed(2);
    const rankClass = index < 3 ? 'text-yellow-600 font-bold bg-yellow-50' : '';
    return `<tr class="odd:bg-gray-50 even:bg-white ${rankClass}"><td class="px-3 py-2 text-center border-b">${index + 1}</td><td class="px-3 py-2 text-center border-b">${time}s</td></tr>`;
  }).join('')}</tbody>`;
  container.innerHTML = '';
  container.appendChild(table);
}

export function renderScoresInto(containerId, scores){
  const container = document.getElementById(containerId);
  if(!container) return;
  if(!scores || !scores.length){
    container.innerHTML = '<div class="text-center text-gray-500 italic py-2">No scores yet</div>';
    return;
  }
  const heading = document.createElement('div');
  heading.className = 'text-center text-[#2f3b58] font-bold mb-2';
  heading.textContent = 'Best Times';
  const table = document.createElement('table');
  table.className = 'scores-table w-full rounded-lg overflow-hidden border-2 border-gray-300';
  table.innerHTML = `<thead><tr><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Rank</th><th class="px-3 py-2 bg-blue-500 text-white font-bold text-sm">Score</th></tr></thead><tbody>${scores.map((score, index)=>{
    const time = scoreToSeconds(score.score).toFixed(2);
    const rankClass = index < 3 ? 'text-yellow-600 font-bold bg-yellow-50' : '';
    return `<tr class="odd:bg-gray-50 even:bg-white ${rankClass}"><td class="px-3 py-2 text-center border-b">${index + 1}</td><td class="px-3 py-2 text-center border-b">${time}s</td></tr>`;
  }).join('')}</tbody>`;
  container.innerHTML = '';
  container.appendChild(heading);
  container.appendChild(table);
}

export async function renderResultsBestTimes(eventId=currentScoreEvent){
  setScoreEvent(eventId);
  const meta = getScoreMeta();
  const container = document.getElementById('results-best-scores');
  if(!container) return;

  let scores = [];
  let bannerText = '';
  let bannerClass = 'mb-2 px-2 py-2 rounded bg-yellow-100 text-yellow-700 text-[10px]';
  const c = createClient();
  const vis = visitor();

  if(!c || !vis){
    if(!resultsShowingGlobal){
      scores = getLocalPersonalScores();
      bannerText = 'Offline: local times';
    } else {
      scores = [];
      bannerText = 'Global unavailable offline';
    }
  } else {
    await loadAll();
    scores = resultsShowingGlobal ? globalScores : personalScores;
    if(lastStatus.error){
      bannerText = 'Scores temporarily unavailable';
      bannerClass = 'mb-2 px-2 py-2 rounded bg-red-100 text-red-700 text-[10px]';
    }
  }

  scores = (scores || []).slice(0, 3);
  const scopeLabel = resultsShowingGlobal ? 'Global' : 'Personal';
  const header = document.createElement('div');
  header.className = 'flex items-center justify-between mb-2 gap-2';
  const left = document.createElement('div');
  left.className = 'text-[#2f3b58] font-bold text-xs sm:text-sm';
  left.textContent = `${meta.shortName} Best Times`;
  const button = document.createElement('button');
  button.id = 'results-toggle-scores';
  button.className = 'px-2 py-1 text-[10px] sm:text-xs font-bold rounded bg-blue-600 text-white';
  button.textContent = scopeLabel;
  button.addEventListener('click', ()=>{
    toggleResultsScoreView();
  });

  const banner = bannerText ? document.createElement('div') : null;
  if(banner){
    banner.className = bannerClass;
    banner.textContent = bannerText;
  }

  const table = document.createElement('table');
  table.className = 'w-full text-xs sm:text-sm border-separate border-spacing-0';
  table.innerHTML = `<thead><tr><th class="text-left text-[#2f3b58] pb-1 font-bold">Rank</th><th class="text-right text-[#2f3b58] pb-1 font-bold">Time</th></tr></thead><tbody>${scores.map((score, index)=>{
    const time = scoreToSeconds(score.score).toFixed(2);
    return `<tr><td class="py-1.5 border-t border-slate-200 text-[#2f3b58]">${index + 1}</td><td class="py-1.5 border-t border-slate-200 text-right text-[#2f3b58] font-bold">${time}s</td></tr>`;
  }).join('')}</tbody>`;

  container.innerHTML = '';
  header.appendChild(left);
  header.appendChild(button);
  container.appendChild(header);
  if(banner){
    container.appendChild(banner);
  }
  if(!scores.length){
    const empty = document.createElement('div');
    empty.className = 'text-center text-gray-500 italic py-2 text-xs';
    empty.textContent = `No ${meta.shortName.toLowerCase()} times yet`;
    container.appendChild(empty);
    return;
  }
  container.appendChild(table);
}

export function toggleResultsScoreView(){
  resultsShowingGlobal = !resultsShowingGlobal;
  renderResultsBestTimes();
}
