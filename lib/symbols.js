export * from '@bablr/agast-helpers/symbols';

let Object_ = Symbol.for('Object');

export const Instruction = Symbol.for('Instruction');
export const Callable = Symbol.for('Callable');
export const TreeNodeMatcher = Symbol.for('TreeNodeMatcher');
export const GapNodeMatcher = Symbol.for('GapNodeMatcher');
export const NullNodeMatcher = Symbol.for('NullNodeMatcher');
export const RegexMatcher = Symbol.for('RegexMatcher');
export const StringMatcher = Symbol.for('StringMatcher');
export const Tag = Symbol.for('Tag');
export { Object_ as Object, Object_ as EmbeddedObject };
