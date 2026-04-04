export * from '@bablr/agast-helpers/symbols';

let Object_ = Symbol.for('Object');

export const Instruction = Symbol.for('Instruction');
export const Matcher = Symbol.for('Matcher');
export const Tag = Symbol.for('Tag');
export { Object_ as Object, Object_ as EmbeddedObject };
