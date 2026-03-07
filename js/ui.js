export function formatTime(ms){ const m=Math.floor(ms/60000); const s=Math.floor((ms%60000)/1000); const cs=Math.floor(ms%1000); const mm=(m<10?'0':'')+m; const ss=(s<10?'0':'')+s; const ccs=(cs<100?(cs<10?'00':'0'):'')+cs; return `${mm}:${ss}:${ccs}`; }
export function updateTimer(start){ const el=document.getElementById('timer'); if(!el) return; if(!start||start<=0){ return; } const now=performance.now(); const diff=now-start; el.textContent=formatTime(diff); }
export function updateTurboUI(isReady, cooldownSec){ const el=document.getElementById('turbo-status'); if(!el) return; if(isReady){ el.textContent='READY'; el.classList.remove('text-yellow-400'); el.classList.add('text-green-400'); } else { el.textContent=`CD: ${cooldownSec}s`; el.classList.remove('text-green-400'); el.classList.add('text-yellow-400'); } }
export function updateStaminaUI(value){
  const fill=document.getElementById('stamina-fill');
  const label=document.getElementById('stamina-value');
  const bar=document.getElementById('stamina-bar');
  if(!fill) return;
  const normalized=Math.max(0, Math.min(1, Number(value) || 0));
  const pct=Math.round(normalized * 100);
  fill.style.width=`${pct}%`;
  if(label){ label.textContent=`${pct}%`; }
  if(bar){ bar.setAttribute('aria-valuenow', String(pct)); }
  fill.classList.remove('stamina-high','stamina-mid','stamina-low');
  if(normalized > 0.6){
    fill.classList.add('stamina-high');
  } else if(normalized > 0.3){
    fill.classList.add('stamina-mid');
  } else {
    fill.classList.add('stamina-low');
  }
}
