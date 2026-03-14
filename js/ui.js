let secondaryActionType = 'turbo';

function getSecondaryActionElements(){
  return {
    wrap: document.getElementById('secondary-action-wrap'),
    label: document.getElementById('secondary-action-label'),
    status: document.getElementById('turbo-status')
  };
}

function setStatusVisibility(visible){
  const { wrap } = getSecondaryActionElements();
  if(!wrap) return;
  wrap.classList.toggle('is-hidden', !visible);
}

function setActionLabel(text){
  const { label } = getSecondaryActionElements();
  if(!label) return;
  label.textContent = text;
}

export function formatTime(ms){
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const cs = Math.floor(ms % 1000);
  const mm = (m < 10 ? '0' : '') + m;
  const ss = (s < 10 ? '0' : '') + s;
  const ccs = (cs < 100 ? (cs < 10 ? '00' : '0') : '') + cs;
  return `${mm}:${ss}:${ccs}`;
}

function setStatusState(text, addClass, removeClasses){
  const { status: el } = getSecondaryActionElements();
  if(!el) return;
  el.textContent = text;
  for(const className of removeClasses){
    el.classList.remove(className);
  }
  el.classList.add(addClass);
}

export function updateTimer(start){
  const el = document.getElementById('timer');
  if(!el) return;
  if(!start || start <= 0){ return; }
  const now = performance.now();
  const diff = now - start;
  el.textContent = formatTime(diff);
}

export function updateRaceGap(deltaMs){
  const el = document.getElementById('race-gap');
  if(!el) return;
  if(!Number.isFinite(deltaMs) || Math.abs(deltaMs) < 10){
    el.textContent = '';
    el.classList.add('hidden');
    el.classList.remove('text-red-400', 'text-green-400');
    return;
  }

  const sign = deltaMs > 0 ? '+' : '-';
  const absSeconds = Math.abs(deltaMs) / 1000;
  el.textContent = `${sign}${absSeconds.toFixed(absSeconds >= 10 ? 1 : 2)}s`;
  el.classList.remove('hidden', 'text-red-400', 'text-green-400');
  el.classList.add(deltaMs > 0 ? 'text-red-400' : 'text-green-400');
}

export function clearRaceGap(){
  updateRaceGap(Number.NaN);
}

export function setSecondaryActionType(type){
  secondaryActionType = type === 'jump' ? 'jump' : 'turbo';

  const button = document.getElementById('btn-turbo');
  setActionLabel(secondaryActionType === 'jump' ? 'Jump' : 'Sprint');

  if(button){
    button.textContent = secondaryActionType === 'jump' ? 'Jump' : 'Sprint';
    button.classList.toggle('bg-green-500', secondaryActionType === 'turbo');
    button.classList.toggle('bg-amber-500', secondaryActionType === 'jump');
  }

  if(secondaryActionType === 'jump'){
    updateJumpUI('ready');
  } else {
    updateTurboUI(true, 0);
  }
}

export function updateTurboUI(isReady, cooldownSec){
  if(secondaryActionType !== 'turbo'){ return; }
  setActionLabel('Sprint');
  setStatusVisibility(true);
  if(isReady){
    setStatusState('READY', 'text-green-400', ['text-yellow-400', 'text-red-400']);
  } else {
    setStatusState(`CD: ${cooldownSec}s`, 'text-yellow-400', ['text-green-400', 'text-red-400']);
  }
}

export function updateJumpUI(state='ready'){
  if(secondaryActionType !== 'jump'){ return; }
  if(state === 'air'){
    setActionLabel('Jump');
    setStatusVisibility(true);
    setStatusState('CLEARED', 'text-green-400', ['text-yellow-400', 'text-red-400']);
    return;
  }
  if(state === 'hit'){
    setActionLabel('Hurdle');
    setStatusVisibility(true);
    setStatusState('HIT', 'text-red-400', ['text-green-400', 'text-yellow-400']);
    return;
  }
  setActionLabel('');
  setStatusState('', 'text-green-400', ['text-yellow-400', 'text-red-400']);
  setStatusVisibility(false);
}

export function updateStaminaUI(value){
  const fill = document.getElementById('stamina-fill');
  const label = document.getElementById('stamina-value');
  const bar = document.getElementById('stamina-bar');
  if(!fill) return;
  const normalized = Math.max(0, Math.min(1, Number(value) || 0));
  const pct = Math.round(normalized * 100);
  fill.style.width = `${pct}%`;
  if(label){ label.textContent = `${pct}%`; }
  if(bar){ bar.setAttribute('aria-valuenow', String(pct)); }
  fill.classList.remove('stamina-high', 'stamina-mid', 'stamina-low');
  if(normalized > 0.6){
    fill.classList.add('stamina-high');
  } else if(normalized > 0.3){
    fill.classList.add('stamina-mid');
  } else {
    fill.classList.add('stamina-low');
  }
}
