import {
  EmbeddedNode,
  EmbeddedMatcher,
  EmbeddedRegex,
  EmbeddedTag,
  EmbeddedObject,
  EmbeddedInstruction,
} from './symbols.js';

const isObject = (val) => val !== null && typeof val === 'object';

const { freeze } = Object;

export const buildCall = (verb, ...args) => {
  return freeze({ verb, arguments: freeze(args) });
};

export const buildEmbeddedObject = (obj) => {
  if (!isObject(obj)) throw new Error();
  return freeze({ type: EmbeddedObject, value: freeze(obj) });
};

export const buildEmbeddedNode = (node) => {
  if (!isObject(node)) throw new Error();
  return freeze({ type: EmbeddedNode, value: freeze(node) });
};

export const buildEmbeddedMatcher = (matcher) => {
  if (!isObject(matcher)) throw new Error();
  return freeze({ type: EmbeddedMatcher, value: matcher });
};

export const buildEmbeddedInstruction = (instr) => {
  if (!isObject(instr)) throw new Error();
  return freeze({ type: EmbeddedInstruction, value: instr });
};

export const buildEmbeddedRegex = (re) => {
  if (!isObject(re)) throw new Error();
  return freeze({ type: EmbeddedRegex, value: re });
};

export const buildEmbeddedTag = (tag) => {
  if (!isObject(tag)) throw new Error();
  return freeze({ type: EmbeddedTag, value: tag });
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
