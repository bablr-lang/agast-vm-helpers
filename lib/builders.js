import { isNode } from '@bablr/agast-helpers/path';
import { Matcher, Tag, EmbeddedObject, Instruction, Node } from './symbols.js';
import { deepFreezeRecord, freezeRecord, isString } from '@bablr/agast-helpers/object';
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
  return deepFreezeRecord({ verb, arguments: args });
};

export const buildEmbeddedObject = (obj) => {
  if (!isObject(obj)) throw new Error();
  return buildTag(EmbeddedObject, obj);
};

export const buildEmbeddedMatcher = (matcher) => {
  if (!isObject(matcher)) throw new Error();
  return buildTag(Matcher, matcher);
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

export const buildEffect = (value) => {
  return buildTag('Effect', value);
};

export const buildWriteEffect = (value) => {
  return buildEffect(
    deepFreezeRecord({
      verb: 'write',
      value: buildEmbeddedObject({ value }),
    }),
  );
};

export const buildAnsiPushEffect = (spans = '') => {
  return buildEffect(
    deepFreezeRecord({
      verb: 'ansi-push',
      value: buildEmbeddedObject({
        spans: spans === '' ? [] : spans.split(' '),
      }),
    }),
  );
};

export const buildAnsiPopEffect = () => {
  return buildEffect(freezeRecord({ verb: 'ansi-pop', value: undefined }));
};

export const buildSetStreamEffect = (stream) => {
  if (stream !== 1 && stream !== 2) throw new Error();

  return buildEffect(freezeRecord({ verb: 'set-stream', value: stream }));
};

export const buildBindingSegment = (type, name) => {
  return freezeRecord({ type, name });
};
