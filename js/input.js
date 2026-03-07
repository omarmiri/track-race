import { onRunPress, onRunRelease, activateTurbo, throwBananaPeel } from './game.js';

export function wireKeyboard(){
  window.addEventListener('keydown',(e)=>{
    const cm=document.getElementById('character-modal');
    const gm=document.getElementById('game-modal');
    const inModal=(cm && !cm.classList.contains('hidden')) || (gm && !gm.classList.contains('hidden'));
    if(e.code==='Space'){
      if(e.repeat){ return; }
      e.preventDefault();
      if(!inModal) onRunPress();
    }
    if(e.code==='KeyG'){
      e.preventDefault();
      if(!inModal) activateTurbo();
    }
    if(e.code==='KeyB'){
      e.preventDefault();
      if(!inModal) throwBananaPeel();
    }
  });
  window.addEventListener('keyup',(e)=>{
    if(e.code==='Space'){
      e.preventDefault();
      onRunRelease();
    }
  });
}

export function wireTouch(){
  const trackArea = document.getElementById('track-area');
  if(trackArea){
    const block = (e)=>{ e.preventDefault(); e.stopPropagation(); };
    trackArea.addEventListener('pointerdown', block, { passive: false });
    trackArea.addEventListener('touchstart', block, { passive: false });
    trackArea.addEventListener('click', block);
  }
}

export function wireMobileButtons(){
  const run=document.getElementById('btn-run');
  const turbo=document.getElementById('btn-turbo');
  const prevent=(e)=>{ e.preventDefault(); e.stopPropagation(); };
  const setPressed=(el, pressed)=>{ if(el){ el.classList.toggle('is-pressed', !!pressed); } };

  if(run){
    const releaseRun=(e)=>{ if(e){ prevent(e); } setPressed(run, false); onRunRelease(); };
    run.addEventListener('pointerdown',(e)=>{ prevent(e); setPressed(run, true); onRunPress(); }, { passive: false });
    run.addEventListener('pointerup', releaseRun, { passive: false });
    run.addEventListener('pointercancel', releaseRun, { passive: false });
    run.addEventListener('pointerleave', ()=>{ setPressed(run, false); onRunRelease(); });
    run.addEventListener('touchstart',(e)=>{ prevent(e); setPressed(run, true); onRunPress(); }, { passive: false });
    run.addEventListener('touchend', releaseRun, { passive: false });
  }

  if(turbo){
    const releaseTurbo=(e)=>{ if(e){ prevent(e); } setPressed(turbo, false); };
    const triggerTurbo=(e)=>{
      prevent(e);
      setPressed(turbo, true);
      activateTurbo();
      setTimeout(()=>{ setPressed(turbo, false); }, 140);
    };
    turbo.addEventListener('pointerdown', triggerTurbo, { passive: false });
    turbo.addEventListener('pointerup', releaseTurbo, { passive: false });
    turbo.addEventListener('pointercancel', releaseTurbo, { passive: false });
    turbo.addEventListener('pointerleave', ()=>{ setPressed(turbo, false); });
    turbo.addEventListener('touchstart', triggerTurbo, { passive: false });
    turbo.addEventListener('touchend', releaseTurbo, { passive: false });
    turbo.addEventListener('click',(e)=>{ prevent(e); });
  }
}

export function wireMobileViewport(){
  let lastTouchEnd = 0;
  const blockGesture = (e)=>{ e.preventDefault(); };
  const lockHeight = ()=>{
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  lockHeight();
  window.addEventListener('resize', lockHeight);
  window.addEventListener('orientationchange', ()=>{ setTimeout(lockHeight, 120); });

  document.addEventListener('gesturestart', blockGesture, { passive: false });
  document.addEventListener('gesturechange', blockGesture, { passive: false });
  document.addEventListener('gestureend', blockGesture, { passive: false });

  document.addEventListener('dblclick', blockGesture, { passive: false });
  document.addEventListener('touchmove', (e)=>{
    if(e.touches && e.touches.length > 1){
      e.preventDefault();
    }
  }, { passive: false });
  document.addEventListener('touchend', (e)=>{
    const now = Date.now();
    if(now - lastTouchEnd < 350){
      e.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}

export function wireGamepad(){ let running=false; let turboReady=true; let padIndex=-1; let hintSet=false; const hint=document.getElementById('controls-hint'); const cm=document.getElementById('character-modal'); const gm=document.getElementById('game-modal'); const setHint=(gp)=>{ if(hint){ hint.textContent = gp ? 'Use Gamepad: A=Run, X/RT=Turbo' : 'Touch buttons or use SPACE/G keys'; } }; window.addEventListener('gamepadconnected',(e)=>{ padIndex=e.gamepad && typeof e.gamepad.index==='number' ? e.gamepad.index : 0; setHint(true); }); window.addEventListener('gamepaddisconnected',()=>{ padIndex=-1; setHint(false); }); function poll(){ const pads=navigator.getGamepads ? navigator.getGamepads() : []; const pad=(pads && (padIndex>=0 ? pads[padIndex] : pads[0]))||null; if(pad){ if(!hintSet){ setHint(true); hintSet=true; } const inModal=(cm && !cm.classList.contains('hidden')) || (gm && !gm.classList.contains('hidden')); const aBtn=pad.buttons[0]; const x2=pad.buttons[2]; const x3=pad.buttons[3]; const rtBtn=pad.buttons[7]; const isPressed=(b)=>!!(b && (b.pressed || b.value>0.5)); const a=isPressed(aBtn); const mappingStandard=(pad.mapping==='standard'); const x=(mappingStandard? isPressed(x2) : (isPressed(x2)||isPressed(x3))); const rt=isPressed(rtBtn); if(!inModal){ if(a && !running){ onRunPress(); running=true; } if(!a && running){ onRunRelease(); running=false; } const turboPressed = x || rt; if(turboPressed && turboReady){ activateTurbo(); turboReady=false; setTimeout(()=>{ turboReady=true; }, 250); } } } else { if(hintSet){ setHint(false); hintSet=false; } } requestAnimationFrame(poll); } poll(); }

