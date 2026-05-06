import { EmbeddedObject, Tag, Instruction, RegexMatcher, Callable } from './symbols.js';

export const getEmbeddedObject = (expr) => {
  if (!expr) return expr;
  if (expr.type !== EmbeddedObject) throw new Error();
  return expr.value;
};

export const getEmbeddedCallable = (expr) => {
  if (!expr) return expr;
  if (expr.type !== Callable) throw new Error();
  return expr.value;
};

export const getEmbeddedRegexMatcher = (expr) => {
  if (!expr) return expr;
  if (expr.type !== RegexMatcher) throw new Error();
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
  return matcher.type === RegexMatcher;
};
