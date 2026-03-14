import { getRaceEventMeta } from './events.js';
import { getCurrentEvent, onRunPress, onRunRelease, triggerSecondaryAction, throwBananaPeel } from './game.js';

const CONTROL_LAYOUT_STORAGE_KEY = 'track-race:mobile-control-layout:v1';
const CONTROL_KEYS = ['run', 'secondary'];
const CONTROL_DEFAULT_LAYOUTS = {
  portrait: {
    run: { x: 0.2, y: 0.86 },
    secondary: { x: 0.8, y: 0.86 }
  },
  landscape: {
    run: { x: 0.14, y: 0.74 },
    secondary: { x: 0.86, y: 0.74 }
  }
};

function clamp(value, min, max){
  return Math.max(min, Math.min(max, value));
}

function orientationKey(){
  return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
}

function cloneDefaultLayouts(){
  return {
    portrait: {
      run: { ...CONTROL_DEFAULT_LAYOUTS.portrait.run },
      secondary: { ...CONTROL_DEFAULT_LAYOUTS.portrait.secondary }
    },
    landscape: {
      run: { ...CONTROL_DEFAULT_LAYOUTS.landscape.run },
      secondary: { ...CONTROL_DEFAULT_LAYOUTS.landscape.secondary }
    }
  };
}

function normalizeLayoutPoint(point, fallback){
  const source = point && typeof point === 'object' ? point : fallback;
  const safeFallback = fallback || { x: 0.5, y: 0.5 };
  const x = Number.isFinite(source?.x) ? source.x : safeFallback.x;
  const y = Number.isFinite(source?.y) ? source.y : safeFallback.y;
  return {
    x: clamp(x, 0.04, 0.96),
    y: clamp(y, 0.08, 0.96)
  };
}

function loadControlLayouts(){
  const defaults = cloneDefaultLayouts();
  try {
    const raw = localStorage.getItem(CONTROL_LAYOUT_STORAGE_KEY);
    if(!raw){
      return defaults;
    }
    const parsed = JSON.parse(raw);
    for(const mode of ['portrait', 'landscape']){
      for(const control of CONTROL_KEYS){
        defaults[mode][control] = normalizeLayoutPoint(parsed?.[mode]?.[control], defaults[mode][control]);
      }
    }
  } catch(_error){
    return defaults;
  }
  return defaults;
}

function saveControlLayouts(layouts){
  try {
    localStorage.setItem(CONTROL_LAYOUT_STORAGE_KEY, JSON.stringify(layouts));
  } catch(_error){
    // Ignore storage failures; the controls still work for the current session.
  }
}

function getControlsHintText(gamepad=false){
  const meta = getRaceEventMeta(getCurrentEvent());
  return gamepad ? meta.gamepadHint : meta.controlsHint;
}

export function refreshControlsHint(gamepad=false){
  const hint = document.getElementById('controls-hint');
  if(hint){
    hint.textContent = getControlsHintText(gamepad);
  }
}

export function wireKeyboard(){
  window.addEventListener('keydown', (e)=>{
    const cm = document.getElementById('character-modal');
    const gm = document.getElementById('game-modal');
    const em = document.getElementById('event-modal');
    const inModal = (cm && !cm.classList.contains('hidden')) ||
      (gm && !gm.classList.contains('hidden')) ||
      (em && !em.classList.contains('hidden'));

    if(e.code === 'Space'){
      if(e.repeat){ return; }
      e.preventDefault();
      if(!inModal) onRunPress();
    }
    if(e.code === 'KeyG'){
      e.preventDefault();
      if(!inModal) triggerSecondaryAction();
    }
    if(e.code === 'KeyB'){
      e.preventDefault();
      if(!inModal) throwBananaPeel();
    }
  });

  window.addEventListener('keyup', (e)=>{
    if(e.code === 'Space'){
      e.preventDefault();
      onRunRelease();
    }
  });
}

export function wireTouch(){
  const trackArea = document.getElementById('track-area');
  if(trackArea){
    const block = (e)=>{
      e.preventDefault();
      e.stopPropagation();
    };
    trackArea.addEventListener('pointerdown', block, { passive: false });
    trackArea.addEventListener('touchstart', block, { passive: false });
    trackArea.addEventListener('click', block);
  }
}

export function wireMobileButtons(){
  const overlay = document.getElementById('mobile-controls');
  const run = document.getElementById('btn-run');
  const turbo = document.getElementById('btn-turbo');
  const editBtn = document.getElementById('edit-controls-btn');
  const doneBtn = document.getElementById('controls-done-btn');
  const resetBtn = document.getElementById('controls-reset-btn');
  const editPanel = document.getElementById('controls-edit-panel');
  const pads = {
    run: overlay?.querySelector('[data-control="run"]'),
    secondary: overlay?.querySelector('[data-control="secondary"]')
  };
  if(!overlay || !run || !turbo || !pads.run || !pads.secondary){
    return;
  }
  if(overlay.dataset.bound === '1'){
    return;
  }
  overlay.dataset.bound = '1';

  let controlLayouts = loadControlLayouts();
  let editMode = false;
  let dragState = null;

  const prevent = (e)=>{
    e.preventDefault();
    e.stopPropagation();
  };
  const setPressed = (el, pressed)=>{
    if(el){
      el.classList.toggle('is-pressed', !!pressed);
    }
  };
  const getContainerMetrics = ()=>{
    const container = document.getElementById('game-container');
    if(!container){
      return null;
    }
    const rect = container.getBoundingClientRect();
    const topBarRect = document.getElementById('top-bar')?.getBoundingClientRect();
    const safeTop = clamp(((topBarRect?.bottom || rect.top) - rect.top) + 16, 18, Math.max(18, rect.height - 120));
    overlay.style.setProperty('--controls-safe-top', `${safeTop.toFixed(2)}px`);
    return {
      rect,
      width: Math.max(rect.width, 1),
      height: Math.max(rect.height, 1),
      safeTop
    };
  };
  const getPadSize = (control)=>{
    const rect = pads[control]?.getBoundingClientRect();
    return {
      width: Math.max(rect?.width || 112, 64),
      height: Math.max(rect?.height || 78, 64)
    };
  };
  const getCurrentPixelPosition = (control)=>{
    const pad = pads[control];
    return {
      x: Number.parseFloat(pad?.dataset.x || '0') || 0,
      y: Number.parseFloat(pad?.dataset.y || '0') || 0
    };
  };
  const setPixelPosition = (control, x, y)=>{
    const pad = pads[control];
    if(!pad){
      return;
    }
    pad.dataset.x = x.toFixed(2);
    pad.dataset.y = y.toFixed(2);
    pad.style.left = `${x.toFixed(2)}px`;
    pad.style.top = `${y.toFixed(2)}px`;
  };
  const normalizePixelPosition = (x, y, metrics)=>({
    x: clamp(x / metrics.width, 0.04, 0.96),
    y: clamp(y / metrics.height, 0.08, 0.96)
  });
  const getOtherControl = (control)=>control === 'run' ? 'secondary' : 'run';
  const clampControlPosition = (control, rawX, rawY, metrics, otherPoint=null)=>{
    const size = getPadSize(control);
    const margin = 14;
    const minX = size.width * 0.5 + margin;
    const maxX = Math.max(minX, metrics.width - size.width * 0.5 - margin);
    const minY = Math.min(metrics.height - size.height * 0.5 - margin, metrics.safeTop + size.height * 0.5);
    const maxY = Math.max(minY, metrics.height - size.height * 0.5 - margin);
    let x = clamp(rawX, minX, maxX);
    let y = clamp(rawY, minY, maxY);

    const otherControl = getOtherControl(control);
    const other = otherPoint || getCurrentPixelPosition(otherControl);
    if(other.x > 0 && other.y > 0){
      const otherSize = getPadSize(otherControl);
      const targetGap = Math.max((size.width + otherSize.width) * 0.56, 108);
      const dx = x - other.x;
      const dy = y - other.y;
      const distance = Math.hypot(dx, dy);
      if(distance === 0){
        x = clamp(other.x + targetGap, minX, maxX);
      } else if(distance < targetGap){
        const scale = targetGap / distance;
        x = clamp(other.x + dx * scale, minX, maxX);
        y = clamp(other.y + dy * scale, minY, maxY);
      }
    }

    return { x, y };
  };
  const applyLayout = (persist=false)=>{
    const metrics = getContainerMetrics();
    if(!metrics){
      return;
    }
    const mode = orientationKey();
    const nextPoints = {};
    for(const control of CONTROL_KEYS){
      const saved = controlLayouts[mode][control];
      nextPoints[control] = {
        x: saved.x * metrics.width,
        y: saved.y * metrics.height
      };
    }

    const runPoint = clampControlPosition('run', nextPoints.run.x, nextPoints.run.y, metrics, nextPoints.secondary);
    setPixelPosition('run', runPoint.x, runPoint.y);
    const secondaryPoint = clampControlPosition('secondary', nextPoints.secondary.x, nextPoints.secondary.y, metrics, runPoint);
    setPixelPosition('secondary', secondaryPoint.x, secondaryPoint.y);

    if(persist){
      controlLayouts[mode].run = normalizePixelPosition(runPoint.x, runPoint.y, metrics);
      controlLayouts[mode].secondary = normalizePixelPosition(secondaryPoint.x, secondaryPoint.y, metrics);
      saveControlLayouts(controlLayouts);
    }
  };
  const setEditMode = (enabled)=>{
    editMode = !!enabled;
    if(!editMode && dragState){
      endDrag();
    }
    overlay.classList.toggle('is-edit-mode', editMode);
    if(editPanel){
      editPanel.classList.toggle('hidden', !editMode);
    }
    if(editBtn){
      editBtn.textContent = editMode ? 'Done Moving' : 'Move Controls';
      editBtn.classList.toggle('is-active', editMode);
      editBtn.setAttribute('aria-pressed', editMode ? 'true' : 'false');
    }
    setPressed(run, false);
    setPressed(turbo, false);
    onRunRelease();
    applyLayout();
  };
  const startDrag = (control, e)=>{
    if(!editMode || !e.isPrimary){
      return;
    }
    prevent(e);
    const metrics = getContainerMetrics();
    if(!metrics){
      return;
    }
    const current = getCurrentPixelPosition(control);
    dragState = {
      control,
      pointerId: e.pointerId,
      offsetX: e.clientX - metrics.rect.left - current.x,
      offsetY: e.clientY - metrics.rect.top - current.y
    };
    const pad = pads[control];
    pad?.classList.add('is-dragging');
    pad?.setPointerCapture?.(e.pointerId);
  };
  const updateDrag = (e)=>{
    if(!dragState || dragState.pointerId !== e.pointerId){
      return;
    }
    prevent(e);
    const metrics = getContainerMetrics();
    if(!metrics){
      return;
    }
    const nextX = e.clientX - metrics.rect.left - dragState.offsetX;
    const nextY = e.clientY - metrics.rect.top - dragState.offsetY;
    const otherPoint = getCurrentPixelPosition(getOtherControl(dragState.control));
    const clamped = clampControlPosition(dragState.control, nextX, nextY, metrics, otherPoint);
    setPixelPosition(dragState.control, clamped.x, clamped.y);
    controlLayouts[orientationKey()][dragState.control] = normalizePixelPosition(clamped.x, clamped.y, metrics);
  };
  const endDrag = (e)=>{
    if(!dragState){
      return;
    }
    if(e && dragState.pointerId !== e.pointerId){
      return;
    }
    if(e){
      prevent(e);
    }
    const activePad = pads[dragState.control];
    activePad?.classList.remove('is-dragging');
    if(activePad?.hasPointerCapture?.(dragState.pointerId)){
      activePad.releasePointerCapture(dragState.pointerId);
    }
    dragState = null;
    saveControlLayouts(controlLayouts);
  };

  if(run){
    const releaseRun = (e)=>{
      if(editMode){
        if(e){ prevent(e); }
        return;
      }
      if(e){ prevent(e); }
      setPressed(run, false);
      onRunRelease();
    };
    run.addEventListener('pointerdown', (e)=>{
      if(editMode){
        prevent(e);
        return;
      }
      prevent(e);
      setPressed(run, true);
      onRunPress();
    }, { passive: false });
    run.addEventListener('pointerup', releaseRun, { passive: false });
    run.addEventListener('pointercancel', releaseRun, { passive: false });
    run.addEventListener('pointerleave', ()=>{
      if(editMode){
        return;
      }
      setPressed(run, false);
      onRunRelease();
    });
    run.addEventListener('touchstart', (e)=>{
      if(editMode){
        prevent(e);
        return;
      }
      prevent(e);
      setPressed(run, true);
      onRunPress();
    }, { passive: false });
    run.addEventListener('touchend', releaseRun, { passive: false });
  }

  if(turbo){
    const releaseTurbo = (e)=>{
      if(editMode){
        if(e){ prevent(e); }
        return;
      }
      if(e){ prevent(e); }
      setPressed(turbo, false);
    };
    const triggerTurbo = (e)=>{
      if(editMode){
        prevent(e);
        return;
      }
      prevent(e);
      setPressed(turbo, true);
      triggerSecondaryAction();
      setTimeout(()=>{
        setPressed(turbo, false);
      }, 140);
    };
    turbo.addEventListener('pointerdown', triggerTurbo, { passive: false });
    turbo.addEventListener('pointerup', releaseTurbo, { passive: false });
    turbo.addEventListener('pointercancel', releaseTurbo, { passive: false });
    turbo.addEventListener('pointerleave', ()=>{
      if(editMode){
        return;
      }
      setPressed(turbo, false);
    });
    turbo.addEventListener('touchstart', triggerTurbo, { passive: false });
    turbo.addEventListener('touchend', releaseTurbo, { passive: false });
    turbo.addEventListener('click', (e)=>{
      prevent(e);
    });
  }

  for(const control of CONTROL_KEYS){
    const pad = pads[control];
    if(!pad){
      continue;
    }
    pad.addEventListener('pointerdown', (e)=>startDrag(control, e), { passive: false });
    pad.addEventListener('pointermove', updateDrag, { passive: false });
    pad.addEventListener('pointerup', endDrag, { passive: false });
    pad.addEventListener('pointercancel', endDrag, { passive: false });
  }

  if(editBtn){
    editBtn.addEventListener('click', (e)=>{
      prevent(e);
      setEditMode(!editMode);
    });
  }
  if(doneBtn){
    doneBtn.addEventListener('click', (e)=>{
      prevent(e);
      setEditMode(false);
    });
  }
  if(resetBtn){
    resetBtn.addEventListener('click', (e)=>{
      prevent(e);
      const mode = orientationKey();
      controlLayouts[mode] = {
        run: { ...CONTROL_DEFAULT_LAYOUTS[mode].run },
        secondary: { ...CONTROL_DEFAULT_LAYOUTS[mode].secondary }
      };
      applyLayout(true);
    });
  }

  const refreshLayout = ()=>{
    requestAnimationFrame(()=>applyLayout(true));
  };
  window.addEventListener('resize', refreshLayout);
  window.addEventListener('orientationchange', ()=>{
    setTimeout(()=>applyLayout(true), 120);
  });

  setEditMode(false);
  applyLayout(true);
}

export function wireMobileViewport(){
  let lastTouchEnd = 0;
  const blockGesture = (e)=>{ e.preventDefault(); };
  const lockHeight = ()=>{
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  lockHeight();
  window.addEventListener('resize', lockHeight);
  window.addEventListener('orientationchange', ()=>{
    setTimeout(lockHeight, 120);
  });

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

export function wireGamepad(){
  let running = false;
  let actionReady = true;
  let padIndex = -1;
  let hintSet = false;
  const cm = document.getElementById('character-modal');
  const gm = document.getElementById('game-modal');
  const em = document.getElementById('event-modal');

  const setHint = (gp)=>{ refreshControlsHint(gp); };

  window.addEventListener('gamepadconnected', (e)=>{
    padIndex = e.gamepad && typeof e.gamepad.index === 'number' ? e.gamepad.index : 0;
    setHint(true);
  });

  window.addEventListener('gamepaddisconnected', ()=>{
    padIndex = -1;
    setHint(false);
  });

  function poll(){
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = (pads && (padIndex >= 0 ? pads[padIndex] : pads[0])) || null;
    if(pad){
      if(!hintSet){
        setHint(true);
        hintSet = true;
      }
      const inModal = (cm && !cm.classList.contains('hidden')) ||
        (gm && !gm.classList.contains('hidden')) ||
        (em && !em.classList.contains('hidden'));
      const aBtn = pad.buttons[0];
      const x2 = pad.buttons[2];
      const x3 = pad.buttons[3];
      const rtBtn = pad.buttons[7];
      const isPressed = (button)=>!!(button && (button.pressed || button.value > 0.5));
      const a = isPressed(aBtn);
      const mappingStandard = pad.mapping === 'standard';
      const x = mappingStandard ? isPressed(x2) : (isPressed(x2) || isPressed(x3));
      const rt = isPressed(rtBtn);
      if(!inModal){
        if(a && !running){
          onRunPress();
          running = true;
        }
        if(!a && running){
          onRunRelease();
          running = false;
        }
        const actionPressed = x || rt;
        if(actionPressed && actionReady){
          triggerSecondaryAction();
          actionReady = false;
          setTimeout(()=>{
            actionReady = true;
          }, 250);
        }
      }
    } else if(hintSet){
      setHint(false);
      hintSet = false;
    }
    requestAnimationFrame(poll);
  }

  poll();
}
