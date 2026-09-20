import petMotion from '../assets/pet/motion.json';

const petAtlases = {
  'click-reaction': new URL('../assets/pet/atlases/click-reaction-atlas.png', import.meta.url).href,
  'drag-held': new URL('../assets/pet/atlases/drag-held-atlas.png', import.meta.url).href,
  'happy-hop': new URL('../assets/pet/atlases/happy-hop-atlas.png', import.meta.url).href,
  'idle-breathe': new URL('../assets/pet/atlases/idle-breathe-atlas.png', import.meta.url).href,
  'new-message-alert': new URL('../assets/pet/atlases/new-message-alert-atlas.png', import.meta.url).href,
  'pointer-follow': new URL('../assets/pet/atlases/pointer-follow-atlas.png', import.meta.url).href,
  'response-complete': new URL('../assets/pet/atlases/response-complete-atlas.png', import.meta.url).href,
  'sleep-transition': new URL('../assets/pet/atlases/sleep-transition-atlas.png', import.meta.url).href,
  typing: new URL('../assets/pet/atlases/typing-atlas.png', import.meta.url).href,
  'waiting-reply': new URL('../assets/pet/atlases/waiting-reply-atlas.png', import.meta.url).href,
  'walk-cycle': new URL('../assets/pet/atlases/walk-cycle-atlas.png', import.meta.url).href,
  'wave-hello': new URL('../assets/pet/atlases/wave-hello-atlas.png', import.meta.url).href
};

const defaultFrameSequence = Object.freeze(petMotion.defaultSequence);
const calmIdleSequence = Object.freeze(petMotion.idleSequence);
const petFrameIntervals = Object.freeze(petMotion.intervals);

function getPetFrameInterval(action) {
  return petFrameIntervals[action] || 180;
}

function getPetFrameSequence(action) {
  return action === 'idle-breathe' ? calmIdleSequence : defaultFrameSequence;
}

export {
  calmIdleSequence,
  getPetFrameInterval,
  getPetFrameSequence,
  petAtlases,
  petFrameIntervals
};
