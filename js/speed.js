import { BASE_PLAYER_ACCELERATION, BASE_CPU_SPEED, BASE_CPU_SPEED_VARIATION, BASE_TURBO_BOOST } from './config.js';

export function getSpeedMultiplier(){
  const ua = (navigator && typeof navigator.userAgent==='string') ? navigator.userAgent : '';
  const uaDataMobile = (navigator && navigator.userAgentData && typeof navigator.userAgentData.mobile==='boolean') ? navigator.userAgentData.mobile : null;
  const isIos = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = (uaDataMobile===true) || isIos || isAndroid;
  return isMobile ? 0.90 : 0.86;
}

export let PLAYER_ACCELERATION;
export let CPU_BASE_SPEED;
export let CPU_SPEED_VARIATION;
export let TURBO_BOOST_AMOUNT;

export function updateSpeedConstants(){
  const m = getSpeedMultiplier();
  PLAYER_ACCELERATION = BASE_PLAYER_ACCELERATION * m;
  CPU_BASE_SPEED = BASE_CPU_SPEED * m;
  CPU_SPEED_VARIATION = BASE_CPU_SPEED_VARIATION * m;
  TURBO_BOOST_AMOUNT = BASE_TURBO_BOOST * m;
}
