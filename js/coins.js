const COINS_STORAGE_KEY = 'track-race:coins';

function readStoredCoins(){
  try{
    const rawValue = window.localStorage.getItem(COINS_STORAGE_KEY);
    const parsedValue = Number.parseInt(rawValue || '0', 10);
    return Number.isFinite(parsedValue) && parsedValue > 0 ? parsedValue : 0;
  }catch{
    return 0;
  }
}

export function getCoins(){
  return readStoredCoins();
}

export function setCoins(value){
  const nextValue = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  try{
    window.localStorage.setItem(COINS_STORAGE_KEY, String(nextValue));
  }catch{
    // Ignore storage failures and fall back to in-memory callers.
  }
  return nextValue;
}

export function addCoins(amount){
  return setCoins(getCoins() + Math.max(0, Math.floor(amount || 0)));
}

export function spendCoins(amount){
  const cost = Math.max(0, Math.floor(amount || 0));
  const currentBalance = getCoins();
  if(cost <= 0){
    return true;
  }
  if(currentBalance < cost){
    return false;
  }
  setCoins(currentBalance - cost);
  return true;
}

export function getCoinRewardForPlace(place){
  if(place === 1){
    return 5;
  }
  if(place === 2){
    return 3;
  }
  if(place === 3){
    return 1;
  }
  return 0;
}
