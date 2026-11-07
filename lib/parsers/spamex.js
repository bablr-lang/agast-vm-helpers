import { freezeRecord, isString } from '@bablr/agast-helpers/object';
import {
  parseReferenceTag,
  parseBindingTag,
  parseIdentifier,
  parseString,
  parseObject,
  parseFlags,
  printExpression,
  parseCloseTag,
} from 'agast';
import { buildParser, canStartIdentifier, match } from '@bablr/agast-helpers/parse';
import { parseRegexPattern } from './regex.js';
import {
  buildCallableTag,
  buildRegexMatcherTag,
  buildStringMatcherTag,
  buildTreeNodeMatcher,
} from '../builders.js';

export const parseCallable = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  let reference;
  if (canStartIdentifier(chr) || '_#.'.includes(chr)) {
    reference = parseReferenceTag(p);
    chr = str[p.idx];
  }

  while (chr === ' ') {
    chr = str[++p.idx];
  }

  let bindings = [];
  while (chr === ':') {
    bindings.push(parseBindingTag(p));
    chr = str[p.idx];

    while (chr === ' ') {
      chr = str[++p.idx];
    }
  }

  let nodeMatcher = parseNodeMatcher(p);
  chr = str[p.idx];

  freezeRecord(bindings);

  if (isString(input) && p.idx !== str.length) throw new Error();

  return freezeRecord({
    reference,
    bindings,
    nodeMatcher,
  });
};

export const parseMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  let result;
  switch (chr) {
    case '/':
      let startIdx = p.idx;
      parseRegexPattern(p);
      let endIdx = p.idx;

      result = buildRegexMatcherTag([...str.slice(startIdx, endIdx)].join(''));
      break;
    case '"':
    case "'":
      result = buildStringMatcherTag(parseString(p));
      break;
    default:
      result = buildCallableTag(parseCallable(p));
      break;
  }

  if (isString(input) && p.idx !== str.length) throw new Error();

  return result;
};

export const parseNodeMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;

  let matcher;
  if (match(p, '<//>')) {
    p.idx += 4;
    matcher = freezeRecord({ type: Symbol.for('GapNodeMatcher'), value: freezeRecord({}) });
  } else if (match(p, '</>')) {
    throw new Error();
  } else if (match(p, 'null')) {
    p.idx += 4;
    matcher = freezeRecord({ type: Symbol.for('NullNodeMatcher'), value: freezeRecord({}) });
  } else {
    matcher = parseTreeNodeMatcher(p);
  }

  if (isString(input) && p.idx !== str.length) throw new Error();

  return matcher;
};

export const parseTreeNodeMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '<') throw new Error();
  chr = str[++p.idx];

  let flags = parseFlags(p);
  chr = str[p.idx];

  let type = null;
  let name = null;

  if (chr === '_') {
    chr = str[++p.idx];
    type = Symbol.for('_');

    if (chr === '_') {
      chr = str[++p.idx];
      type = Symbol.for('__');
    }
  } else if (chr === '?') {
    chr = str[++p.idx];
    type = Symbol.for('?');
  }

  if (!` {'"/>`.includes(chr)) {
    name = Symbol.for(parseIdentifier(p));
    chr = str[p.idx];
  }

  while (chr === ' ') {
    chr = str[++p.idx];
  }

  let literalValue = null;

  if (`'"`.includes(chr)) {
    literalValue = buildStringMatcherTag(parseString(p));
    chr = str[p.idx];

    while (chr === ' ') {
      chr = str[++p.idx];
    }
  } else if (chr === '/' && str[p.idx + 1] !== '>') {
    let startIdx = p.idx;
    parseRegexPattern(p);
    chr = str[p.idx];
    let endIdx = p.idx;

    literalValue = buildRegexMatcherTag([...str.slice(startIdx, endIdx)].join(''));

    while (chr === ' ') {
      chr = str[++p.idx];
    }
  }

  let attributes = freezeRecord({});

  if (chr === '{') {
    attributes = parseObject(p);
    chr = str[p.idx];

    while (chr === ' ') {
      chr = str[++p.idx];
    }
  }

  let selfClosing = false;

  if (chr === '/') {
    chr = str[++p.idx];
    selfClosing = true;
  }

  if (chr === '>') {
    chr = str[++p.idx];
  }

  while (chr === ' ') {
    chr = str[++p.idx];
  }

  let children = [];
  if (!selfClosing) {
    while (!(chr === '<' && str[p.idx + 1] === '/' && str[p.idx + 2] !== '/')) {
      let matcher = buildCallableTag(parseCallable(p));
      chr = str[p.idx];

      children.push(matcher);
    }

    parseCloseTag(p);
    chr = str[p.idx];
  }

  if (isString(input) && p.idx !== str.length) throw new Error();

  return freezeRecord({
    type: Symbol.for('TreeNodeMatcher'),
    value: buildTreeNodeMatcher(
      flags,
      type,
      name,
      literalValue,
      printExpression(attributes),
      children,
      selfClosing,
    ),
  });
};

export const parseGapNodeMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];
};

export const parseNullNodeMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;

  if (!match('null')) throw new Error();
};
