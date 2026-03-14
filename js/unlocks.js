const UNLOCKS_STORAGE_KEY = 'track-race:unlocked-characters';

const DEFAULT_UNLOCKED_CHARACTERS = ['blue-racer', 'mystery'];

const UNLOCK_COSTS = {
  'blue-racer': 0,
  'mystery': 0,
  'red-racer': 5,
  'capybara': 5,
  'dragon': 10,
  'gorilla': 10,
  'dinosaur': 10,
  'dog': 15,
  'cat': 15,
  'cow': 15
};

function normalizeUnlockedCharacters(value){
  const knownCharacters = new Set(Object.keys(UNLOCK_COSTS));
  const unlockedCharacters = new Set(DEFAULT_UNLOCKED_CHARACTERS);
  (Array.isArray(value) ? value : []).forEach((characterKey)=>{
    if(knownCharacters.has(characterKey)){
      unlockedCharacters.add(characterKey);
    }
  });
  return Array.from(unlockedCharacters);
}

function readUnlockedCharacters(){
  try{
    const rawValue = window.localStorage.getItem(UNLOCKS_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];
    return normalizeUnlockedCharacters(parsedValue);
  }catch{
    return normalizeUnlockedCharacters([]);
  }
}

function writeUnlockedCharacters(characterKeys){
  const normalizedCharacters = normalizeUnlockedCharacters(characterKeys);
  try{
    window.localStorage.setItem(UNLOCKS_STORAGE_KEY, JSON.stringify(normalizedCharacters));
  }catch{
    // Ignore storage failures and return the normalized state for callers.
  }
  return normalizedCharacters;
}

export function getUnlockPrice(characterKey){
  return UNLOCK_COSTS[characterKey] || 0;
}

export function isCharacterUnlocked(characterKey){
  return getUnlockPrice(characterKey) === 0 || readUnlockedCharacters().includes(characterKey);
}

export function getUnlockedCharacterKeys(){
  return readUnlockedCharacters();
}

export function unlockCharacter(characterKey){
  if(getUnlockPrice(characterKey) === 0){
    return true;
  }
  const unlockedCharacters = new Set(readUnlockedCharacters());
  unlockedCharacters.add(characterKey);
  writeUnlockedCharacters(Array.from(unlockedCharacters));
  return true;
}
