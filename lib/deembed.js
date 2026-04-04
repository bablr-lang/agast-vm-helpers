import { getRoot } from '@bablr/agast-helpers/path';
import { EmbeddedObject, Tag, Matcher, Instruction } from './symbols.js';

export const getEmbeddedObject = (expr) => {
  if (!expr) return expr;
  if (expr.type !== EmbeddedObject) throw new Error();
  return expr.value;
};

export const getEmbeddedMatcher = (expr) => {
  if (!expr) return expr;
  if (expr.type !== Matcher) throw new Error();
  return expr.value;
};

export const getEmbeddedInstruction = (expr) => {
  if (!expr) return expr;
  if (expr.type !== Instruction) throw new Error();
  return expr.value;
};

export const getEmbeddedTag = (expr) => {
  if (expr.type !== Tag) throw new Error();
  const tag = expr.value;
  return tag;
};

export const isEmbeddedRegexMatcher = (matcher) => {
  return matcher.type === Matcher && getRoot(matcher.value)?.value.name === Symbol.for('Pattern');
};
