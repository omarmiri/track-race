export const EVENT_DASH = 'dash';
export const EVENT_HURDLES = 'hurdles';
export const DEFAULT_EVENT_ID = EVENT_DASH;

const EVENT_DEFS = {
  [EVENT_DASH]: {
    id: EVENT_DASH,
    name: '400m Dash',
    shortName: 'Dash',
    secondaryActionType: 'turbo',
    secondaryActionLabel: 'Sprint',
    gamepadHint: 'Use Gamepad: A=Run, X/RT=Sprint',
    controlsHint: 'Touch buttons or use SPACE/G keys',
    menuDescription: 'Classic one-lap sprint with stamina, sprint bursts, and race perks.',
    preRaceText: 'Ready for the 400m dash?',
    resultTitle: '400m Dash Results',
    scoreGameName: 'track-race-400m-dash',
    localScoreKey: 'track-race-400m-dash:personal-scores',
    allowsPerks: true
  },
  [EVENT_HURDLES]: {
    id: EVENT_HURDLES,
    name: '400m Hurdles',
    shortName: 'Hurdles',
    secondaryActionType: 'jump',
    secondaryActionLabel: 'Jump',
    gamepadHint: 'Use Gamepad: A=Run, X/RT=Jump',
    controlsHint: 'Touch buttons or use SPACE/G keys',
    menuDescription: 'Ten hurdles over one lap. Keep your rhythm and clear every barrier.',
    preRaceText: 'Clear all 10 hurdles and keep your rhythm.',
    resultTitle: '400m Hurdles Results',
    scoreGameName: 'track-race-400m-hurdles',
    localScoreKey: 'track-race-400m-hurdles:personal-scores',
    allowsPerks: false
  }
};

export function normalizeEventId(eventId){
  return eventId === EVENT_HURDLES ? EVENT_HURDLES : EVENT_DASH;
}

export function getRaceEventMeta(eventId){
  return EVENT_DEFS[normalizeEventId(eventId)];
}

export function getAllRaceEvents(){
  return [EVENT_DEFS[EVENT_DASH], EVENT_DEFS[EVENT_HURDLES]];
}
