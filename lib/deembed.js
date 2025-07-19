import { Node, EmbeddedObject, Tag, Matcher, Regex, Instruction } from './symbols.js';

export const getEmbeddedObject = (expr) => {
  if (!expr) return expr;
  if (expr.type !== EmbeddedObject) throw new Error();
  return expr.value;
};

export const getEmbeddedNode = (expr) => {
  if (!expr) return expr;
  if (expr.type !== Node) throw new Error();
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

export const getEmbeddedRegex = (expr) => {
  if (!expr) return expr;
  if (expr.type !== Regex) throw new Error();
  return expr.value;
};

export const getEmbeddedTag = (expr) => {
  if (expr.type !== Tag) throw new Error();
  const tag = expr.value;
  return tag;
};
