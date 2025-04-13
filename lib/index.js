import {
  sourceTextFor,
  getCooked,
  isNull,
  nodeFlags,
  printType,
  buildGapTag,
  isNullNode,
  buildNullTag,
  buildStubNode,
  isFragmentNode,
  buildReferenceTag,
  getRoot,
} from '@bablr/agast-helpers/tree';
import * as btree from '@bablr/agast-helpers/btree';
import * as sumtree from '@bablr/agast-helpers/sumtree';
import {
  buildCloseNodeTag,
  buildLiteralTag,
  buildDoctypeTag,
  referenceFlags,
  buildEmbeddedNode,
} from '@bablr/agast-helpers/builders';
import {
  DoctypeTag,
  OpenNodeTag,
  CloseNodeTag,
  ShiftTag,
  GapTag,
  NullTag,
  InitializerTag,
  LiteralTag,
} from '@bablr/agast-helpers/symbols';
import { buildEmbeddedMatcher, buildEmbeddedRegex } from './builders.js';

const { freeze } = Object;

export const effectsFor = (verb) => {
  switch (verb) {
    case 'eat':
    case 'holdFor':
      return { success: 'eat', failure: 'fail' };

    case 'eatMatch':
    case 'holdForMatch':
      return { success: 'eat', failure: 'none' };

    case 'match':
      return { success: 'none', failure: 'none' };

    case 'guard':
      return { success: 'fail', failure: 'none' };

    default:
      throw new Error('invalid match verb');
  }
};

export const shouldBranch = (effects) => {
  return effects ? effects.success === 'none' || effects.failure === 'none' : false;
};

export const reifyNodeFlags = (flags) => {
  let { tokenToken, hasGapToken, fragmentToken, coverFragmentToken } = flags.properties;

  return {
    token: !!(tokenToken && reifyExpression(tokenToken.node)),
    hasGap: !!(hasGapToken && reifyExpression(hasGapToken.node)),
    fragment: !!(fragmentToken && reifyExpression(fragmentToken.node)),
    cover: !!(coverFragmentToken && reifyExpression(coverFragmentToken.node)),
  };
};

export const reifyReferenceFlags = (flags) => {
  let { expressionToken, hasGapToken } = flags.properties;

  return {
    expression: !!(expressionToken && reifyExpression(expressionToken.node)),
    hasGap: !!(hasGapToken && reifyExpression(hasGapToken.node)),
  };
};

export const reifyLanguage = (language) => {
  const value = reifyExpression(language);

  return typeof value === 'string' && !value.startsWith('https://') ? [value] : value;
};

export const reifyProperties = (properties = []) => {
  const built = {};
  for (const property of btree.traverse(properties)) {
    switch (property.node.type) {
      case Symbol.for('Property'): {
        let { reference, value: node } = property.node.properties;

        reference = reifyExpression(reference.node);
        node = reifyExpression(node.node);

        let { name, isArray } = reference.value;
        if (name) {
          if (isArray) {
            built[name] ||= [];
            built[name].push({ reference, node });
          } else {
            built[name] = { reference, node };
          }
        }
        break;
      }
      default:
        throw new Error();
    }
  }
  return built;
};

export const buildChildren = (node) => {
  let { open, children = [], close } = node.properties;

  const selfClosing = !isNull(open.node.properties.selfClosingTagToken?.node);
  const { intrinsicValue } = open.node.properties;
  let built = [];

  open = reifyExpression(open.node);
  close = reifyExpression(close?.node);

  if (selfClosing) {
    built = sumtree.push(built, open);
    if (!isNull(intrinsicValue?.node)) {
      built = sumtree.push(built, buildLiteralTag(intrinsicValue.node));
    }
    built = sumtree.push(built, buildCloseNodeTag());
  } else {
    built = sumtree.push(built, open);
    for (const child of sumtree.traverse(children)) {
      if (child.node.type !== Symbol.for('Property')) throw new Error('umimplemented');

      let { reference, value } = child.node.properties;

      reference = reifyExpression(reference.node);

      built = sumtree.push(built, reference);
      built = sumtree.push(
        built,
        reference.value.name ? buildGapTag() : buildEmbeddedNode(reifyExpression(value.node)),
      );
    }

    built = sumtree.push(built, close);
  }

  return built;
};

export const reifyExpression = (node) => {
  if (node instanceof Promise) throw new Error();

  if (node == null) return node;
  if (isNullNode(node)) return null;

  if (isFragmentNode(node)) {
    node = getRoot(node);
  }

  if (node.language === 'https://bablr.org/languages/core/en/cstml') {
    switch (node.type?.description || node.type) {
      case 'Document': {
        let { doctype, tree } = node.properties;

        doctype = reifyExpression(doctype.node);
        tree = reifyExpression(tree.node);

        let { attributes } = doctype.value;
        let { properties } = tree;

        return {
          flags: nodeFlags,
          language: attributes.bablrLanguage,
          type: null,
          children: sumtree.addAt(
            0,
            buildChildren(node.properties.tree.node),
            buildDoctypeTag(attributes),
          ),
          properties,
          attributes,
        };
      }

      case 'Node': {
        let { open, children } = node.properties;

        open = reifyExpression(open.node);

        let { flags, language, type, attributes } = open.value;

        const properties = reifyProperties(children);

        return {
          flags,
          language,
          type,
          children: buildChildren(node),
          properties,
          attributes,
        };
      }

      case 'DoctypeTag': {
        let { doctypeToken, version, attributes } = node.properties;
        return {
          type: DoctypeTag,
          value: {
            doctypeToken: getCooked(doctypeToken?.node),
            version: parseInt(sourceTextFor(version.node), 10),
            attributes: reifyExpression(attributes.node),
          },
        };
      }

      case 'ReferenceTag': {
        let { type, name, arrayOperatorToken, flags } = node.properties;

        name = name && reifyExpression(name.node);
        type = type && reifyExpression(type.node);
        flags = freeze({ expression: !!flags?.expressionToken, hasGap: !!flags?.hasGapToken });

        return buildReferenceTag(type, name, !isNull(arrayOperatorToken?.node), flags);
      }

      case 'LiteralTag': {
        let { value } = node.properties;

        return { type: LiteralTag, value: getCooked(value.properties.content) };
      }

      case 'Identifier': {
        return getCooked(node.properties.content.node);
      }

      case 'IdentifierPath': {
        return node.properties.segments.map((segment) => reifyExpression(segment.node));
      }

      case 'OpenNodeTag': {
        let { flags, language, type, attributes } = node.properties;

        flags = reifyNodeFlags(flags.node);
        language = reifyLanguage(language?.node);
        type = reifyExpression(type?.node);
        attributes = reifyExpression(attributes?.node);

        return {
          type: OpenNodeTag,
          value: { flags, language, type, attributes },
        };
      }

      case 'CloseNodeTag': {
        return { type: CloseNodeTag, value: undefined };
      }

      case 'Integer': {
        let { digits } = node.properties;
        return parseInt(digits.map((digit) => getCooked(digit.node)).join(''), 10);
      }

      case 'Infinity': {
        return getCooked(node.properties.sign.node) === '-' ? -Infinity : Infinity;
      }

      case 'Punctuator': {
        return getCooked(node);
      }

      case 'GapTag':
        return { type: GapTag, value: undefined };

      case 'InitializerTag':
        return { type: InitializerTag, value: undefined };

      case 'NullTag':
        return { type: NullTag, value: undefined };

      case 'ShiftTag':
        return { type: ShiftTag, value: undefined };

      default:
        throw new Error();
    }
  }

  if (
    ![
      'https://bablr.org/languages/core/en/bablr-vm-instruction',
      'https://bablr.org/languages/core/en/cstml-json',
      'https://bablr.org/languages/core/en/cstml',
      'https://bablr.org/languages/core/en/spamex',
    ].includes(node.language)
  ) {
    return node;
  }

  switch (printType(node.type)) {
    case 'String':
      return node.properties.content.node ? getCooked(node.properties.content.node) : '';

    case 'SpamexString': {
      return buildEmbeddedMatcher(node.properties.content.node);
    }

    case 'RegexString': {
      return buildEmbeddedRegex(node.properties.content.node);
    }

    case 'OpenNodeMatcher': {
      let { flags, language, type, attributes, intrinsicValue } = node.properties;

      flags = (flags && reifyNodeFlags(flags.node)) || {};
      language = language && reifyLanguage(language.node);
      type =
        type.node.type === Symbol.for('String')
          ? getCooked(type.node.properties.content.node)
          : reifyExpression(type.node);
      attributes = attributes ? reifyExpression(attributes.node) : {};
      intrinsicValue = intrinsicValue && reifyExpression(intrinsicValue.node);

      return { flags, language, type, intrinsicValue, attributes };
    }

    case 'FragmentMatcher': {
      let { flags } = node.properties;

      flags = (flags && reifyNodeFlags(flags.node)) || {};

      return {
        flags,
        language: null,
        type: Symbol.for('@bablr/fragment'),
        intrinsicValue: null,
        attributes: null,
      };
    }

    case 'BasicNodeMatcher': {
      let { open } = node.properties;

      return reifyExpression(open.node);
    }

    case 'PropertyMatcher': {
      let { refMatcher, nodeMatcher } = node.properties;

      refMatcher = refMatcher ? reifyExpression(refMatcher.node) : null;
      nodeMatcher = reifyExpression(nodeMatcher.node);

      return { refMatcher, nodeMatcher };
    }

    case 'ReferenceMatcher': {
      let { type, name, openIndexToken, flags } = node.properties;

      type = type && reifyExpression(type.node);
      name = name && reifyExpression(name.node);
      let isArray = !isNull(openIndexToken?.node);
      flags = (flags && reifyReferenceFlags(flags?.node)) || referenceFlags;

      return { type, name, isArray, flags };
    }

    case 'GapNodeMatcher':
      return buildStubNode(buildGapTag());

    case 'NullNodeMatcher':
      return buildStubNode(buildNullTag());

    case 'ArrayNodeMatcher':
      return [];

    case 'Call': {
      const { verb, arguments: args } = node.properties;

      const args_ = [...btree.traverse(args)].map((el) => reifyExpression(el.node));

      return { verb: reifyExpression(verb.node), arguments: args_ };
    }

    case 'Object': {
      const { properties } = node.properties;

      return Object.fromEntries(
        [...btree.traverse(properties)].map((property) => {
          const {
            node: {
              properties: { key, value },
            },
          } = property;
          return [getCooked(key.node), reifyExpression(value.node)];
        }),
      );
    }

    case 'Array': {
      const { elements = [] } = node.properties;

      return [...btree.traverse(elements)].map((el) => reifyExpression(el.node));
    }

    case 'Punctuator':
    case 'Keyword':
      return getCooked(node);

    case 'Identifier':
      return getCooked(node.properties.content.node);

    case 'Boolean': {
      // prettier-ignore
      switch (getCooked(node.properties.sigilToken.node)) {
        case 'true': return true;
        case 'false': return false;
        default: throw new Error();
      }
    }

    case 'Null':
      return null;

    case 'NotANumber':
      return NaN;

    case 'Undefined':
      return undefined;

    default:
      throw new Error('bad expression');
  }
};

export const reifyExpressionShallow = (node) => {
  if (!node || isNullNode(node)) return null;

  if (
    ![
      'https://bablr.org/languages/core/en/bablr-vm-instruction',
      'https://bablr.org/languages/core/en/cstml',
      'https://bablr.org/languages/core/en/cstml-json',
      'https://bablr.org/languages/core/en/spamex',
    ].includes(node.language)
  ) {
    return node;
  }

  switch (printType(node.type)) {
    case 'String':
    case 'SpamexString':
    case 'RegexString': {
      return reifyExpression(node);
    }

    case 'Object': {
      const { properties } = node.properties;

      return Object.fromEntries(
        [...btree.traverse(properties)].map(
          ({
            node: {
              properties: { key, value },
            },
          }) => [getCooked(key.node), value.node],
        ),
      );
    }

    case 'Array':
      return [...btree.traverse(node.properties.elements)].map((prop) => prop.node);

    case 'Boolean': {
      // prettier-ignore
      switch (getCooked(node.properties.sigilToken.node)) {
        case 'true': return true;
        case 'false': return false;
        default: throw new Error();
      }
    }

    case 'Null':
      return null;

    default:
      return reifyExpression(node);
  }
};
