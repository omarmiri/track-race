let secondaryActionType = 'turbo';

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
  const el = document.getElementById('turbo-status');
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

export function setSecondaryActionType(type){
  secondaryActionType = type === 'jump' ? 'jump' : 'turbo';

  const label = document.getElementById('secondary-action-label');
  const button = document.getElementById('btn-turbo');

  if(label){
    label.textContent = secondaryActionType === 'jump' ? 'Jump' : 'Turbo';
  }

  if(button){
    button.textContent = secondaryActionType === 'jump' ? 'Jump' : 'Turbo';
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
  if(isReady){
    setStatusState('READY', 'text-green-400', ['text-yellow-400', 'text-red-400']);
  } else {
    setStatusState(`CD: ${cooldownSec}s`, 'text-yellow-400', ['text-green-400', 'text-red-400']);
  }
}

export function updateJumpUI(state='ready'){
  if(secondaryActionType !== 'jump'){ return; }
  if(state === 'air'){
    setStatusState('AIR', 'text-yellow-400', ['text-green-400', 'text-red-400']);
    return;
  }
  if(state === 'hit'){
    setStatusState('HIT', 'text-red-400', ['text-green-400', 'text-yellow-400']);
    return;
  }
  setStatusState('READY', 'text-green-400', ['text-yellow-400', 'text-red-400']);
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
