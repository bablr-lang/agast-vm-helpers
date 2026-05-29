import { isNode } from '@bablr/agast-helpers/path';
import {
  Tag,
  EmbeddedObject,
  Instruction,
  Node,
  RegexMatcher,
  StringMatcher,
  Callable,
  TreeNodeMatcher,
  GapNodeMatcher,
  NullNodeMatcher,
} from './symbols.js';
import { freezeRecord, isString } from '@bablr/agast-helpers/object';
import { buildTag } from '@bablr/agast-helpers/builders';

const isObject = (val) => val !== null && typeof val === 'object';

export const buildOptions = (options) => {
  let { literal, shift, bind, allowEmpty, internal, hold } = options;

  let l = literal ? 'l' : ' ';
  let s = !shift ? 'S' : ' ';
  let b = bind ? 'b' : ' ';
  let e = allowEmpty ? 'e' : ' ';
  let i = internal ? 'i' : ' ';
  let h = hold ? 'h' : ' ';

  return `${l}${s}${b}${e}${i}${h}`;
};

export const getNonspeculative = (verb) => {
  switch (verb) {
    case Symbol.for('eatMatch'):
      return Symbol.for('eat');
    case Symbol.for('shiftMatch'):
      return Symbol.for('shift');
    default:
      return verb;
  }
};

export const buildCall = (verb, ...args) => {
  return freezeRecord({ verb, arguments: freezeRecord(args) });
};

export const buildEmbeddedObject = (obj) => {
  if (!isObject(obj)) throw new Error();
  return buildTag(EmbeddedObject, freezeRecord(obj));
};

export const buildEmbeddedCallable = (matcher) => {
  if (!isObject(matcher)) throw new Error();

  return buildTag(Callable, matcher);
};

export const buildEmbeddedRegexMatcher = (matcher) => {
  if (!isString(matcher)) throw new Error();

  // TODO more rigorous check?
  return buildTag(RegexMatcher, matcher.endsWith('y') ? matcher : matcher + 'y');
};

export const buildEmbeddedStringMatcher = (matcher) => {
  if (!isString(matcher)) throw new Error();
  return buildTag(StringMatcher, matcher);
};

export const buildEmbeddedInstruction = (instr) => {
  if (!isObject(instr)) throw new Error();
  return buildTag(Instruction, instr);
};

export const buildEmbeddedTag = (tag) => {
  if (!isObject(tag) && !isString(tag)) throw new Error();
  return buildTag(Tag, tag);
};

export const buildEmbeddedNode = (node) => {
  if (!isNode(node)) throw new Error();
  return buildTag(Node, node);
};

export const buildEmbeddedTreeNodeMatcher = (matcher) => {
  return buildTag(TreeNodeMatcher, freezeRecord(matcher));
};

export const buildEmbeddedGapNodeMatcher = (matcher) => {
  return buildTag(GapNodeMatcher, freezeRecord(matcher));
};

export const buildEmbeddedNullNodeMatcher = (matcher) => {
  return buildTag(NullNodeMatcher, freezeRecord(matcher));
};
