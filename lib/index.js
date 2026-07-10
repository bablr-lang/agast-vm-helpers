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

export const reifyBablrOptions = (str) => {
  if (str.length !== 7) throw new Error();
  let literal = str.includes('l');
  let shift = !str.includes('S');
  let bind = str.includes('b');
  let allowEmpty = str.includes('e');
  let escape = str.includes('p');
  let internal = str.includes('i');
  let hold = str.includes('h');

  return freezeRecord({ literal, shift, bind, allowEmpty, escape, internal, hold });
};

export const shouldBranch = (effects) => {
  return effects ? effects.success === 'none' || effects.failure === 'none' : false;
};
