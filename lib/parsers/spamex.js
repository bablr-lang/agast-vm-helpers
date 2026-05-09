import { freezeRecord, isString } from '@bablr/agast-helpers/object';
import {
  parseReferenceTag,
  parseBindingTag,
  buildTag,
  parseIdentifier,
  parseString,
  parseObject,
  tokenFlags,
  nodeFlags,
  getFlagsWithGap,
} from '@bablr/agast-helpers/builders';
import { buildParser, canStartIdentifier, match } from '@bablr/agast-helpers/parse';
import { parseRegexPattern } from './regex.js';
import {
  buildEmbeddedCallable,
  buildEmbeddedRegexMatcher,
  buildEmbeddedStringMatcher,
} from '../builders.js';
import { printExpression } from '@bablr/agast-helpers/print';

export const parseCallable = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  let reference;
  if (canStartIdentifier(chr)) {
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

  switch (chr) {
    case '/':
      let startIdx = p.idx;
      parseRegexPattern(p);
      let endIdx = p.idx;

      return buildEmbeddedRegexMatcher(str.slice(startIdx, endIdx));
    case '"':
    case "'":
      return buildEmbeddedStringMatcher(parseString(p));
    default:
      return buildEmbeddedCallable(parseCallable(p));
  }
};

export const parseNodeMatcher = (input) => {
  let p = buildParser(input);

  let matcher;
  if (match(p, '<//>')) {
    p.idx += 4;
    matcher = buildTag(Symbol.for('GapNodeMatcher'));
  } else if (match(p, '</>')) {
    throw new Error();
  } else if (match(p, 'null')) {
    p.idx += 4;
    matcher = buildTag(Symbol.for('NullNodeMatcher'));
  } else {
    matcher = parseTreeNodeMatcher(p);
  }

  return matcher;
};

export const parseTreeNodeMatcher = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '<') throw new Error();
  chr = str[++p.idx];
  let token = false;
  let hasGap = false;
  if (chr === '*') {
    chr = str[++p.idx];
    token = true;
  }
  if (chr === '$') {
    chr = str[++p.idx];
    hasGap = true;
  }

  let flags = token ? tokenFlags : nodeFlags;

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
    literalValue = buildEmbeddedStringMatcher(parseString(p));
    chr = str[p.idx];

    while (chr === ' ') {
      chr = str[++p.idx];
    }
  } else if (chr === '/' && str[p.idx + 1] !== '>') {
    let startIdx = p.idx;
    parseRegexPattern(p);
    chr = str[p.idx];
    let endIdx = p.idx;

    literalValue = buildEmbeddedRegexMatcher(str.slice(startIdx, endIdx));
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

  if (isString(input) && p.idx !== str.length) throw new Error();

  if (hasGap) flags = getFlagsWithGap(flags);

  return buildTag(Symbol.for('TreeNodeMatcher'), {
    flags,
    type,
    name,
    literalValue,
    attributes: printExpression(attributes),
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
