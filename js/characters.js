export const characters = {
  'blue-racer': { emoji: '🏃‍♂️', name: 'Blue Racer', type: 'bipedal', colors: { primary: '#3b82f6', secondary: '#1e3a8a', accent: '#facc15' }, features: { head: 'round', ears: false, tail: false, wings: false } },
  'red-racer': { emoji: '🏃‍♀️', name: 'Red Racer', type: 'bipedal', colors: { primary: '#ef4444', secondary: '#991b1b', accent: '#facc15' }, features: { head: 'round', ears: false, tail: false, wings: false } },
  'dragon': { emoji: '🐉', name: 'Dragon', type: 'bipedal', colors: { primary: '#7c3aed', secondary: '#4c1d95', accent: '#fbbf24' }, features: { head: 'long', ears: false, tail: true, wings: true }, sprite: { src: './assets/images/sprites/dragon-flying-mess.png', frameWidth: 64, frameHeight: 64, frames: 8, cols: 8, rows: 1, animationSpeed: 100 } },
  'gorilla': { emoji: '🦍', name: 'Gorilla', type: 'bipedal', colors: { primary: '#374151', secondary: '#111827', accent: '#6b7280' }, features: { head: 'round', ears: true, tail: false, wings: false }, sprite: { src: './assets/images/sprites/gorilla-sprite-sheet-final.png', frameWidth: 64, frameHeight: 64, frames: 28, cols: 2, rows: 14, animationSpeed: 100 } },
  'dinosaur': { emoji: '🦕', name: 'Dinosaur', type: 'bipedal', colors: { primary: '#16a34a', secondary: '#14532d', accent: '#22c55e' }, features: { head: 'long', ears: false, tail: true, wings: false }, sprite: { src: './assets/images/sprites/dinosaur-dash-sprite.png', frameWidth: 64, frameHeight: 64, frames: 9, cols: 3, rows: 3, animationSpeed: 150 } },
  'capybara': { emoji: '🦫', name: 'Capybara', type: 'quadruped', scale: 0.72, thumbnailScale: 0.78, colors: { primary: '#92400e', secondary: '#451a03', accent: '#d97706' }, features: { head: 'round', ears: true, tail: false, wings: false } },
  'dog': { emoji: '🐕', name: 'Dog', type: 'quadruped', colors: { primary: '#ea580c', secondary: '#9a3412', accent: '#fb923c' }, features: { head: 'long', ears: true, tail: true, wings: false }, sprite: { src: './assets/images/sprites/dog-sprite-sheet.png', frameWidth: 64, frameHeight: 64, frames: 8, cols: 4, rows: 2, animationSpeed: 50 } },
  'cat': { emoji: '🐱', name: 'Cat', type: 'quadruped', colors: { primary: '#ec4899', secondary: '#be185d', accent: '#f472b6' }, features: { head: 'round', ears: true, tail: true, wings: false }, sprite: { src: './assets/images/sprites/cat-run-sprite-sheet.png', frameWidth: 64, frameHeight: 64, frames: 6, cols: 3, rows: 2, animationSpeed: 50 } },
  'cow': { emoji: '🐄', name: 'Cow', type: 'quadruped', colors: { primary: '#6366f1', secondary: '#3730a3', accent: '#a5b4fc' }, features: { head: 'round', ears: true, tail: true, wings: false } },
  'mystery': { emoji: '❓', name: 'Mystery', type: 'bipedal', colors: { primary: '#8b5cf6', secondary: '#7c3aed', accent: '#a78bfa' }, features: { head: 'round', ears: false, tail: false, wings: false } }
};

function clearExisting(container){ const existing = container.querySelector('.sprite-body'); if(existing && existing.dataset.animationInterval){ clearInterval(parseInt(existing.dataset.animationInterval)); } container.innerHTML=''; }

function addSpeedLines(container){ const el=document.createElement('div'); el.className='speed-lines absolute inset-0 opacity-0'; el.innerHTML='<div class="absolute top-1/4 left-0 w-3 h-0.5 bg-white opacity-60 rounded-full"></div><div class="absolute top-1/2 left-1 w-4 h-0.5 bg-white opacity-40 rounded-full"></div><div class="absolute top-3/4 left-0 w-2 h-0.5 bg-white opacity-50 rounded-full"></div>'; container.appendChild(el); }

function addShadow(container, type){ const el=document.createElement('div'); el.className = (type==='bipedal') ? 'shadow absolute w-16 h-2 bg-black opacity-20 rounded-full' : 'shadow absolute w-20 h-2 bg-black opacity-20 rounded-full'; el.style.bottom='-14px'; el.style.left='50%'; el.style.transform='translateX(-50%)'; container.appendChild(el); }

function addDust(container){ const el=document.createElement('div'); el.className='dust-cloud absolute opacity-0'; el.innerHTML='<div class="absolute w-1 h-1 bg-yellow-600 opacity-60 rounded-full" style="bottom: -20px; left: -5px;"></div><div class="absolute w-1 h-1 bg-yellow-700 opacity-40 rounded-full" style="bottom: -18px; left: -8px;"></div><div class="absolute w-1 h-1 bg-yellow-600 opacity-50 rounded-full" style="bottom: -22px; left: -3px;"></div>'; container.appendChild(el); }

export function createEmojiCharacter(runnerEl, character, key){
 const container = runnerEl;
 clearExisting(container);
 const spriteFacesRight = (key==='dinosaur' || key==='dog' || key==='cat' || key==='gorilla' || key==='dragon');
 const baseFlip = spriteFacesRight ? 1 : -1;
 container.style.setProperty('--runner-flip', '1');
 container.style.setProperty('--sprite-base-flip', String(baseFlip));
 if(character.sprite){
  const spriteBody=document.createElement('div');
  spriteBody.className='sprite-body absolute inset-0 flex items-center justify-center';
  spriteBody.style.zIndex='10';
  spriteBody.style.backgroundImage = `url(${character.sprite.src})`;
  spriteBody.style.backgroundRepeat='no-repeat';
  const cols=character.sprite.cols; const rows=character.sprite.rows;
  let fw=character.sprite.frameWidth; let fh=character.sprite.frameHeight;
  const setup=(w,h,sw,sh)=>{
   spriteBody.style.width=w+'px';
   spriteBody.style.height=h+'px';
   spriteBody.style.backgroundSize=`${sw}px ${sh}px`;
   let current=0;
   const animate=()=>{ const col=current%cols; const row=Math.floor(current/cols); const x=-col*w; const y=-row*h; spriteBody.style.backgroundPosition=`${x}px ${y}px`; current=(current+1)%character.sprite.frames; };
   const id=setInterval(animate, character.sprite.animationSpeed);
   spriteBody.dataset.animationInterval=id;
   container.appendChild(spriteBody);
  };
  setup(fw || 64, fh || 64, (fw || 64)*cols, (fh || 64)*rows);
 } else {
  container.style.setProperty('--sprite-base-flip', '-1');
  const emojiBody=document.createElement('div');
  emojiBody.className='emoji-body absolute inset-0 flex items-center justify-center text-6xl sm:text-7xl';
  emojiBody.textContent=character.emoji;
  emojiBody.style.zIndex='10';
  container.appendChild(emojiBody);
 }
 addSpeedLines(container);
 addShadow(container, character.type);
 addDust(container);
}

export function updateRunnerAppearance(runnerEl, characterKey){ const character = characters[characterKey] || characters['blue-racer']; if(runnerEl){ runnerEl.dataset.characterKey = characterKey; } createEmojiCharacter(runnerEl, character, characterKey); }

export function renderCharacterThumbnail(container, key){ const character=characters[key]||characters['blue-racer']; container.innerHTML=''; if(character.sprite){ const fw=character.sprite.frameWidth||64; const fh=character.sprite.frameHeight||64; const cols=character.sprite.cols; const rows=character.sprite.rows; const div=document.createElement('div'); div.style.width=fw+'px'; div.style.height=fh+'px'; div.style.backgroundImage=`url(${character.sprite.src})`; div.style.backgroundSize=`${fw*cols}px ${fh*rows}px`; div.style.backgroundPosition='0px 0px'; div.style.backgroundRepeat='no-repeat'; div.style.transform='scale(0.75)'; container.appendChild(div); } else { const emoji=document.createElement('div'); emoji.textContent=character.emoji||'🏃'; emoji.className='text-3xl'; container.appendChild(emoji); } }





