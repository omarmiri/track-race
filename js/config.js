export let BASE_PLAYER_ACCELERATION = 20;
export let BASE_CPU_SPEED = 45;
export let BASE_CPU_SPEED_VARIATION = 8;
export let BASE_TURBO_BOOST = 35;

export const FRICTION = 0.985;
export const FRICTION_PER_SECOND = 0.75;
export const TURBO_DURATION = 1000;
export const TURBO_COOLDOWN = 5000;
export const FINISH_LINE_PERCENT = 90;
export const TRACK_DISTANCE_UNITS = 100;
export const TARGET_RACE_TIME_S = 3.6;

export function setBasePlayerAcceleration(v){ BASE_PLAYER_ACCELERATION = Math.max(1, Math.min(100, Number(v) || 20)); }
export function setBaseCpuSpeed(v){ BASE_CPU_SPEED = Math.max(5, Math.min(200, Number(v) || 45)); }
export function getBasePlayerAcceleration(){ return BASE_PLAYER_ACCELERATION; }
export function getBaseCpuSpeed(){ return BASE_CPU_SPEED; }
