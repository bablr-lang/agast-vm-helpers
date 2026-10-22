import { freezeRecord } from '@bablr/agast-helpers/object';

export const effectsFor = (verb) => {
  switch (verb) {
    case 'eat':
    case 'shift':
    case 'eatHeld':
      return { success: 'eat', failure: 'fail' };

    case 'eatMatch':
    case 'shiftMatch':
      return { success: 'eat', failure: 'none' };

    case 'match':
      return { success: 'none', failure: 'none' };

    case 'guard':
      return { success: 'fail', failure: 'none' };

    default:
      throw new Error('invalid match verb');
  }
};

export const isShiftVerb = (sym) => {
  return ['shift', 'shiftMatch'].includes(sym.description);
};

export const reifyBablrOptions = (str) => {
  if (str.length !== 5) throw new Error();

  let shift = !str.includes('S');
  let bind = str.includes('b');
  let allowEmpty = str.includes('e');
  let escape = str.includes('p');
  let internal = str.includes('i');

  return freezeRecord({ shift, bind, allowEmpty, escape, internal });
};

export const shouldBranch = (effects) => {
  return effects ? effects.success === 'none' || effects.failure === 'none' : false;
};
