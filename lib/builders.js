import { isNode } from '@bablr/agast-helpers/path';
import { Matcher, Regex, Tag, EmbeddedObject, Instruction, Node } from './symbols.js';

const isObject = (val) => val !== null && typeof val === 'object';

const { freeze } = Object;

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

export const buildCall = (verb, ...args) => {
  return freeze({ verb, arguments: freeze(args) });
};

export const buildEmbeddedObject = (obj) => {
  if (!isObject(obj)) throw new Error();
  return freeze({ type: EmbeddedObject, value: freeze(obj) });
};

export const buildEmbeddedMatcher = (matcher) => {
  if (!isObject(matcher)) throw new Error();
  return freeze({ type: Matcher, value: matcher });
};

export const buildEmbeddedInstruction = (instr) => {
  if (!isObject(instr)) throw new Error();
  return freeze({ type: Instruction, value: instr });
};

export const buildEmbeddedRegex = (re) => {
  if (!isObject(re)) throw new Error();
  return freeze({ type: Regex, value: re });
};

export const buildEmbeddedTag = (tag) => {
  if (!isObject(tag)) throw new Error();
  return freeze({ type: Tag, value: tag });
};

export const buildEmbeddedNode = (node) => {
  if (!isNode(node)) throw new Error();
  return freeze({ type: Node, value: node });
};

export const buildEffect = (value) => {
  return freeze({ type: 'Effect', value });
};

export const buildWriteEffect = (text, options = {}) => {
  return buildEffect(
    freeze({
      verb: 'write',
      value: buildEmbeddedObject(freeze({ text, options: buildEmbeddedObject(freeze(options)) })),
    }),
  );
};

export const buildAnsiPushEffect = (spans = '') => {
  return buildEffect(
    freeze({
      verb: 'ansi-push',
      value: buildEmbeddedObject(
        freeze({ spans: spans === '' ? freeze([]) : freeze(spans.split(' ')) }),
      ),
    }),
  );
};

export const buildAnsiPopEffect = () => {
  return buildEffect(freeze({ verb: 'ansi-pop', value: undefined }));
};
