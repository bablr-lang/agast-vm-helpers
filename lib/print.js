import {
  printSource,
  printTag,
  printExpression as printExpression_,
} from '@bablr/agast-helpers/tree';
import {
  EmbeddedNode,
  EmbeddedTag,
  EmbeddedObject,
  EmbeddedMatcher,
  EmbeddedRegex,
  EmbeddedInstruction,
} from './symbols.js';

export const printEmbedded = (value) => {
  switch (value.type) {
    case EmbeddedTag:
      return `t\`${printTag(value.value)}\``;

    case EmbeddedMatcher:
      return `m\`${printSource(value.value)}\``;

    case EmbeddedRegex:
      return `re\`${printSource(value.value)}\``;

    case EmbeddedInstruction:
      return `i\`${printCall(value.value)}\``;

    case EmbeddedObject: {
      return printObject(value.value);
    }

    case EmbeddedNode: {
      return printSource(value.value);
    }

    default:
      throw new Error();
  }
};

export const printObject = (obj) => {
  let entries = Object.entries(obj);
  return entries.length
    ? `{ ${entries.map(([k, v]) => `${k}: ${printExpression(v)}`).join(', ')} }`
    : '{}';
};

export const printArray = (arr) => `[${arr.map((v) => printExpression(v)).join(', ')}]`;

export const printCall = (call) => {
  let { verb, arguments: args } = call;
  return `${verb}${`(${args.map((v) => printExpression(v)).join(', ')})`}`;
};

export const printExpression = (expr) => {
  if (['string', 'symbol', 'boolean', 'number'].includes(typeof expr) || expr == null) {
    return printExpression_(expr);
  } else if (Array.isArray(expr)) {
    return printArray(expr);
  } else if (typeof expr === 'object') {
    return printEmbedded(expr);
  } else {
    throw new Error();
  }
};
