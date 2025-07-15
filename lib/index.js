import {
  sourceTextFor,
  getCooked,
  isNull,
  isNullNode,
  buildStubNode,
  isFragmentNode,
  buildReferenceTag,
  getRoot,
  buildChild,
  get,
  list,
} from '@bablr/agast-helpers/tree';
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
  fragmentFlags,
  buildBinding,
  buildAttributeDefinition,
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
  let tokenToken = get('tokenToken', flags);
  let hasGapToken = get('hasGapToken', flags);
  let fragmentToken = get('fragmentToken', flags);
  let multiFragmentToken = get('multiFragmentToken', flags);

  let token = !!(tokenToken && reifyExpression(tokenToken));
  let hasGap = !!(hasGapToken && reifyExpression(hasGapToken));
  let fragment = !!(fragmentToken && reifyExpression(fragmentToken));
  let cover = !!(fragment && !(multiFragmentToken && reifyExpression(multiFragmentToken)));

  return { token, hasGap, fragment, cover };
};

export const reifyReferenceFlags = (flags) => {
  let expressionToken = get('expressionToken', flags);
  let hasGapToken = get('hasGapToken', flags);

  return {
    expression: !!(expressionToken && reifyExpression(expressionToken)),
    hasGap: !!(hasGapToken && reifyExpression(hasGapToken)),
  };
};

export const reifyProperties = (properties = list()) => {
  const built = {};
  for (const property of properties) {
    switch (property.type) {
      case Symbol.for('Property'): {
        let reference = get('reference', property);
        let binding = get('binding', property);
        let node = get('value', property);

        reference = (reference ? reifyExpression(reference) : buildReferenceTag('.')).value;
        binding = (binding ? reifyExpression(binding) : buildBindingTag()).value;
        node = reifyExpression(node);

        let { name, isArray } = reference;
        if (name) {
          if (isArray) {
            built[name] ||= [];
            built[name].push({ reference, binding, node });
          } else {
            built[name] = { reference, binding, node };
          }
        }
        break;
      }
    }
  }
  return built;
};

export const buildChildren = (node) => {
  let open = get('open', node);
  let children = list('children', node);
  let close = get('close', node);

  const selfClosing = !isNull(get('selfClosingTagToken', open));
  const intrinsicValue = get('intrinsicValue', open);
  let built = [];

  open = reifyExpression(open);
  close = reifyExpression(close);

  if (selfClosing) {
    built = sumtree.push(built, open);
    if (!isNull(intrinsicValue)) {
      built = sumtree.push(built, buildLiteralTag(reifyExpression(intrinsicValue)));
    }
    built = sumtree.push(built, buildCloseNodeTag());
  } else {
    built = sumtree.push(built, open);
    for (const child of children) {
      if ([AttributeDefinition, LiteralTag].includes(child.type)) {
        built = sumtree.push(built, reifyExpression(child));
        continue;
      }

      if (child.type !== Symbol.for('Property')) throw new Error('umimplemented');

      let reference = get('reference', child);
      let binding = get('binding', child);
      let value = get('value', child);

      let referenceTag = reference ? reifyExpression(reference) : buildReferenceTag('.');
      let bindingTag = binding
        ? reifyExpression(binding)
        : buildBindingTag(isStubNode(value) ? null : []);

      value = reifyExpression(value);

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
          buildChild(Property, buildProperty(referenceTag.value, buildBinding(), value)),
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
      let doctype = get('doctype', node);
      let tree = get('tree', node);
      let tree_ = tree;

      doctype = reifyExpression(doctype);
      tree = reifyExpression(tree);

      let { attributes } = doctype.value;
      let { properties } = tree;

      return Object.freeze({
        flags: fragmentFlags,
        type: null,
        children: sumtree.addAt(0, buildChildren(tree_), buildDoctypeTag(attributes)),
        properties,
        attributes,
      });
    }

    case 'Node': {
      let open = get('open', node);
      let children = list('children', node);

      open = reifyExpression(open);

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
      let version = get('version', node);
      let attributes = get('attributes', node);

      return buildDoctypeTag(
        attributes && reifyExpression(attributes),
        parseInt(sourceTextFor(version), 10),
      );
    }

    case 'ReferenceTag': {
      let type = get('type', node);
      let name = get('name', node);
      let arrayOperatorToken = get('arrayOperatorToken', node);
      let flags = get('flags', node);

      name = name && reifyExpression(name);
      type = type && reifyExpression(type);
      flags = freeze({
        expression: !!(flags && get('expressionToken', flags)),
        hasGap: !!(flags && get('hasGapToken', flags)),
      });

      return buildReferenceTag(type, name, !isNull(arrayOperatorToken), flags);
    }

    case 'LiteralTag': {
      return buildLiteralTag(getCooked(get(['value', 'content'], node)));
    }

    case 'Identifier': {
      return getCooked(get('content', node));
    }

    case 'IdentifierPath': {
      return [...list('segments', node)].map((segment) => reifyExpression(segment));
    }

    case 'AttributeDefinition': {
      let path = get('path', node);
      let value = get('value', node);

      path = path && reifyExpression(path);
      value = value && reifyExpression(value);

      return buildAttributeDefinition(path, value);
    }

    case 'OpenNodeTag': {
      let flags = get('flags', node);
      let type = get('type', node);
      let attributes = get('attributes', node);

      flags = reifyNodeFlags(flags);
      type = reifyExpression(type);
      attributes = reifyExpression(attributes);

      return buildOpenNodeTag(flags, type, attributes);
    }

    case 'CloseNodeTag': {
      return buildCloseNodeTag();
    }

    case 'Integer': {
      return parseInt([...list('digits', node)].map((digit) => getCooked(digit)).join(''), 10);
    }

    case 'Infinity': {
      return getCooked(get('sign', node)) === '-' ? -Infinity : Infinity;
    }

    case 'Punctuator': {
      return getCooked(node);
    }

    case 'GapTag':
      return buildGapTag();

    case 'InitializerTag':
      return buildInitializerTag();

    case 'BindingTag':
      let languagePath = get('languagePath', node);

      return buildBindingTag(reifyExpression(languagePath));

    case 'NullTag':
      return buildNullTag();

    case 'ShiftTag':
      return buildShiftTag();

    case 'String':
      return get('content', node) ? getCooked(get('content', node)) : '';

    case 'SpamexString': {
      return buildEmbeddedMatcher(get('content', node));
    }

    case 'RegexString': {
      return buildEmbeddedRegex(get('content', node));
    }

    case 'OpenNodeMatcher': {
      let flags = get('flags', node);
      let type = get('type', node);
      let attributes = get('attributes', node);
      let intrinsicValue = get('intrinsicValue', node);

      flags = (flags && reifyNodeFlags(flags)) || {};
      type =
        type.type === Symbol.for('String')
          ? getCooked(get('content', type))
          : reifyExpression(type);
      attributes = attributes ? reifyExpression(attributes) : {};
      intrinsicValue = intrinsicValue && reifyExpression(intrinsicValue);

      return { flags, type, intrinsicValue, attributes };
    }

    case 'FragmentMatcher': {
      let flags = get('flags', node);

      flags = (flags && reifyNodeFlags(flags)) || {};

      return {
        flags,
        type: Symbol.for('@bablr/fragment'),
        intrinsicValue: null,
        attributes: null,
      };
    }

    case 'BasicNodeMatcher': {
      return reifyExpression(get('open', node));
    }

    case 'PropertyMatcher': {
      let refMatcher = get('refMatcher', node);
      let bindingMatcher = get('bindingMatcher', node);
      let nodeMatcher = get('nodeMatcher', node);

      refMatcher = refMatcher ? reifyExpression(refMatcher) : null;
      bindingMatcher = bindingMatcher ? reifyExpression(bindingMatcher) : null;
      nodeMatcher = reifyExpression(nodeMatcher);

      return { refMatcher, bindingMatcher, nodeMatcher };
    }

    case 'ReferenceMatcher': {
      let type = get('type', node);
      let name = get('name', node);
      let isArray = !isNull(get('openIndexToken', node));
      let flags = get('flags', node);

      type = type && reifyExpression(type);
      name = name && reifyExpression(name);
      flags = (flags && reifyReferenceFlags(flags)) || referenceFlags;

      return { type, name, isArray, flags };
    }

    case 'BindingMatcher': {
      let languagePath = get('languagePath', node);

      languagePath = languagePath && reifyExpression(languagePath);

      return { languagePath };
    }

    case 'GapNodeMatcher':
      return buildStubNode(buildGapTag());

    case 'NullNodeMatcher':
      return buildStubNode(buildNullTag());

    case 'ArrayNodeMatcher':
      return [];

    case 'Call': {
      const verb = get('verb', node);

      const args = [...list('arguments', node)].map((el) => reifyExpression(el));

      return { verb: reifyExpression(verb), arguments: args };
    }

    case 'Object': {
      return Object.fromEntries(
        [...list('properties', node)].map((property) => {
          const key = get('key', property);
          const value = get('value', property);
          return [reifyExpression(key), reifyExpression(value)];
        }),
      );
    }

    case 'Array': {
      return [...list('elements', node)].map((el) => reifyExpression(el));
    }

    case 'Punctuator':
    case 'Keyword':
      return getCooked(node);

    case 'Boolean': {
      // prettier-ignore
      switch (getCooked(get('sigilToken', node))) {
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
