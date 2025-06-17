import {
  sourceTextFor,
  getCooked,
  isNull,
  nodeFlags,
  isNullNode,
  buildStubNode,
  isFragmentNode,
  buildReferenceTag,
  getRoot,
  buildChild,
} from '@bablr/agast-helpers/tree';
import * as btree from '@bablr/agast-helpers/btree';
import * as sumtree from '@bablr/agast-helpers/children';
import {
  buildGapTag,
  buildNullTag,
  buildOpenNodeTag,
  buildBindingTag,
  buildInitializerTag,
  buildShiftTag,
  buildCloseNodeTag,
  buildLiteralTag,
  buildDoctypeTag,
  referenceFlags,
  buildProperty,
} from '@bablr/agast-helpers/builders';
import { buildEmbeddedMatcher, buildEmbeddedRegex } from './builders.js';
import {
  AttributeDefinition,
  GapTag,
  InitializerTag,
  LiteralTag,
  NullTag,
  Property,
} from './symbols.js';
import { isStubNode } from '@bablr/agast-helpers/path';

const { freeze } = Object;

export const effectsFor = (verb) => {
  switch (verb) {
    case 'eat':
    case 'shift':
      return { success: 'eat', failure: 'fail' };

    case 'eatMatch':
    case 'shiftMatch':
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
  let { tokenToken, hasGapToken, fragmentToken, multiFragmentToken } = flags.properties;

  return {
    token: !!(tokenToken && reifyExpression(tokenToken.node)),
    hasGap: !!(hasGapToken && reifyExpression(hasGapToken.node)),
    fragment: !!(fragmentToken && reifyExpression(fragmentToken.node)),
    cover: !!(fragmentToken && !(multiFragmentToken && reifyExpression(multiFragmentToken.node))),
  };
};

export const reifyReferenceFlags = (flags) => {
  let { expressionToken, hasGapToken } = flags.properties;

  return {
    expression: !!(expressionToken && reifyExpression(expressionToken.node)),
    hasGap: !!(hasGapToken && reifyExpression(hasGapToken.node)),
  };
};

export const reifyProperties = (properties = { node: [] }) => {
  const built = {};
  for (const property of btree.traverse(properties.node)) {
    switch (property.node.type) {
      case Symbol.for('Property'): {
        let { reference, value: node } = property.node.properties;

        reference = reference ? reifyExpression(reference.node) : buildReferenceTag('.');
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
    }
  }
  return built;
};

export const buildChildren = (node) => {
  let { open, children = { node: [] }, close } = node.properties;

  const selfClosing = !isNull(open.node.properties.selfClosingTagToken?.node);
  const { intrinsicValue } = open.node.properties;
  let built = [];

  open = reifyExpression(open.node);
  close = reifyExpression(close?.node);

  if (selfClosing) {
    built = sumtree.push(built, open);
    if (!isNull(intrinsicValue?.node)) {
      built = sumtree.push(built, buildLiteralTag(reifyExpression(intrinsicValue.node)));
    }
    built = sumtree.push(built, buildCloseNodeTag());
  } else {
    built = sumtree.push(built, open);
    for (const child of sumtree.traverse(children.node)) {
      if ([AttributeDefinition, LiteralTag].includes(child.node.type)) {
        built = sumtree.push(built, reifyExpression(child.node));
        continue;
      }

      if (child.node.type !== Symbol.for('Property')) throw new Error('umimplemented');

      let { reference, binding, value } = child.node.properties;

      let referenceTag = reference ? reifyExpression(reference.node) : buildReferenceTag('.');
      let bindingTag = binding
        ? reifyExpression(binding.node)
        : buildBindingTag(isStubNode(value.node) ? null : []);

      value = reifyExpression(value.node);

      if (value.type === NullTag || value.type === GapTag) {
        value = buildStubNode(value);
      }

      built = sumtree.push(built, referenceTag);
      if (value.type === InitializerTag) {
        built = sumtree.push(built, value);
      } else {
        built = sumtree.push(built, bindingTag);
        built = sumtree.push(
          built,
          buildChild(Property, buildProperty(referenceTag.value, buildBindingTag().value, value)),
        );
      }
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

  switch (node.type?.description || node.type) {
    case 'Document': {
      let { doctype, tree } = node.properties;

      doctype = reifyExpression(doctype.node);
      tree = reifyExpression(tree.node);

      let { attributes } = doctype.value;
      let { properties } = tree;

      return Object.freeze({
        flags: nodeFlags,
        type: null,
        children: sumtree.addAt(
          0,
          buildChildren(node.properties.tree.node),
          buildDoctypeTag(attributes),
        ),
        properties,
        attributes,
      });
    }

    case 'Node': {
      let { open, children } = node.properties;

      open = reifyExpression(open.node);

      let { flags, type, attributes } = open.value;

      const properties = reifyProperties(children);

      return Object.freeze({
        flags,
        type,
        children: buildChildren(node),
        properties,
        attributes,
      });
    }

    case 'DoctypeTag': {
      let { version, attributes } = node.properties;
      return buildDoctypeTag(
        attributes && reifyExpression(attributes.node),
        parseInt(sourceTextFor(version.node), 10),
      );
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

      return buildLiteralTag(getCooked(value.node.properties.content.node));
    }

    case 'Identifier': {
      return getCooked(node.properties.content.node);
    }

    case 'IdentifierPath': {
      return node.properties.segments.node.map((segment) => reifyExpression(segment.node));
    }

    case 'OpenNodeTag': {
      let { flags, type, attributes } = node.properties;

      flags = reifyNodeFlags(flags.node);
      type = reifyExpression(type?.node);
      attributes = reifyExpression(attributes?.node);

      return buildOpenNodeTag(flags, type, attributes);
    }

    case 'CloseNodeTag': {
      return buildCloseNodeTag();
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
      return buildGapTag();

    case 'InitializerTag':
      return buildInitializerTag();

    case 'BindingTag':
      let { languagePath } = node.properties;

      return buildBindingTag(reifyExpression(languagePath));

    case 'NullTag':
      return buildNullTag();

    case 'ShiftTag':
      return buildShiftTag();

    case 'String':
      return node.properties.content.node ? getCooked(node.properties.content.node) : '';

    case 'SpamexString': {
      return buildEmbeddedMatcher(node.properties.content.node);
    }

    case 'RegexString': {
      return buildEmbeddedRegex(node.properties.content.node);
    }

    case 'OpenNodeMatcher': {
      let { flags, type, attributes, intrinsicValue } = node.properties;

      flags = (flags && reifyNodeFlags(flags.node)) || {};
      type =
        type.node.type === Symbol.for('String')
          ? getCooked(type.node.properties.content.node)
          : reifyExpression(type.node);
      attributes = attributes ? reifyExpression(attributes.node) : {};
      intrinsicValue = intrinsicValue && reifyExpression(intrinsicValue.node);

      return { flags, type, intrinsicValue, attributes };
    }

    case 'FragmentMatcher': {
      let { flags } = node.properties;

      flags = (flags && reifyNodeFlags(flags.node)) || {};

      return {
        flags,
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
      let { refMatcher, bindingMatcher, nodeMatcher } = node.properties;

      refMatcher = refMatcher ? reifyExpression(refMatcher.node) : null;
      bindingMatcher = bindingMatcher ? reifyExpression(bindingMatcher.node) : null;
      nodeMatcher = reifyExpression(nodeMatcher.node);

      return { refMatcher, bindingMatcher, nodeMatcher };
    }

    case 'ReferenceMatcher': {
      let { type, name, openIndexToken, flags } = node.properties;

      type = type && reifyExpression(type.node);
      name = name && reifyExpression(name.node);
      let isArray = !isNull(openIndexToken?.node);
      flags = (flags && reifyReferenceFlags(flags?.node)) || referenceFlags;

      return { type, name, isArray, flags };
    }

    case 'BindingMatcher': {
      let { languagePath } = node.properties;

      languagePath = languagePath && reifyExpression(languagePath.node);

      return { languagePath };
    }

    case 'GapNodeMatcher':
      return buildStubNode(buildGapTag());

    case 'NullNodeMatcher':
      return buildStubNode(buildNullTag());

    case 'ArrayNodeMatcher':
      return [];

    case 'Call': {
      const { verb, arguments: args } = node.properties;

      const args_ = [...btree.traverse(args.node)].map((el) => reifyExpression(el.node));

      return { verb: reifyExpression(verb.node), arguments: args_ };
    }

    case 'Object': {
      const { properties } = node.properties;

      return Object.fromEntries(
        [...btree.traverse(properties.node)].map((property) => {
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

      return [...btree.traverse(elements.node)].map((el) => reifyExpression(el.node));
    }

    case 'Punctuator':
    case 'Keyword':
      return getCooked(node);

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
      return node;
  }
};
