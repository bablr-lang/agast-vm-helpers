import {
  printSource,
  printTag,
  printExpression as printExpression_,
  printCSTML,
} from '@bablr/agast-helpers/tree';
import {
  Tag,
  EmbeddedObject,
  Matcher,
  Instruction,
  TreeNode,
  NullNode,
  GapNode,
  Node,
} from './symbols.js';

export const printEmbedded = (value) => {
  switch (value.type) {
    case Tag:
      return `t\`${printTag(value.value)}\``;

    case Node:
      return `n\`${printCSTML(value.value)}\``;

    case Matcher:
      return `m\`${printSource(value.value)}\``;

    case Instruction:
      return `i\`${printCall(value.value)}\``;

    case EmbeddedObject: {
      return printObject(value.value);
    }

    case NullNode:
    case GapNode:
    case TreeNode:
      throw new Error(
        'Cannot print plain node. Did you mean to wrap this node in buildEmbeddedNode?',
      );

    default:
      throw new Error(
        'Cannot print plain object. Did you mean to wrap this object in buildEmbedded*?',
      );
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
