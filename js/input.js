import { getRaceEventMeta } from './events.js';
import { getCurrentEvent, onRunPress, onRunRelease, triggerSecondaryAction, throwBananaPeel } from './game.js';

const CONTROL_LAYOUT_STORAGE_KEY = 'track-race:mobile-control-layout:v1';
const CONTROL_KEYS = ['run', 'secondary'];
const CONTROL_SCALE_MIN = 0.8;
const CONTROL_SCALE_MAX = 1.8;
const CONTROL_SCALE_STEP = 0.1;
const CONTROL_DEFAULT_LAYOUTS = {
  portrait: {
    run: { x: 0.2, y: 0.86, scale: 1 },
    secondary: { x: 0.8, y: 0.86, scale: 1 }
  },
  landscape: {
    run: { x: 0.14, y: 0.74, scale: 1 },
    secondary: { x: 0.86, y: 0.74, scale: 1 }
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

function normalizeControlLayout(layout, fallback){
  const source = layout && typeof layout === 'object' ? layout : fallback;
  const safeFallback = fallback || { x: 0.5, y: 0.5 };
  const x = Number.isFinite(source?.x) ? source.x : safeFallback.x;
  const y = Number.isFinite(source?.y) ? source.y : safeFallback.y;
  const scale = Number.isFinite(source?.scale) ? source.scale : (safeFallback.scale || 1);
  return {
    x: clamp(x, 0.04, 0.96),
    y: clamp(y, 0.08, 0.96),
    scale: clamp(scale, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX)
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
        defaults[mode][control] = normalizeControlLayout(parsed?.[mode]?.[control], defaults[mode][control]);
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
  const sizePanel = document.getElementById('controls-size-panel');
  const sizeValueEls = {
    run: document.getElementById('controls-size-run-value'),
    secondary: document.getElementById('controls-size-secondary-value')
  };
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
  let editGesture = null;
  let sizeAdjustIntervalId = 0;

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
  const getControlScale = (control, mode=orientationKey())=>{
    const savedScale = controlLayouts[mode]?.[control]?.scale;
    const fallbackScale = CONTROL_DEFAULT_LAYOUTS[mode]?.[control]?.scale || 1;
    return clamp(savedScale || fallbackScale, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX);
  };
  const getPadSize = (control, scaleOverride=null)=>{
    const button = pads[control]?.querySelector('.mobile-action-btn');
    const scale = clamp(scaleOverride ?? getControlScale(control), CONTROL_SCALE_MIN, CONTROL_SCALE_MAX);
    return {
      width: Math.max(button?.offsetWidth || 112, 64) * scale,
      height: Math.max(button?.offsetHeight || 78, 64) * scale
    };
  };
  const getCurrentPixelPosition = (control)=>{
    const pad = pads[control];
    return {
      x: Number.parseFloat(pad?.dataset.x || '0') || 0,
      y: Number.parseFloat(pad?.dataset.y || '0') || 0
    };
  };
  const setPadScale = (control, scale)=>{
    const pad = pads[control];
    if(!pad){
      return;
    }
    const clamped = clamp(scale, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX);
    pad.style.setProperty('--control-scale', clamped.toFixed(2));
  };
  const updateSizeReadout = (control, scale)=>{
    const output = sizeValueEls[control];
    if(output){
      output.textContent = `${Math.round(scale * 100)}%`;
    }
  };
  const applyControlScale = (control, scale)=>{
    const clamped = clamp(scale, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX);
    setPadScale(control, clamped);
    updateSizeReadout(control, clamped);
  };
  const updateControlLayout = (control, x, y, metrics, scale=getControlScale(control))=>{
    const mode = orientationKey();
    controlLayouts[mode][control] = {
      ...normalizePixelPosition(x, y, metrics),
      scale: clamp(scale, CONTROL_SCALE_MIN, CONTROL_SCALE_MAX)
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
  const getRelativePointerPosition = (e, metrics)=>({
    x: e.clientX - metrics.rect.left,
    y: e.clientY - metrics.rect.top
  });
  const getGesturePoints = (gesture)=>Array.from(gesture.pointers.values()).slice(0, 2);
  const getPointerDistance = (a, b)=>Math.max(Math.hypot(a.x - b.x, a.y - b.y), 1);
  const getPointerCenter = (a, b)=>({
    x: (a.x + b.x) * 0.5,
    y: (a.y + b.y) * 0.5
  });
  const clampControlPosition = (control, rawX, rawY, metrics, otherPoint=null, scaleOverride=null, otherScaleOverride=null)=>{
    const size = getPadSize(control, scaleOverride);
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
      const otherSize = getPadSize(otherControl, otherScaleOverride);
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
    const runScale = getControlScale('run', mode);
    const secondaryScale = getControlScale('secondary', mode);
    const nextPoints = {};
    for(const control of CONTROL_KEYS){
      const saved = controlLayouts[mode][control];
      applyControlScale(control, saved.scale || 1);
      nextPoints[control] = {
        x: saved.x * metrics.width,
        y: saved.y * metrics.height
      };
    }

    const runPoint = clampControlPosition('run', nextPoints.run.x, nextPoints.run.y, metrics, nextPoints.secondary, runScale, secondaryScale);
    setPixelPosition('run', runPoint.x, runPoint.y);
    const secondaryPoint = clampControlPosition('secondary', nextPoints.secondary.x, nextPoints.secondary.y, metrics, runPoint, secondaryScale, runScale);
    setPixelPosition('secondary', secondaryPoint.x, secondaryPoint.y);

    if(persist){
      controlLayouts[mode].run = normalizePixelPosition(runPoint.x, runPoint.y, metrics);
      controlLayouts[mode].secondary = normalizePixelPosition(secondaryPoint.x, secondaryPoint.y, metrics);
      controlLayouts[mode].run.scale = runScale;
      controlLayouts[mode].secondary.scale = secondaryScale;
      saveControlLayouts(controlLayouts);
    }
  };
  const clearSizeAdjustInterval = ()=>{
    if(sizeAdjustIntervalId){
      clearInterval(sizeAdjustIntervalId);
      sizeAdjustIntervalId = 0;
    }
  };
  const adjustControlScale = (control, step)=>{
    const mode = orientationKey();
    if(!controlLayouts[mode]?.[control]){
      return;
    }
    const currentScale = getControlScale(control, mode);
    const nextScale = clamp(
      Math.round((currentScale + step * CONTROL_SCALE_STEP) * 10) / 10,
      CONTROL_SCALE_MIN,
      CONTROL_SCALE_MAX
    );
    controlLayouts[mode][control].scale = nextScale;
    applyLayout(true);
  };
  const setEditMode = (enabled)=>{
    editMode = !!enabled;
    if(!editMode){
      endEditGesture();
      clearSizeAdjustInterval();
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
  function endEditGesture(e=null){
    if(!editGesture){
      return;
    }
    const pad = pads[editGesture.control];
    if(!e){
      for(const pointerId of editGesture.pointers.keys()){
        if(pad?.hasPointerCapture?.(pointerId)){
          pad.releasePointerCapture(pointerId);
        }
      }
      editGesture.pointers.clear();
      pad?.classList.remove('is-dragging');
      saveControlLayouts(controlLayouts);
      editGesture = null;
      return;
    }
    if(!editGesture.pointers.has(e.pointerId)){
      return;
    }
    if(e){
      prevent(e);
      editGesture.pointers.delete(e.pointerId);
      if(pad?.hasPointerCapture?.(e.pointerId)){
        pad.releasePointerCapture(e.pointerId);
      }
    }
    if(editGesture.pointers.size >= 2){
      const [pointA, pointB] = getGesturePoints(editGesture);
      editGesture.mode = 'pinch';
      editGesture.startScale = getControlScale(editGesture.control);
      editGesture.startPos = getCurrentPixelPosition(editGesture.control);
      editGesture.startDistance = getPointerDistance(pointA, pointB);
      editGesture.startCenter = getPointerCenter(pointA, pointB);
      pad?.classList.add('is-dragging');
      return;
    }
    if(editGesture.pointers.size === 1){
      const [pointerId, point] = Array.from(editGesture.pointers.entries())[0];
      editGesture.mode = 'drag';
      editGesture.dragPointerId = pointerId;
      editGesture.startPointer = { ...point };
      editGesture.startPos = getCurrentPixelPosition(editGesture.control);
      editGesture.startScale = getControlScale(editGesture.control);
      pad?.classList.add('is-dragging');
      return;
    }
    pad?.classList.remove('is-dragging');
    saveControlLayouts(controlLayouts);
    editGesture = null;
  }
  const startEditGesture = (control, e)=>{
    if(!editMode){
      return;
    }
    prevent(e);
    const metrics = getContainerMetrics();
    if(!metrics){
      return;
    }
    const pointer = getRelativePointerPosition(e, metrics);
    if(!editGesture){
      editGesture = {
        control,
        mode: 'drag',
        pointers: new Map(),
        dragPointerId: e.pointerId,
        startPointer: { ...pointer },
        startPos: getCurrentPixelPosition(control),
        startScale: getControlScale(control),
        startCenter: null,
        startDistance: 0
      };
    }
    if(editGesture.control !== control || editGesture.pointers.size >= 2){
      return;
    }
    editGesture.pointers.set(e.pointerId, pointer);
    const pad = pads[control];
    pad?.classList.add('is-dragging');
    pad?.setPointerCapture?.(e.pointerId);
    if(editGesture.pointers.size === 1){
      editGesture.mode = 'drag';
      editGesture.dragPointerId = e.pointerId;
      editGesture.startPointer = { ...pointer };
      editGesture.startPos = getCurrentPixelPosition(control);
      editGesture.startScale = getControlScale(control);
    } else if(editGesture.pointers.size === 2){
      const [pointA, pointB] = getGesturePoints(editGesture);
      editGesture.mode = 'pinch';
      editGesture.startScale = getControlScale(control);
      editGesture.startPos = getCurrentPixelPosition(control);
      editGesture.startDistance = getPointerDistance(pointA, pointB);
      editGesture.startCenter = getPointerCenter(pointA, pointB);
    }
  };
  const updateEditGesture = (e)=>{
    if(!editGesture || !editGesture.pointers.has(e.pointerId)){
      return;
    }
    prevent(e);
    const metrics = getContainerMetrics();
    if(!metrics){
      return;
    }
    const pointer = getRelativePointerPosition(e, metrics);
    editGesture.pointers.set(e.pointerId, pointer);
    const control = editGesture.control;
    const otherControl = getOtherControl(control);
    const otherPoint = getCurrentPixelPosition(otherControl);
    const otherScale = getControlScale(otherControl);

    if(editGesture.mode === 'pinch' && editGesture.pointers.size >= 2){
      const [pointA, pointB] = getGesturePoints(editGesture);
      const distance = getPointerDistance(pointA, pointB);
      const center = getPointerCenter(pointA, pointB);
      const nextScale = clamp(editGesture.startScale * (distance / Math.max(editGesture.startDistance, 1)), CONTROL_SCALE_MIN, CONTROL_SCALE_MAX);
      const nextX = editGesture.startPos.x + (center.x - editGesture.startCenter.x);
      const nextY = editGesture.startPos.y + (center.y - editGesture.startCenter.y);
      const clamped = clampControlPosition(control, nextX, nextY, metrics, otherPoint, nextScale, otherScale);
      applyControlScale(control, nextScale);
      setPixelPosition(control, clamped.x, clamped.y);
      updateControlLayout(control, clamped.x, clamped.y, metrics, nextScale);
      return;
    }

    if(editGesture.mode === 'drag' && editGesture.dragPointerId === e.pointerId){
      const nextX = editGesture.startPos.x + (pointer.x - editGesture.startPointer.x);
      const nextY = editGesture.startPos.y + (pointer.y - editGesture.startPointer.y);
      const currentScale = getControlScale(control);
      const clamped = clampControlPosition(control, nextX, nextY, metrics, otherPoint, currentScale, otherScale);
      setPixelPosition(control, clamped.x, clamped.y);
      updateControlLayout(control, clamped.x, clamped.y, metrics, currentScale);
    }
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
    pad.addEventListener('pointerdown', (e)=>startEditGesture(control, e), { passive: false });
    pad.addEventListener('pointermove', updateEditGesture, { passive: false });
    pad.addEventListener('pointerup', endEditGesture, { passive: false });
    pad.addEventListener('pointercancel', endEditGesture, { passive: false });
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
  if(sizePanel){
    sizePanel.addEventListener('pointerdown', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.controls-size-btn') : null;
      if(!button){
        return;
      }
      prevent(e);
      const control = button.getAttribute('data-size-control');
      const step = Number.parseFloat(button.getAttribute('data-size-step') || '0');
      if(!controlLayouts[orientationKey()]?.[control] || !Number.isFinite(step)){
        return;
      }
      adjustControlScale(control, step);
      clearSizeAdjustInterval();
      sizeAdjustIntervalId = setInterval(()=>{
        adjustControlScale(control, step);
      }, 135);
    });
    const stopSizeAdjust = ()=>clearSizeAdjustInterval();
    sizePanel.addEventListener('pointerup', stopSizeAdjust);
    sizePanel.addEventListener('pointercancel', stopSizeAdjust);
    sizePanel.addEventListener('pointerleave', stopSizeAdjust);
    sizePanel.addEventListener('click', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.controls-size-btn') : null;
      if(button){
        prevent(e);
      }
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
