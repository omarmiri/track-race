import { characters, updateRunnerAppearance, renderCharacterThumbnail } from './characters.js';
import { initCrowdAnimation, updateCrowdSignText } from './crowd.js';
import { updateSpeedConstants } from './speed.js';
import { cancelRace, initializeTrackView, isRaceActive, setPlayerRacePerk, setRaceEvent, setRacePaused, startGame } from './game.js';
import { DEFAULT_EVENT_ID, getRaceEventMeta, normalizeEventId } from './events.js';
import { refreshControlsHint, wireGamepad, wireKeyboard, wireMobileButtons, wireMobileViewport, wireTouch } from './input.js';
import {
  closeHighScoresModal,
  ensureVisitorId,
  initializeHighScores,
  renderResultsBestTimes,
  saveHighScore,
  setScoreEvent,
  showHighScoresModal,
  toggleModalScoreView
} from './highscores.js';
import { addCoins, getCoinRewardForPlace, getCoins, spendCoins } from './coins.js';
import { getUnlockPrice, isCharacterUnlocked, unlockCharacter } from './unlocks.js';
import { setSecondaryActionType } from './ui.js';

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
    if(characterKey && thumb){
      renderCharacterThumbnail(thumb, characterKey);
    }
  });
}

function init(){
  const backBtn = document.getElementById('back-btn');
  const scoresBtn = document.getElementById('scores-btn');
  const changeEventBtn = document.getElementById('change-event-btn');
  const changeBtnHeader = document.getElementById('change-character-header-btn');
  const coinsPill = document.getElementById('coins-pill');
  const playerEl = document.getElementById('player');
  const computerEl = document.getElementById('computer');
  const changeBtn = document.getElementById('change-character-btn');
  const changeFooterBtn = document.getElementById('change-character-footer-btn');
  const eventModal = document.getElementById('event-modal');
  const eventGrid = document.getElementById('event-grid');
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
  const racePerkBalance = document.getElementById('race-perk-balance');
  const coinsCount = document.getElementById('coins-count');
  const coinsMenuModal = document.getElementById('coins-menu-modal');
  const coinsMenuBalance = document.getElementById('coins-menu-balance');
  const coinsMenuNote = document.getElementById('coins-menu-note');
  const coinsMenuPerks = document.getElementById('coins-menu-perks');
  const coinsMenuCloseBtn = document.getElementById('coins-menu-close-btn');
  const characterBalance = document.getElementById('character-balance');
  const characterNote = document.getElementById('character-note');

  updateSpeedConstants();
  window.gameReady = false;
  ensureVisitorId();

  if(backBtn){
    backBtn.addEventListener('click', ()=>{
      window.location.href = '../index.html';
    });
  }

  const DASH_PERK_COST = 2;
  const DEFAULT_CHARACTER_NOTE = 'Select your character or unlock a new racer.';
  let currentEventId = DEFAULT_EVENT_ID;
  let currentPlayerSelectionKey = 'blue-racer';
  let currentPlayerKey = 'blue-racer';
  let currentOpponentKey = 'red-racer';
  let currentRacePerk = 'none';
  let currentCoins = getCoins();

  const pickOpponentFor = (key)=>{
    if(key === 'blue-racer') return 'red-racer';
    if(key === 'red-racer') return 'blue-racer';
    const keys = Object.keys(characters);
    return keys.find((candidate)=>candidate !== 'blue-racer' && candidate !== key) || 'red-racer';
  };

  const pickRandomPlayer = ()=>{
    const keys = Object.keys(characters).filter((key)=>key !== 'mystery' && isCharacterUnlocked(key));
    return keys[Math.floor(Math.random() * keys.length)] || 'blue-racer';
  };

  const setVisible = (el, visible)=>{
    if(!el) return;
    el.classList.toggle('hidden', !visible);
  };

  const setCharacterNote = (text, tone='default')=>{
    if(!characterNote){
      return;
    }
    characterNote.textContent = text;
    characterNote.className = tone === 'warning'
      ? 'text-yellow-200 text-sm mb-2'
      : tone === 'success'
        ? 'text-green-200 text-sm mb-2'
        : 'text-white text-sm mb-2 opacity-80';
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
  const setCoinsPillEnabled = (enabled)=>{
    if(!coinsPill){
      return;
    }
    const isEnabled = !!enabled;
    coinsPill.disabled = !isEnabled;
    coinsPill.classList.toggle('is-disabled', !isEnabled);
    coinsPill.setAttribute('aria-disabled', isEnabled ? 'false' : 'true');
    if(!isEnabled && coinsMenuModal && !coinsMenuModal.classList.contains('hidden')){
      closeCoinsMenu();
    }
  };

  const renderCoinBalances = ()=>{
    if(coinsCount){
      coinsCount.textContent = String(currentCoins);
    }
    if(coinsMenuBalance){
      coinsMenuBalance.textContent = `Coins: ${currentCoins}`;
    }
    if(racePerkBalance){
      racePerkBalance.textContent = `Coins: ${currentCoins}`;
    }
    if(characterBalance){
      characterBalance.textContent = `Coins: ${currentCoins}`;
    }
  };

  const appendCharacterStatusLine = (container, text, className)=>{
    const line = document.createElement('div');
    line.className = className;
    line.textContent = text;
    container.appendChild(line);
  };

  const renderCharacterButtons = ()=>{
    if(!charGrid){
      return;
    }
    Array.from(charGrid.querySelectorAll('.character-btn')).forEach((button)=>{
      const key = button.getAttribute('data-char') || '';
      const unlockPrice = getUnlockPrice(key);
      const unlocked = isCharacterUnlocked(key);
      const canUnlock = !unlocked && unlockPrice > 0 && currentCoins >= unlockPrice;

      button.classList.toggle('is-locked', !unlocked);
      button.classList.toggle('can-unlock', canUnlock);

      let status = button.querySelector('.character-status');
      if(!status){
        status = document.createElement('div');
        status.className = 'character-status';
        button.appendChild(status);
      }
      status.replaceChildren();

      if(key === 'mystery'){
        appendCharacterStatusLine(status, 'Random unlocked', 'character-status-label');
        return;
      }

      if(unlocked){
        appendCharacterStatusLine(status, unlockPrice > 0 ? 'Unlocked' : 'Starter', 'character-status-label');
        return;
      }

      appendCharacterStatusLine(status, 'Unlock', 'character-status-label');
      appendCharacterStatusLine(status, `${unlockPrice} coins`, 'character-status-price');
    });
  };

  const renderRacePerkButtons = ()=>{
    if(!racePerkPicker){
      return;
    }
    const perkSelectable = getRaceEventMeta(currentEventId).allowsPerks && currentCoins >= DASH_PERK_COST;
    Array.from(racePerkPicker.querySelectorAll('.race-perk-btn')).forEach((btn)=>{
      const perk = btn.getAttribute('data-perk') || 'none';
      const selected = perk === currentRacePerk;
      btn.classList.toggle('is-selected', selected);
      btn.classList.toggle('is-disabled', !perkSelectable);
      btn.disabled = !perkSelectable;
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
  };

  const setRacePerkSelection = (perk)=>{
    currentRacePerk = (perk === 'turbo' || perk === 'speed') ? perk : 'none';
    setPlayerRacePerk(currentRacePerk);
    renderRacePerkButtons();
  };
  const getPerkLabel = (perk)=>perk === 'speed' ? '+Speed' : 'Sprint 4s CD';
  const renderCoinsMenu = (noteOverride='')=>{
    renderCoinBalances();
    if(!coinsMenuPerks || !coinsMenuNote){
      return;
    }
    const dashPerksAvailable = currentEventId === DEFAULT_EVENT_ID;
    const hasActivePerk = currentRacePerk !== 'none';
    const canBuyPerk = dashPerksAvailable && !hasActivePerk && currentCoins >= DASH_PERK_COST;

    if(noteOverride){
      coinsMenuNote.textContent = noteOverride;
    } else if(!dashPerksAvailable){
      coinsMenuNote.textContent = 'Perks are only available in 400m Dash.';
    } else if(hasActivePerk){
      coinsMenuNote.textContent = `${getPerkLabel(currentRacePerk)} is already active for this race.`;
    } else if(currentCoins < DASH_PERK_COST){
      coinsMenuNote.textContent = `You need ${DASH_PERK_COST} coins to buy a perk.`;
    } else {
      coinsMenuNote.textContent = `Spend ${DASH_PERK_COST} coins to activate one perk for this race.`;
    }

    Array.from(coinsMenuPerks.querySelectorAll('.race-perk-btn')).forEach((btn)=>{
      const perk = btn.getAttribute('data-perk') || 'none';
      const selected = perk === currentRacePerk;
      const price = btn.querySelector('.race-perk-price');
      btn.classList.toggle('is-selected', selected);
      btn.classList.toggle('is-disabled', !selected && !canBuyPerk);
      btn.disabled = !canBuyPerk;
      btn.setAttribute('aria-pressed', selected ? 'true' : 'false');
      if(price){
        price.textContent = selected ? 'Active' : `${DASH_PERK_COST} coins`;
      }
    });
  };
  const closeCoinsMenu = ()=>{
    if(coinsMenuModal){
      coinsMenuModal.classList.add('hidden');
    }
    setRacePaused(false);
  };
  const openCoinsMenu = ()=>{
    if(!isRaceActive()){
      return;
    }
    renderCoinsMenu();
    setRacePaused(true);
    if(coinsMenuModal){
      coinsMenuModal.classList.remove('hidden');
    }
  };
  const purchaseRacePerkFromCoinsMenu = (perk)=>{
    if(currentEventId !== DEFAULT_EVENT_ID){
      renderCoinsMenu('Perks are only available in 400m Dash.');
      return;
    }
    if(currentRacePerk !== 'none'){
      renderCoinsMenu(`${getPerkLabel(currentRacePerk)} is already active for this race.`);
      return;
    }
    const didSpendCoins = spendCoins(DASH_PERK_COST);
    currentCoins = getCoins();
    renderCoinBalances();
    if(!didSpendCoins){
      renderCoinsMenu(`You need ${DASH_PERK_COST} coins to buy a perk.`);
      return;
    }
    setRacePerkSelection(perk);
    renderCoinsMenu(`${getPerkLabel(perk)} activated for this race. Tap Back to Race to continue.`);
  };

  const applySelection = (key)=>{
    const selectionKey = characters[key] ? key : 'blue-racer';
    const resolved = (selectionKey === 'mystery') ? pickRandomPlayer() : selectionKey;
    currentPlayerSelectionKey = selectionKey;
    currentPlayerKey = resolved;
    currentOpponentKey = pickOpponentFor(resolved);
    document.querySelectorAll('#character-grid .character-btn').forEach((button)=>button.classList.remove('selected'));
    const selected = document.querySelector(`#character-grid .character-btn[data-char="${selectionKey}"]`);
    if(selected) selected.classList.add('selected');
    if(playerPreview) renderCharacterThumbnail(playerPreview, currentPlayerKey);
    if(computerPreview) renderCharacterThumbnail(computerPreview, currentOpponentKey);
    renderCharacterButtons();
  };

  const setEventSelection = (eventId)=>{
    currentEventId = normalizeEventId(eventId);
    const meta = getRaceEventMeta(currentEventId);
    setRaceEvent(currentEventId);
    setScoreEvent(currentEventId);
    setSecondaryActionType(meta.secondaryActionType);
    refreshControlsHint(false);
    initializeTrackView();

    if(eventGrid){
      Array.from(eventGrid.querySelectorAll('.event-btn')).forEach((button)=>{
        const selected = button.getAttribute('data-event') === currentEventId;
        button.classList.toggle('is-selected', selected);
      });
    }
    renderRacePerkButtons();
  };

  const openEventPicker = ()=>{
    closeCoinsMenu();
    setCoinsPillEnabled(false);
    if(isRaceActive()){
      cancelRace();
    }
    window.gameReady = false;
    if(gameModal) gameModal.classList.add('hidden');
    if(charModal) charModal.classList.add('hidden');
    if(eventModal) eventModal.classList.remove('hidden');
  };

  const openCharacterPicker = ()=>{
    closeCoinsMenu();
    setCoinsPillEnabled(false);
    if(isRaceActive()){
      cancelRace();
    }
    window.gameReady = false;
    renderCoinBalances();
    setCharacterNote(DEFAULT_CHARACTER_NOTE);
    applySelection(currentPlayerSelectionKey);
    if(eventModal) eventModal.classList.add('hidden');
    if(gameModal) gameModal.classList.add('hidden');
    if(charModal) charModal.classList.remove('hidden');
  };

  const handleCharacterChoice = (key)=>{
    const characterKey = characters[key] ? key : 'blue-racer';
    const unlockPrice = getUnlockPrice(characterKey);
    const unlocked = isCharacterUnlocked(characterKey);
    const characterName = (characters[characterKey] && characters[characterKey].name) || 'Racer';

    if(!unlocked){
      if(currentCoins < unlockPrice){
        setCharacterNote(`Need ${unlockPrice} coins to unlock ${characterName}.`, 'warning');
        renderCharacterButtons();
        return;
      }

      const didSpendCoins = spendCoins(unlockPrice);
      currentCoins = getCoins();
      renderCoinBalances();
      if(!didSpendCoins){
        setCharacterNote(`Need ${unlockPrice} coins to unlock ${characterName}.`, 'warning');
        renderCharacterButtons();
        return;
      }

      unlockCharacter(characterKey);
      setCharacterNote(`${characterName} unlocked!`, 'success');
      renderCharacterButtons();
    }

    applySelection(characterKey);
    if(charModal) charModal.classList.add('hidden');
    openPreRaceModal();
  };

  const openPreRaceModal = ()=>{
    closeCoinsMenu();
    setCoinsPillEnabled(true);
    const meta = getRaceEventMeta(currentEventId);
    setRacePerkSelection('none');
    renderCoinBalances();
    if(modalTitle){
      modalTitle.textContent = meta.name;
      modalTitle.className = 'text-sm sm:text-lg font-bold text-yellow-300 mb-1 text-center';
      modalTitle.style.textShadow = '2px 2px #000';
    }
    if(modalText){
      modalText.textContent = meta.preRaceText;
      modalText.className = 'text-xs sm:text-sm text-white mb-1 text-center px-2 opacity-95';
    }
    if(controlsHint){
      controlsHint.textContent = meta.controlsHint;
    }
    setStartButton('prerace');
    setVisible(raceTimeDisplay, false);
    setVisible(resultsStack, false);
    setVisible(racePerkWrap, meta.allowsPerks);
    setVisible(controlsHint, true);
    renderRacePerkButtons();
    if(gameModal){ gameModal.classList.remove('results-open'); }
    if(eventModal) eventModal.classList.add('hidden');
    if(charModal) charModal.classList.add('hidden');
    if(gameModal) gameModal.classList.remove('hidden');
    window.gameReady = true;
  };

  const openResultsModal = (ms, standings)=>{
    closeCoinsMenu();
    setCoinsPillEnabled(true);
    const meta = getRaceEventMeta(currentEventId);
    const playerEntry = standings.find((entry)=>entry.isPlayer) || null;
    const playerWon = playerEntry ? playerEntry.place === 1 : false;
    const placingText = playerEntry ? ordinal(playerEntry.place) : 'finished';
    const rewardCoins = playerEntry ? getCoinRewardForPlace(playerEntry.place) : 0;
    const rewardText = rewardCoins > 0
      ? ` Earned ${rewardCoins} coin${rewardCoins === 1 ? '' : 's'}.`
      : '';

    if(modalTitle){
      modalTitle.textContent = meta.resultTitle;
      modalTitle.className = 'text-sm sm:text-lg font-bold text-yellow-300 mb-1 text-center';
      modalTitle.style.textShadow = '2px 2px #000';
    }
    if(modalText){
      modalText.textContent = `${playerWon ? 'You won.' : 'You lost.'} Finished ${placingText}.${rewardText}`;
      modalText.className = 'text-xs sm:text-sm text-white mb-1 text-center px-2 opacity-95';
    }
    if(finalRaceTime){
      finalRaceTime.textContent = (ms / 1000).toFixed(2) + 's';
    }
    setRacePerkSelection('none');
    renderCoinBalances();
    setStartButton('results');
    setVisible(raceTimeDisplay, true);
    setVisible(resultsStack, true);
    setVisible(racePerkWrap, false);
    setVisible(controlsHint, false);
    if(eventModal) eventModal.classList.add('hidden');
    if(charModal) charModal.classList.add('hidden');
    if(gameModal){ gameModal.classList.add('results-open'); }
    if(gameModal) gameModal.classList.remove('hidden');
    window.gameReady = false;
  };

  updateRunnerAppearance(playerEl, currentPlayerKey);
  updateRunnerAppearance(computerEl, currentOpponentKey);
  applySelection(currentPlayerSelectionKey);
  renderCoinBalances();
  setCoinsPillEnabled(false);
  setCharacterNote(DEFAULT_CHARACTER_NOTE);
  setRacePerkSelection(currentRacePerk);
  setEventSelection(currentEventId);
  updateCrowdSignText('GO RACER');
  initCrowdAnimation();
  wireKeyboard();
  wireTouch();
  wireGamepad();
  wireMobileButtons();
  wireMobileViewport();
  window.initializeHighScores = initializeHighScores;
  initializeHighScores();

  if(scoresBtn){
    scoresBtn.addEventListener('click', async ()=>{
      showHighScoresModal(currentEventId);
    });
  }
  if(coinsPill){
    coinsPill.addEventListener('click', ()=>{
      if(coinsMenuModal && !coinsMenuModal.classList.contains('hidden')){
        closeCoinsMenu();
        return;
      }
      openCoinsMenu();
    });
  }
  if(changeEventBtn){ changeEventBtn.addEventListener('click', openEventPicker); }
  if(changeBtnHeader){ changeBtnHeader.addEventListener('click', openCharacterPicker); }
  if(changeBtn){ changeBtn.addEventListener('click', openCharacterPicker); }
  if(changeFooterBtn){ changeFooterBtn.addEventListener('click', openCharacterPicker); }
  if(modalClose){ modalClose.addEventListener('click', closeHighScoresModal); }
  if(modalToggle){ modalToggle.addEventListener('click', toggleModalScoreView); }
  if(coinsMenuCloseBtn){
    coinsMenuCloseBtn.addEventListener('click', closeCoinsMenu);
  }
  if(coinsMenuModal){
    coinsMenuModal.addEventListener('click', (e)=>{
      if(e.target === coinsMenuModal){
        closeCoinsMenu();
      }
    });
  }
  if(coinsMenuPerks){
    coinsMenuPerks.addEventListener('click', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.race-perk-btn') : null;
      if(!button) return;
      const perk = button.getAttribute('data-perk');
      if(!perk) return;
      purchaseRacePerkFromCoinsMenu(perk);
    });
  }

  if(eventGrid && !eventGrid.dataset.bound){
    eventGrid.dataset.bound = '1';
    eventGrid.addEventListener('click', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.event-btn') : null;
      if(!button) return;
      const eventId = button.getAttribute('data-event');
      setEventSelection(eventId || DEFAULT_EVENT_ID);
      openCharacterPicker();
    });
  }

  if(charGrid && !charGrid.dataset.bound){
    charGrid.dataset.bound = '1';
    charGrid.addEventListener('click', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.character-btn') : null;
      if(!button) return;
      const key = button.getAttribute('data-char');
      if(!key) return;
      applySelection(key);
      handleCharacterChoice(key);
    });
  }

  if(racePerkPicker && !racePerkPicker.dataset.bound){
    racePerkPicker.dataset.bound = '1';
    racePerkPicker.addEventListener('click', (e)=>{
      const button = (e.target instanceof Element) ? e.target.closest('.race-perk-btn') : null;
      if(!button || button.disabled) return;
      const perk = button.getAttribute('data-perk');
      setRacePerkSelection(perk === currentRacePerk ? 'none' : (perk || 'none'));
    });
  }

  window.addEventListener('keydown', (e)=>{
    const inEventSelect = eventModal && !eventModal.classList.contains('hidden');
    const inCharacterSelect = charModal && !charModal.classList.contains('hidden');
    const key = e.key;
    const code = e.code || '';
    const enter = key === 'Enter' || key === '5' || code === 'Numpad5';

    if(inEventSelect && enter){
      e.preventDefault();
      openCharacterPicker();
      return;
    }

    if(inCharacterSelect && enter){
      e.preventDefault();
      handleCharacterChoice(currentPlayerSelectionKey);
    }
  });

  const wireGamepadUI = ()=>{
    let padIndex = -1;
    let prev = { a: false, left: false, right: false, b: false };
    let eventIdx = 0;
    let charIdx = 0;
    let uiFocus = 0;
    const focusTargets = ()=>[startBtn, changeFooterBtn].filter(Boolean);
    const getButtons = (pad)=>{
      const buttons = pad.buttons || [];
      return {
        a: !!(buttons[0] && (buttons[0].pressed || buttons[0].value > 0.5)),
        b: !!(buttons[1] && (buttons[1].pressed || buttons[1].value > 0.5)),
        left: !!(buttons[14] && (buttons[14].pressed || buttons[14].value > 0.5)),
        right: !!(buttons[15] && (buttons[15].pressed || buttons[15].value > 0.5))
      };
    };
    const highlightFocus = ()=>{
      if(!gameModal || gameModal.classList.contains('hidden')) return;
      focusTargets().forEach((el)=>el.classList.remove('ring-2', 'ring-yellow-300'));
      const target = focusTargets()[uiFocus];
      if(target) target.classList.add('ring-2', 'ring-yellow-300');
    };

    window.addEventListener('gamepadconnected', (e)=>{
      padIndex = (e.gamepad && typeof e.gamepad.index === 'number') ? e.gamepad.index : 0;
    });
    window.addEventListener('gamepaddisconnected', ()=>{
      padIndex = -1;
    });

    const poll = ()=>{
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      const pad = (padIndex >= 0 ? pads[padIndex] : pads[0]) || null;
      if(pad){
        const btns = getButtons(pad);
        const inEvent = eventModal && !eventModal.classList.contains('hidden');
        const inChar = charModal && !charModal.classList.contains('hidden');
        const inGame = gameModal && !gameModal.classList.contains('hidden');

        if(inEvent && eventGrid){
          const items = Array.from(eventGrid.querySelectorAll('.event-btn'));
          if(items.length){
            if(btns.left && !prev.left){ eventIdx = Math.max(0, eventIdx - 1); }
            if(btns.right && !prev.right){ eventIdx = Math.min(items.length - 1, eventIdx + 1); }
            const selected = items[eventIdx];
            const eventId = selected && selected.getAttribute('data-event');
            if(eventId){ setEventSelection(eventId); }
            if(btns.a && !prev.a){
              openCharacterPicker();
            }
          }
        } else if(inChar && charGrid){
          const items = Array.from(charGrid.querySelectorAll('.character-btn'));
          if(items.length){
            const cols = 3;
            const currentEl = charGrid.querySelector('.character-btn.selected') || items[charIdx];
            let idx = items.indexOf(currentEl);
            if(idx < 0) idx = 0;
            charIdx = idx;
            if(btns.left && !prev.left && charIdx % cols > 0){ charIdx--; }
            if(btns.right && !prev.right && charIdx % cols < cols - 1 && charIdx + 1 < items.length){ charIdx++; }
            const el = items[charIdx];
            const key = el && el.getAttribute('data-char');
            if(key) applySelection(key);
            if(btns.a && !prev.a){
              handleCharacterChoice(key || currentPlayerSelectionKey);
            }
            if(btns.b && !prev.b){
              openEventPicker();
            }
          }
        } else if(inGame){
          highlightFocus();
          if(btns.left && !prev.left){
            uiFocus = Math.max(0, uiFocus - 1);
            highlightFocus();
          }
          if(btns.right && !prev.right){
            uiFocus = Math.min(Math.max(0, focusTargets().length - 1), uiFocus + 1);
            highlightFocus();
          }
          if(btns.a && !prev.a){
            const target = focusTargets()[uiFocus];
            if(target) target.click();
          }
        }
        prev = btns;
      }
      requestAnimationFrame(poll);
    };
    poll();
  };

  wireGamepadUI();

  if(startBtn && !startBtn.dataset.bound){
    startBtn.dataset.bound = '1';
    startBtn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(currentEventId === DEFAULT_EVENT_ID && currentRacePerk !== 'none'){
        const didSpendCoins = spendCoins(DASH_PERK_COST);
        currentCoins = getCoins();
        renderCoinBalances();
        if(!didSpendCoins){
          setRacePerkSelection('none');
          if(modalText){
            modalText.textContent = `You need ${DASH_PERK_COST} coins to use a race perk.`;
            modalText.className = 'text-xs sm:text-sm text-white mb-1 text-center px-2 opacity-95';
          }
          return;
        }
        renderRacePerkButtons();
      }
      updateRunnerAppearance(playerEl, currentPlayerKey);
      updateRunnerAppearance(computerEl, currentOpponentKey);
      const playerName = (characters[currentPlayerKey] && characters[currentPlayerKey].name) || 'Racer';
      updateCrowdSignText('GO ' + playerName.toUpperCase());
      setRaceEvent(currentEventId);
      setScoreEvent(currentEventId);
      setPlayerRacePerk(currentRacePerk);
      if(gameModal) gameModal.classList.add('hidden');
      window.gameReady = false;
      startGame();
    });
  }

  document.addEventListener('raceFinished', async (ev)=>{
    const ms = ev.detail?.timeMs || 0;
    const playerFinished = !!ev.detail?.playerFinished;
    const standings = ev.detail?.standings || [];
    const playerEntry = standings.find((entry)=>entry.isPlayer) || null;
    const rewardCoins = playerFinished && playerEntry ? getCoinRewardForPlace(playerEntry.place) : 0;
    currentCoins = rewardCoins > 0 ? addCoins(rewardCoins) : getCoins();
    renderCoinBalances();
    if(playerFinished){
      await saveHighScore(ms, currentEventId);
    }
    renderPodium(standings);
    await renderResultsBestTimes(currentEventId);
    openResultsModal(ms, standings);
  });
  document.addEventListener('raceStarted', ()=>{
    setCoinsPillEnabled(false);
  });

  openEventPicker();
}

document.addEventListener('DOMContentLoaded', init);
