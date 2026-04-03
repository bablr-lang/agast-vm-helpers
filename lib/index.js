import {
  sourceTextFor,
  getCooked,
  isNullNode,
  isCover,
  buildReferenceTag,
  getRoot,
  get,
  list,
} from '@bablr/agast-helpers/tree';
import * as Tags from '@bablr/agast-helpers/tags';
import {
  buildGapTag,
  buildNullTag,
  buildOpenNodeTag,
  buildShiftTag,
  buildCloseNodeTag,
  buildLiteralTag,
  buildDoctypeTag,
  buildAttributeDefinitionTag,
  nodeFlags,
  referenceFlags,
  buildBindingTag,
  buildDocument,
  buildPropertyTag,
  tokenFlags,
  buildFullOpenNodeTag,
} from '@bablr/agast-helpers/builders';
import { buildEmbeddedMatcher, buildEmbeddedRegex } from './builders.js';
import {
  AttributeDefinition,
  CloseNodeTag,
  GapTag,
  LiteralTag,
  NullTag,
  OpenNodeTag,
} from './symbols.js';
import { buildNode, getFlags } from '@bablr/agast-helpers/path';

const { freeze } = Object;

export const effectsFor = (verb) => {
  switch (verb) {
    case 'eat':
    case 'shift':
    case 'eatHeld':
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

export const reifyBablrOptions = (str) => {
  if (str.length !== 6) throw new Error();
  let literal = str.includes('l');
  let shift = !str.includes('S');
  let bind = str.includes('b');
  let allowEmpty = str.includes('e');
  let internal = str.includes('i');
  let hold = str.includes('h');

  return freeze({ literal, shift, bind, allowEmpty, internal, hold });
};

export const shouldBranch = (effects) => {
  return effects ? effects.success === 'none' || effects.failure === 'none' : false;
};

export const reifyMatcherReferenceName = (matcher) => {
  if (matcher == null) return null;
  return reifyExpression(get(['refMatcher', 'name'], matcher.value));
};

export const reifyNodeFlags = (flags) => {
  let { token, hasGap } = flags.value.attributes;

  return freeze({
    token,
    hasGap,
  });
};

export const reifyReferenceFlags = (flags) => {
  let arrayToken = get('arrayToken', flags);
  let expressionToken = get('expressionToken', flags);
  let intrinsicToken = get('intrinsicToken', flags);
  let hasGapToken = get('hasGapToken', flags);

  return freeze({
    array: !!reifyExpression(arrayToken),
    expression: !!reifyExpression(expressionToken),
    intrinsic: !!reifyExpression(intrinsicToken),
    hasGap: !!reifyExpression(hasGapToken),
  });
};

export const buildTags = (node) => {
  let open = get('openTag', node);

  let openTag = reifyExpression(open);
  let children = buildChildren(list('children', node));
  let closeTag = buildCloseNodeTag();

  if (openTag.value.selfClosing) {
    return Tags.fromValues([openTag]);
  }

  return Tags.fromValues([openTag, children, closeTag]);
};

export const buildChildren = (children) => {
  let built = Tags.fromValues([]);

  for (const child of children) {
    if ([AttributeDefinition, LiteralTag].includes(child.value.name)) {
      built = Tags.push(built, reifyExpression(child));
      continue;
    }

    if (child.value.name !== Symbol.for('Property')) throw new Error('umimplemented');

    let reference = get('referenceTag', child);
    let boundNode = reifyExpression(get(['value'], child));
    let { node, bindingTags } = boundNode;

    let bindings = bindingTags.map((tag) => tag.value);

    let referenceTag =
      reference && !isNullNode(reference) ? reifyExpression(reference) : buildReferenceTag();

    if (node.value.type === Symbol.for('__')) {
      for (let child of Tags.traverse(Tags.getTags(node))) {
        if (![OpenNodeTag, CloseNodeTag].includes(child.value.type))
          built = Tags.push(built, child);
      }
      continue;
    }

    if (node.value.name === NullTag || node.value.name === GapTag) {
      throw new Error('not implemented');
      node = buildNode(node);
    }

    built = Tags.push(
      built,
      buildPropertyTag(Tags.fromValues([referenceTag, Tags.fromValues(bindingTags), node])),
    );
  }

  return built;
};

export const reifyExpression = (node) => {
  if (node instanceof Promise) throw new Error();

  if (node == null) return node;
  if (isNullNode(node)) return null;

  if (isCover(node)) {
    node = getRoot(node);
  }

  if (getFlags(node)?.token && !node.value.name) {
    return getCooked(node);
  }

  switch (node.value.name?.description) {
    case 'Document': {
      let tree = get(['tree', 'node'], node);

      tree = reifyExpression(tree);

      let doctypeTag = null;

      return buildDocument(doctypeTag, tree);
    }

    case 'TreeNode': {
      let open = get('openTag', node);

      let openTag = reifyExpression(open);

      let { flags, name, attributes, literalValue } = openTag.value;

      if (literalValue && !flags.token) {
        let tokenFragment = buildNode(
          Tags.fromValues([buildOpenNodeTag(tokenFlags, null, literalValue, {}, true)]),
        );

        return buildNode(
          Tags.fromValues([
            buildOpenNodeTag(flags, name, null, attributes),
            Tags.fromValues([
              buildPropertyTag(
                Tags.fromValues([buildReferenceTag('_'), Tags.fromValues([]), tokenFragment]),
              ),
            ]),
            buildCloseNodeTag(),
          ]),
        );
      } else {
        return buildNode(buildTags(node));
      }
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
      let flags = get('flags', node);

      name = name && (reifyExpression(name) || null);
      type = type && reifyExpression(type);
      flags = (flags && reifyReferenceFlags(flags)) || undefined;

      return buildReferenceTag(type, name, flags);
    }

    case 'LiteralTag': {
      return buildLiteralTag(getCooked(get(['value', 'content'], node)));
    }

    case 'Identifier': {
      return getCooked(get('content', node));
    }

    case 'IdentifierPath': {
      return freeze(
        [...list('segments', node)].map((segment) =>
          freeze({ type: null, name: reifyExpression(segment) }),
        ),
      );
    }

    case 'AttributeDefinition': {
      let key = get('key', node);
      let value = get('value', node);

      key = key && reifyExpression(key).map((segment) => segment.name);
      value = value && reifyExpression(value);

      return buildAttributeDefinitionTag(key, value);
    }

    case 'NodeFlags': {
      return reifyNodeFlags(node);
    }

    case 'ReferenceFlags': {
      return reifyReferenceFlags(node);
    }

    case 'OpenNodeTag': {
      let flags = get('flags', node);
      let type = get('type', node);
      let name = get('name', node);
      let attributes = get('attributes', node);
      let literalValue = get('literalValue', node);
      let openToken = get('openToken', node);
      let { selfClosing } = node.value.attributes;

      literalValue = literalValue && reifyExpression(literalValue);

      if (!openToken) {
        return buildOpenNodeTag(tokenFlags, null, literalValue, {}, selfClosing);
      }

      let anonymousToken = !openToken;

      flags = anonymousToken ? tokenFlags : (flags && reifyNodeFlags(flags)) || nodeFlags;
      type = reifyExpression(type);
      name = reifyExpression(name);
      attributes = reifyExpression(attributes) || {};

      return buildFullOpenNodeTag(flags, type, name, literalValue, attributes, selfClosing);
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

    case 'GapTag':
      return buildGapTag();

    case 'NullTag':
      return buildNullTag();

    case 'NullNode':
    case 'GapNode':
      let tag = reifyExpression(get('sigilTag', node));
      return buildNode(tag);

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

    case 'TreeNodeMatcherOpen': {
      let flags = get('flags', node);
      let name = get('name', node);
      let type = get('type', node);
      let attributes = get('attributes', node);
      let literalValue = get('literalValue', node);

      flags = (flags && reifyNodeFlags(flags)) || nodeFlags;
      name = name
        ? name.value.name === Symbol.for('String')
          ? getCooked(get('content', name))
          : reifyExpression(name)
        : null;
      type = reifyExpression(type);
      attributes = attributes ? reifyExpression(attributes) : {};
      literalValue = literalValue && reifyExpression(literalValue);

      return freeze({
        flags,
        type,
        name,
        literalValue,
        attributes,
      });
    }

    case 'TreeNodeMatcher': {
      let open = reifyExpression(get('open', node));

      if (!open) {
        return [...list('children', node)].map(reifyExpression)[0];
      }

      return open;
    }

    case 'PropertyMatcher': {
      let refMatcher = get('refMatcher', node);
      let boundMatcher = get('valueMatcher', node);

      refMatcher = reifyExpression(refMatcher);

      if (!boundMatcher) throw new Error();

      if (boundMatcher.value.name !== Symbol.for('BoundNodeMatcher')) throw new Error();

      let { nodeMatcher, bindingMatchers } = reifyExpression(boundMatcher);

      return freeze({ refMatcher, bindingMatchers, nodeMatcher });
    }

    case 'ReferenceMatcher': {
      let type = get('type', node);
      let name = get('name', node);
      let flags = get('flags', node);

      type = type && reifyExpression(type);
      name = name && reifyExpression(name);
      flags = (flags && reifyReferenceFlags(flags)) || referenceFlags;

      return freeze({ type, name, flags });
    }

    case 'BoundNodeMatcher': {
      let bindingMatchers, nodeMatcher;
      // if (get(['nodeMatcher', 'open'], node)) {
      bindingMatchers = [...list('bindingMatchers', node)].map(reifyExpression);
      nodeMatcher = reifyExpression(get('nodeMatcher', node));
      // } else {
      //   ({ bindingMatchers, nodeMatcher } = reifyExpression(get('nodeMatcher', node)));
      // }

      return freeze({ bindingMatchers, nodeMatcher });
    }

    case 'BoundNode': {
      let bindingTags = [],
        node_;
      if (get(['node', 'openTag'], node) || get(['node', 'sigilTag'], node)) {
        bindingTags = [...list('bindingTags', node)].map(reifyExpression);
        node_ = reifyExpression(get('node', node));
      } else {
        ({ bindingTags, node: node_ } = reifyExpression(get('node', node)));
      }

      return freeze({ bindingTags, node: node_ });
    }

    case 'BindingTag': {
      let segments = [...list('segments', node)].map((segment) => {
        return reifyExpression(segment);
      });
      return buildBindingTag(segments);
    }

    case 'BindingSegment': {
      let path = get('path', node);

      switch (path.value.name && path.value.name.description) {
        case 'Identifier':
          return freeze({ type: null, name: reifyExpression(path) });
        case null:
          return freeze({ type: reifyExpression(path), name: null });
        default:
          throw new Error();
      }
    }

    case 'BindingMatcher': {
      let segments = [...list('segments', node)].map((segment) => reifyExpression(segment));

      return freeze({ segments });
    }

    case 'GapNodeMatcher':
      return buildNode(buildGapTag());

    case 'NullNodeMatcher':
      return buildNode(buildNullTag());

    case 'Call': {
      const verb = get('verb', node);

      const args = [...list('arguments', node)].map((el) => reifyExpression(el));

      return freeze({ verb: reifyExpression(verb), arguments: args });
    }

    case 'Object': {
      return Object.fromEntries(
        [...list('properties', node)].map((property) => {
          const key = get('key', property);
          const value = get('value', property);
          return freeze([reifyExpression(key), reifyExpression(value)]);
        }),
      );
    }

    case 'Array': {
      return freeze([...list('elements', node)].map((el) => reifyExpression(el)));
    }

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
