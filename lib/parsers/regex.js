import { buildParser, match } from '@bablr/agast-helpers/parse';
import { deepFreezeRecord, freezeRecord } from '@bablr/agast-helpers/object';
import { parseUnsignedInteger } from '@bablr/agast-helpers/builders';

let { includes } = Array.prototype;

export const escapables = freezeRecord({
  n: '\n',
  r: '\r',
  t: '\t',
  0: '\0',
});

export const parseRegexPattern = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '/') throw new Error();
  chr = str[++p.idx];

  let alternatives = parseAlternatives(p);
  chr = str[p.idx];

  if (chr !== '/') throw new Error();
  chr = str[++p.idx];

  let flags = parseRegexFlags(p);

  let expression = { capture: true, name: null, alternatives };

  return deepFreezeRecord({ expression, flags });
};

export const parseAlternatives = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];
  let alternatives = [];
  for (;;) {
    alternatives.push(parseElements(p));
    chr = str[p.idx];

    if (chr === '|') {
      chr = str[++p.idx];
    } else {
      break;
    }
  }
  return deepFreezeRecord(alternatives);
};

export const parseElements = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  let elements = [];

  while (chr && chr !== '|' && chr !== '/' && chr !== ')') {
    let element = parseElement(p);
    chr = str[p.idx];

    elements.push(element);

    if (includes.call(quantifierChrs, chr)) {
      let min, max, greedy;

      if (chr === '?') {
        chr = str[++p.idx];
        min = 0;
        max = 1;
        greedy = true;
      } else if (chr === '{') {
        chr = str[++p.idx];
        min = parseUnsignedInteger(p);
        chr = str[p.idx];
        if (chr === ',') {
          chr = str[++p.idx];
          max = parseUnsignedInteger(p);
          chr = str[p.idx];
        }
        if (chr !== '}') throw new Error();
        chr = str[++p.idx];
      } else if (chr === '*' || chr === '+') {
        min = chr === '*' ? 0 : 1;
        max = Infinity;
        chr = str[++p.idx];
        greedy = chr !== '?';
        if (!greedy) {
          chr = str[++p.idx];
        }
      }

      elements.push(min, max, greedy);
    }
  }

  return deepFreezeRecord(elements);
};

export const quantifierChrs = freezeRecord(['*', '+', '?', '{']);

export const parseCharacterClass = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '[') throw new Error();
  chr = str[++p.idx];

  let negate = chr === '^';
  if (negate) chr = str[++p.idx];
  let elements = [negate];

  while (chr && chr !== ']') {
    let element = parseCharacterClassElement(p);
    chr = str[p.idx];

    if (chr === '-' && str[p.idx + 1] !== ']') {
      chr = str[++p.idx];
      element = [element, parseCharacterClassElement(p)];
      chr = str[p.idx];
    }

    elements.push(element);
  }

  if (chr !== ']') throw new Error();
  chr = str[++p.idx];

  return elements;
};

export const parseCharacterClassElement = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr === '\\' && 'dDsSwWpP'.includes(str[p.idx + 1])) {
    return parseCharacterSet(p);
  } else if (match(p, '\\g')) {
    return parseGap(p);
  } else {
    return parseCharacter(p);
  }
};

export const parseCharacter = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (match(p, '\\')) {
    return parseEscapeSequence(p);
  } else {
    if (chr === '\r' || chr === '\n') throw new Error();
    p.idx++;
    return chr;
  }
};

export const isSpecial = (span, chr) => {
  if (chr.length !== 1) throw new Error();

  if (span === 'Bare') {
    return /[*+?{}\[\]().^$|\\\n\/><]/y;
    return '*+?{}[]().^$|\\/<>'.includes(chr);
  } else if (span === 'CharacterClass') {
    return ']\\'.includes(chr);
  } else if (span === 'CharacterClass:First') {
    return ']^\\'.includes(chr);
  } else if (span === 'Quantifier') {
    return '{}'.includes(chr);
  } else {
    throw new Error();
  }
};

export const parseStartOfInputAssertion = (input) => {
  let p = buildParser(input);
  let { str } = p;

  if (str[p.idx] !== '^') throw new Error();
  p.idx++;
  return Symbol('^');
};

export const parseEndOfInputAssertion = (input) => {
  let p = buildParser(input);
  let { str } = p;

  if (str[p.idx] !== '$') throw new Error();
  p.idx++;
  return Symbol('$');
};

export const parseBoundaryAssertion = (input) => {
  let p = buildParser(input);
  let { str } = p;

  if (str[p.idx] !== '\\' || !'bB'.includes(str[p.idx + 1])) throw new Error();

  p.idx += 2;

  return Symbol(str[p.idx - 1]);
};

export const parseEscapeSequence = (input, { span } = { span: 'Bare' }) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '\\') throw new Error();
  chr = str[++p.idx];

  let cooked;

  if (chr === '\\' || '/nrt0'.includes(chr)) {
    p.idx++;
    cooked = escapables[chr] || chr;
  } else if (isSpecial(span, chr)) {
    p.idx++;
    cooked = chr;
  } else if (chr === 'u') {
    chr = str[++p.idx];

    let value;
    if (chr === '{') {
      chr = str[++p.idx];

      while (chr && chr !== '}') {
        value = value + str[p.idx++];
      }

      if (chr !== '}') throw new Error();
      chr = str[++p.idx];
    } else {
      value = str[p.idx++] ?? '' + str[p.idx++] ?? '' + str[p.idx++] ?? '' + str[p.idx++] ?? '';
    }

    cooked = String.fromCodePoint(parseInt(value, 16));
  } else if (chr === 'x') {
    let value = str[p.idx++] ?? '' + str[p.idx++] ?? '';

    cooked = String.fromCodePoint(parseInt(value, 16));
  } else {
    throw new Error();
  }

  return cooked;
};

export const parseCharacterSet = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr === '.') {
    p.idx++;
    return Symbol('.');
  } else if (chr === '\\' && 'dDsSwWpP'.includes(str[p.idx + 1])) {
    p.idx += 2;
    return Symbol(str[p.idx - 1]);
  } else {
    throw new Error();
  }
};

export const parseGroup = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr !== '(') throw new Error();
  chr = str[++p.idx];

  let capture = !(chr === '?' && str[p.idx + 1] === ':');
  if (!capture) {
    p.idx += 2;
  }

  let alternatives = parseAlternatives(p);
  chr = str[p.idx];

  if (chr !== ')') throw new Error();
  chr = str[++p.idx];

  return deepFreezeRecord({ capture, alternatives });
};

export const parseElement = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  if (chr === '[') {
    return parseCharacterClass(p);
  } else if (match(p, '(?:')) {
    return parseGroup(p);
  } else if (chr === '(') {
    let idx = p.idx + 1;
    let chr_ = str[idx];
    if (chr_ === '?') chr_ = str[++idx];
    if (chr_ === '=' || chr_ === '!') {
      throw new Error('Lookahead and lookbehind are not supported');
    } else {
      return parseGroup(p);
    }
  } else if (chr === '$') {
    return parseEndOfInputAssertion(p);
  } else if (chr === '^') {
    return parseStartOfInputAssertion(p);
  } else if (chr === '\\' && 'bB'.includes(str[p.idx + 1])) {
    return parseBoundaryAssertion(p);
  } else if (chr === '.' || (chr === '\\' && 'dDsSwWpP'.includes(str[p.idx + 1]))) {
    return parseCharacterSet(p);
  } else if (match(p, '\\g')) {
    return parseGap(p);
  } else {
    return parseCharacter(p);
  }
};

export const parseGap = (input) => {
  let p = buildParser(input);

  if (!match(p, '\\g')) throw new Error();
  p.idx += 2;
  return Symbol('g');
};

export const parseRegexFlags = (input) => {
  let p = buildParser(input);
  let { str } = p;
  let chr = str[p.idx];

  let flags = {
    global: false,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
    unicode: false,
    sticky: false,
  };

  outer: while (chr) {
    switch (chr) {
      case 'g':
        if (flags.global) throw new Error();
        flags.global = true;
        break;
      case 'i':
        if (flags.ignoreCase) throw new Error();
        flags.ignoreCase = true;
        break;
      case 'm':
        if (flags.multiline) throw new Error();
        flags.multiline = true;
        break;
      case 's':
        if (flags.dotAll) throw new Error();
        flags.dotAll = true;
        break;
      case 'u':
        if (flags.unicode) throw new Error();
        flags.unicode = true;
        break;
      case 'y':
        if (flags.sticky) throw new Error();
        flags.sticky = true;
        break;

      default:
        break outer;
    }
    chr = str[++p.idx];
  }

  return freezeRecord(flags);
};
