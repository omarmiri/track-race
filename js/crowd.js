let crowdTextEls = [];
const crowdColors = ['blue', 'red', 'green', 'orange', 'purple', 'pink'];
let crowdColorIndex = 0;

function fitCrowdText(el){
  if(!el || el.style.display === 'none') return;
  const boxW = el.clientWidth;
  const boxH = el.clientHeight;
  if(boxW <= 0 || boxH <= 0) return;
  el.style.fontSize = Math.max(8, Math.floor(boxH * 0.7)) + 'px';
  const scrollW = el.scrollWidth;
  const currentSize = parseFloat(getComputedStyle(el).fontSize) || 12;
  if(scrollW > boxW){
    const ratio = boxW / scrollW;
    const newSize = Math.max(8, Math.floor(currentSize * ratio * 0.98));
    el.style.fontSize = newSize + 'px';
  }
}

function forEachCrowdText(fn){
  for(const el of crowdTextEls){
    if(el){ fn(el); }
  }
}

function ensureCrowdTextEls(parent, count, defaultText){
  while(crowdTextEls.length < count){
    const text = document.createElement('div');
    text.className = 'crowd-frame-text';
    text.textContent = defaultText;
    text.style.display = 'none';
    text.style.color = crowdColors[crowdColorIndex];
    parent.appendChild(text);
    crowdTextEls.push(text);
  }

  while(crowdTextEls.length > count){
    const text = crowdTextEls.pop();
    if(text && text.parentNode){
      text.parentNode.removeChild(text);
    }
  }
}

export function updateCrowdSignText(text){
  const nextText = text || (crowdTextEls[0] && crowdTextEls[0].textContent) || 'GO RACER';
  forEachCrowdText((el)=>{
    el.textContent = nextText;
    fitCrowdText(el);
  });
}

export function initCrowdAnimation(){
  const crowdSpriteEl = document.getElementById('crowd-sprite');
  if(!crowdSpriteEl) return;

  const trackAreaEl = document.getElementById('track-area');
  const trackWorldEl = document.getElementById('track-world');
  const crowdAreaEl = document.getElementById('crowd-area');
  const gameContainerEl = document.getElementById('game-container');

  const img = new Image();
  img.src = './assets/images/backgrounds/bleachers.png';
  img.onload = ()=>{
    const frames = 3;
    const sheetWidth = img.width;
    const sheetHeight = img.height;
    const frameHeight = Math.floor(sheetHeight / frames);
    const poster = { x1: 340, y1: 399, x2: 600, y2: 436, frameIndex: 1 };

    function sizeCrowdSprite(currentFrame = 0){
      const trackWidth = (trackWorldEl && trackWorldEl.clientWidth) || (trackAreaEl && trackAreaEl.clientWidth) || (crowdAreaEl && crowdAreaEl.clientWidth) || (gameContainerEl && gameContainerEl.clientWidth) || sheetWidth;
      const targetHeight = Math.max(84, Math.min(120, Math.floor(((trackAreaEl && trackAreaEl.clientHeight) || 420) * 0.25)));
      const scale = targetHeight / Math.max(1, frameHeight);
      const scaledFrameHeight = Math.max(1, Math.floor(frameHeight * scale));
      const scaledSheetHeight = Math.max(1, Math.floor(sheetHeight * scale));
      const scaledTileWidth = Math.max(1, Math.floor(sheetWidth * scale));

      crowdSpriteEl.style.width = trackWidth + 'px';
      if(crowdAreaEl){ crowdAreaEl.style.width = trackWidth + 'px'; }
      crowdSpriteEl.style.height = scaledFrameHeight + 'px';
      crowdSpriteEl.style.backgroundImage = "url('./assets/images/backgrounds/bleachers.png')";
      crowdSpriteEl.style.backgroundRepeat = 'repeat-x';
      crowdSpriteEl.style.backgroundSize = `${scaledTileWidth}px ${scaledSheetHeight}px`;
      crowdSpriteEl.style.backgroundPosition = `0px ${-currentFrame * scaledFrameHeight}px`;
      crowdSpriteEl.style.imageRendering = 'pixelated';

      const posterYRelative = poster.y1 - (frameHeight * poster.frameIndex);
      const posterXScaled = Math.floor(poster.x1 * scale);
      const posterYScaled = Math.floor(posterYRelative * scale);
      const posterWScaled = Math.floor((poster.x2 - poster.x1) * scale);
      const posterHScaled = Math.floor((poster.y2 - poster.y1) * scale);

      const tileCount = Math.max(1, Math.ceil(trackWidth / scaledTileWidth) + 1);
      const currentText = (crowdTextEls[0] && crowdTextEls[0].textContent) || 'GO RACER';
      ensureCrowdTextEls(crowdSpriteEl, tileCount, currentText);

      const isPosterFrame = currentFrame === poster.frameIndex;
      for(let i = 0; i < crowdTextEls.length; i++){
        const el = crowdTextEls[i];
        if(!el) continue;

        const left = Math.floor((i * scaledTileWidth) + posterXScaled);
        const right = left + posterWScaled;
        const visible = isPosterFrame && right > 0 && left < trackWidth;
        if(!visible){
          el.style.display = 'none';
          continue;
        }

        el.style.display = 'flex';
        el.style.left = left + 'px';
        el.style.top = posterYScaled + 'px';
        el.style.width = posterWScaled + 'px';
        el.style.height = posterHScaled + 'px';
        el.style.maxWidth = posterWScaled + 'px';
        el.style.fontSize = Math.max(8, Math.floor(posterHScaled * 0.7)) + 'px';
        fitCrowdText(el);
      }
    }

    let frame = 0;
    sizeCrowdSprite(frame);
    setInterval(()=>{
      frame = (frame + 1) % frames;
      sizeCrowdSprite(frame);
      crowdColorIndex = (crowdColorIndex + 1) % crowdColors.length;
      const nextColor = crowdColors[crowdColorIndex];
      forEachCrowdText((el)=>{ el.style.color = nextColor; });
    }, 750);

    window.addEventListener('resize', ()=> sizeCrowdSprite(frame));
  };
}
