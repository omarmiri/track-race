import { characters, updateRunnerAppearance, renderCharacterThumbnail } from './characters.js';
import { initCrowdAnimation, updateCrowdSignText } from './crowd.js';
import { updateSpeedConstants } from './speed.js';
import { startGame, initializeTrackView, setPlayerRacePerk } from './game.js';
import { wireKeyboard, wireTouch, wireGamepad, wireMobileButtons, wireMobileViewport } from './input.js';
import { initializeHighScores, saveHighScore, showHighScoresModal, closeHighScoresModal, toggleModalScoreView, renderResultsBestTimes, toggleResultsScoreView } from './highscores.js';

function ordinal(place){
  if(place % 100 >= 11 && place % 100 <= 13) return `${place}th`;
  const mod = place % 10;
  if(mod === 1) return `${place}st`;
  if(mod === 2) return `${place}nd`;
  if(mod === 3) return `${place}rd`;
  return `${place}th`;
}

function renderPodium(standings){
  const container = document.getElementById('podium-results');
  if(!container){ return; }
  const topThree = (standings || []).slice(0, 3);
  if(!topThree.length){
    container.innerHTML = '';
    return;
  }

  const ordered = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
  const heights = { 1: 'h-28', 2: 'h-20', 3: 'h-16' };

  container.innerHTML = `
    <div class="bg-white rounded-xl shadow p-3">
      <div class="flex items-end justify-center gap-2 sm:gap-3">
        ${ordered.map((entry)=>{
          const place = entry.place;
          const label = entry.isPlayer ? 'You' : entry.name;
          return `
            <div class="flex flex-col items-center gap-1 w-20 sm:w-24" data-podium-character="${entry.characterKey}">
              <div class="podium-thumb w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center"></div>
              <div class="text-[10px] sm:text-xs text-center text-[#2f3b58] font-bold leading-tight min-h-[1.6rem]">${label}</div>
              <div class="w-full ${heights[place] || 'h-14'} rounded-t-lg flex items-center justify-center ${place===1 ? 'bg-yellow-300 text-[#5b4600]' : place===2 ? 'bg-slate-300 text-[#334155]' : 'bg-orange-300 text-[#7c2d12]'} shadow-inner text-lg sm:text-xl font-bold">${place}</div>
            </div>`;
        }).join('')}
      </div>
    </div>`;

  Array.from(container.querySelectorAll('[data-podium-character]')).forEach((el)=>{
    const characterKey = el.getAttribute('data-podium-character');
    const thumb = el.querySelector('.podium-thumb');
    if(characterKey && thumb){ renderCharacterThumbnail(thumb, characterKey); }
  });
}

function init(){
  const backBtn = document.getElementById('back-btn');
  const scoresBtn = document.getElementById('scores-btn');
  const changeBtnHeader = document.getElementById('change-character-header-btn');
  const playerEl = document.getElementById('player');
  const computerEl = document.getElementById('computer');
  const changeBtn = document.getElementById('change-character-btn');
  const changeFooterBtn = document.getElementById('change-character-footer-btn');
  const charModal = document.getElementById('character-modal');
  const charGrid = document.getElementById('character-grid');
  const gameModal = document.getElementById('game-modal');
  const playerPreview = document.getElementById('player-preview');
  const computerPreview = document.getElementById('computer-preview');
  const startBtn = document.getElementById('start-button');
  const modalClose = document.getElementById('modal-close');
  const modalToggle = document.getElementById('modal-toggle-scores');
  const resultsStack = document.getElementById('modal-results-stack');
  const controlsHint = document.getElementById('controls-hint');
  const raceTimeDisplay = document.getElementById('race-time-display');
  const modalText = document.getElementById('modal-text');
  const modalTitle = document.getElementById('modal-title');
  const finalRaceTime = document.getElementById('final-race-time');
  const racePerkWrap = document.getElementById('race-perk-wrap');
  const racePerkPicker = document.getElementById('race-perk-picker');

  updateSpeedConstants();
  window.gameReady = false;

  if(backBtn){ backBtn.addEventListener('click', ()=>{ window.location.href = '../index.html'; }); }
  if(scoresBtn){ scoresBtn.addEventListener('click', async ()=>{ showHighScoresModal(); }); }
  if(changeBtnHeader){ changeBtnHeader.addEventListener('click', ()=>{ if(charModal) charModal.classList.remove('hidden'); if(gameModal) gameModal.classList.add('hidden'); }); }
  if(modalClose){ modalClose.addEventListener('click', ()=>{ closeHighScoresModal(); }); }
  if(modalToggle){ modalToggle.addEventListener('click', ()=>{ toggleModalScoreView(); }); }

  let currentPlayerKey = 'blue-racer';
  let currentOpponentKey = 'red-racer';
  let currentRacePerk = 'speed';

  const pickOpponentFor = (key)=>{
    if(key==='blue-racer') return 'red-racer';
    if(key==='red-racer') return 'blue-racer';
    const keys = Object.keys(characters);
    return keys.find((k)=>k!=='blue-racer' && k!==key) || 'red-racer';
  };

  const pickRandomPlayer = ()=>{
    const keys = Object.keys(characters).filter((k)=>k!=='mystery');
    return keys[Math.floor(Math.random()*keys.length)] || 'blue-racer';
  };

  const setVisible = (el, visible)=>{
    if(!el) return;
    el.classList.toggle('hidden', !visible);
  };

  const setRacePerkSelection = (perk)=>{
    currentRacePerk = (perk === 'turbo') ? 'turbo' : 'speed';
    setPlayerRacePerk(currentRacePerk);
    if(racePerkPicker){
      Array.from(racePerkPicker.querySelectorAll('.race-perk-btn')).forEach((btn)=>{
        const selected = btn.getAttribute('data-perk') === currentRacePerk;
        btn.classList.toggle('is-selected', selected);
      });
    }
  };

  const applySelection = (key)=>{
    const resolved = (key==='mystery') ? pickRandomPlayer() : key;
    currentPlayerKey = resolved;
    currentOpponentKey = pickOpponentFor(resolved);
    document.querySelectorAll('#character-grid .character-btn').forEach((b)=>b.classList.remove('selected'));
    const sel = document.querySelector(`#character-grid .character-btn[data-char="${key}"]`);
    if(sel) sel.classList.add('selected');
    if(playerPreview) renderCharacterThumbnail(playerPreview, currentPlayerKey);
    if(computerPreview) renderCharacterThumbnail(computerPreview, currentOpponentKey);
  };

  const setStartButton = (mode)=>{
    if(!startBtn) return;
    if(mode === 'results'){
      startBtn.textContent = 'Race Again';
      startBtn.className = 'px-4 py-3 text-xs sm:text-sm font-bold rounded bg-green-500 text-white';
      return;
    }
    startBtn.textContent = 'Start Race';
    startBtn.className = 'px-4 py-3 text-xs sm:text-sm font-bold rounded bg-yellow-300 text-black';
  };

  const openPreRaceModal = ()=>{
    if(modalTitle){
      modalTitle.textContent = 'Track Race';
      modalTitle.className = 'text-sm sm:text-lg font-bold text-yellow-300 mb-1 text-center';
      modalTitle.style.textShadow = '2px 2px #000';
    }
    if(modalText){
      modalText.textContent = 'Ready to race?';
      modalText.className = 'text-xs sm:text-sm text-white mb-1 text-center px-2 opacity-95';
    }
    setStartButton('prerace');
    setVisible(raceTimeDisplay, false);
    setVisible(resultsStack, false);
    setVisible(racePerkWrap, true);
    setVisible(controlsHint, true);
    if(gameModal){ gameModal.classList.remove('results-open'); }
    if(gameModal) gameModal.classList.remove('hidden');
    window.gameReady = true;
  };

  const openResultsModal = (ms, standings)=>{
    const playerEntry = standings.find((entry)=>entry.isPlayer) || null;
    const playerWon = playerEntry ? playerEntry.place === 1 : false;
    const placingText = playerEntry ? ordinal(playerEntry.place) : 'finished';

    if(modalTitle){
      modalTitle.textContent = 'Race Results';
      modalTitle.className = 'text-sm sm:text-lg font-bold text-yellow-300 mb-1 text-center';
      modalTitle.style.textShadow = '2px 2px #000';
    }
    if(modalText){
      modalText.textContent = `${playerWon ? 'You won.' : 'You lost.'} Finished ${placingText}.`;
      modalText.className = 'text-xs sm:text-sm text-white mb-1 text-center px-2 opacity-95';
    }
    if(finalRaceTime){
      finalRaceTime.textContent = (ms / 1000).toFixed(2) + 's';
    }
    setStartButton('results');
    setVisible(raceTimeDisplay, true);
    setVisible(resultsStack, true);
    setVisible(racePerkWrap, false);
    setVisible(controlsHint, false);
    if(gameModal){ gameModal.classList.add('results-open'); }
    if(gameModal) gameModal.classList.remove('hidden');
  };

  const openCharacterPicker = ()=>{
    if(charModal) {
      applySelection(currentPlayerKey);
      charModal.classList.remove('hidden');
      if(gameModal) gameModal.classList.add('hidden');
    }
  };

  updateRunnerAppearance(playerEl, currentPlayerKey);
  updateRunnerAppearance(computerEl, currentOpponentKey);
  applySelection(currentPlayerKey);
  setRacePerkSelection(currentRacePerk);
  initializeTrackView();
  updateCrowdSignText('GO RACER');
  initCrowdAnimation();
  wireKeyboard();
  wireTouch();
  wireGamepad();
  wireMobileButtons();
  wireMobileViewport();
  window.initializeHighScores = initializeHighScores;

  if(charGrid && !charGrid.dataset.bound){
    charGrid.dataset.bound='1';
    charGrid.addEventListener('click',(e)=>{
      const btn = (e.target instanceof Element) ? e.target.closest('.character-btn') : null;
      if(!btn) return;
      const key = btn.getAttribute('data-char');
      if(!key) return;
      applySelection(key);
      if(charModal) charModal.classList.add('hidden');
      openPreRaceModal();
    });
  }

  if(racePerkPicker && !racePerkPicker.dataset.bound){
    racePerkPicker.dataset.bound='1';
    racePerkPicker.addEventListener('click', (e)=>{
      const btn = (e.target instanceof Element) ? e.target.closest('.race-perk-btn') : null;
      if(!btn) return;
      const perk = btn.getAttribute('data-perk');
      setRacePerkSelection(perk || 'speed');
    });
  }

  window.addEventListener('keydown',(e)=>{
    const inSelect = (charModal && !charModal.classList.contains('hidden'));
    if(!inSelect) return;
    const k=e.key;
    const c=e.code||'';
    const enter = k==='Enter' || k==='5' || c==='Numpad5';
    if(enter){
      e.preventDefault();
      if(charModal) charModal.classList.add('hidden');
      openPreRaceModal();
    }
  });

  const wireGamepadUI = ()=>{
    let padIndex = -1;
    let prev = { a:false, left:false, right:false, b:false };
    let charIdx = 0;
    let uiFocus = 0;
    const focusTargets = ()=>[startBtn, changeFooterBtn].filter(Boolean);
    const getButtons = (pad)=>{
      const b=pad.buttons||[];
      return {
        a: !!(b[0] && (b[0].pressed || b[0].value > 0.5)),
        b: !!(b[1] && (b[1].pressed || b[1].value > 0.5)),
        left: !!(b[14] && (b[14].pressed || b[14].value > 0.5)),
        right: !!(b[15] && (b[15].pressed || b[15].value > 0.5))
      };
    };
    const highlightFocus = ()=>{
      if(!gameModal || gameModal.classList.contains('hidden')) return;
      focusTargets().forEach((el)=>el.classList.remove('ring-2','ring-yellow-300'));
      const target = focusTargets()[uiFocus];
      if(target) target.classList.add('ring-2','ring-yellow-300');
    };

    window.addEventListener('gamepadconnected',(e)=>{ padIndex=(e.gamepad&&typeof e.gamepad.index==='number')? e.gamepad.index : 0; });
    window.addEventListener('gamepaddisconnected',()=>{ padIndex=-1; });

    const poll = ()=>{
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = (padIndex >= 0 ? pads[padIndex] : pads[0]) || null;
      if(pad){
        const btns = getButtons(pad);
        const inChar = charModal && !charModal.classList.contains('hidden');
        const inGameM = gameModal && !gameModal.classList.contains('hidden');
        if(inChar && charGrid){
          const items = Array.from(charGrid.querySelectorAll('.character-btn'));
          if(items.length){
            const cols = 3;
            const currentEl = charGrid.querySelector('.character-btn.selected') || items[charIdx];
            let idx = items.indexOf(currentEl);
            if(idx < 0) idx = 0;
            charIdx = idx;
            if(btns.left && !prev.left){ if(charIdx % cols > 0) charIdx--; }
            if(btns.right && !prev.right){ if(charIdx % cols < cols - 1 && charIdx + 1 < items.length) charIdx++; }
            const el = items[charIdx];
            const key = el && el.getAttribute('data-char');
            if(key) applySelection(key);
            if(btns.a && !prev.a){
              if(charModal) charModal.classList.add('hidden');
              openPreRaceModal();
            }
          }
        } else if(inGameM){
          highlightFocus();
          if(btns.left && !prev.left){ uiFocus = Math.max(0, uiFocus - 1); highlightFocus(); }
          if(btns.right && !prev.right){ uiFocus = Math.min(Math.max(0, focusTargets().length - 1), uiFocus + 1); highlightFocus(); }
          if(btns.a && !prev.a){
            const target = focusTargets()[uiFocus];
            if(target) target.click();
          }
          if(btns.b && !prev.b && changeFooterBtn){ changeFooterBtn.click(); }
        }
        prev = btns;
      }
      requestAnimationFrame(poll);
    };
    poll();
  };

  wireGamepadUI();

  if(changeBtn){ changeBtn.addEventListener('click', openCharacterPicker); }
  if(changeFooterBtn){ changeFooterBtn.addEventListener('click', openCharacterPicker); }

  if(startBtn && !startBtn.dataset.bound){
    startBtn.dataset.bound = '1';
    startBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      updateRunnerAppearance(playerEl, currentPlayerKey);
      updateRunnerAppearance(computerEl, currentOpponentKey);
      const playerName = (characters[currentPlayerKey] && characters[currentPlayerKey].name) || 'Racer';
      updateCrowdSignText('GO ' + playerName.toUpperCase());
      if(gameModal) gameModal.classList.add('hidden');
      setPlayerRacePerk(currentRacePerk);
      window.gameReady = true;
      startGame();
    });
  }

  document.addEventListener('raceFinished', async (ev)=>{
    const ms = ev.detail?.timeMs || 0;
    const playerFinished = !!ev.detail?.playerFinished;
    const standings = ev.detail?.standings || [];
    if(playerFinished){ await saveHighScore(ms); }
    renderPodium(standings);
    await renderResultsBestTimes();
    const toggle = document.getElementById('results-toggle-scores');
    if(toggle && !toggle.dataset.bound){
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', ()=>{ toggleResultsScoreView(); });
    }
    openResultsModal(ms, standings);
  });

  if(charModal) charModal.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', init);











