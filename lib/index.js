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
  buildBounds,
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
  buildProperty,
  fragmentFlags,
  buildAttributeDefinition,
  buildPropertyWrapper,
  nodeFlags,
  tokenFragmentFlags,
  buildPropertyWrapperTagFrom,
  buildReference,
  buildBinding,
  referenceFlags,
} from '@bablr/agast-helpers/builders';
import { buildEmbeddedMatcher, buildEmbeddedRegex } from './builders.js';
import {
  AttributeDefinition,
  CloseNodeTag,
  GapTag,
  LiteralTag,
  NullTag,
  OpenNodeTag,
  Property,
  PropertyWrapper,
} from './symbols.js';

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

export const reifyBablrOptions = (str) => {
  if (str.length !== 4) throw new Error();
  let shift = !str.includes('S');
  let bind = str.includes('b');
  let allowEmpty = str.includes('e');
  let internal = str.includes('i');

  return freeze({ shift, bind, allowEmpty, internal });
};

export const shouldBranch = (effects) => {
  return effects ? effects.success === 'none' || effects.failure === 'none' : false;
};

export const reifyMatcherReferenceName = (matcher) => {
  if (matcher == null) return null;
  return reifyExpression(get(['refMatcher', 'name'], matcher.value));
};

export const reifyNodeFlags = (flags) => {
  let { token, hasGap, fragment, cover } = flags.attributes;

  return { token, hasGap, fragment, cover };
};

export const reifyReferenceFlags = (flags) => {
  let expressionToken = get('expressionToken', flags);
  let intrinsicToken = get('intrinsicToken', flags);
  let hasGapToken = get('hasGapToken', flags);

  return {
    expression: !!reifyExpression(expressionToken),
    intrinsic: !!reifyExpression(intrinsicToken),
    hasGap: !!reifyExpression(hasGapToken),
  };
};

export const buildTags = (node) => {
  let open = get('openTag', node);

  let children = buildChildren(list('children', node));
  let openTag = reifyExpression(open);
  let closeTag = buildCloseNodeTag();

  if (openTag.value.selfClosing) {
    return Tags.fromValues([openTag]);
  }

  return Tags.fromValues([openTag, children, closeTag]);
};

export const buildChildren = (children) => {
  let built = Tags.fromValues([]);

  for (const child of children) {
    if ([AttributeDefinition, LiteralTag].includes(child.type)) {
      built = Tags.push(built, reifyExpression(child));
      continue;
    }

    if (child.type !== Symbol.for('Property')) throw new Error('umimplemented');

    let reference = get('referenceTag', child);
    let boundNode = reifyExpression(get('value', child));
    let { node, bindingTags } = boundNode;

    let bindings = bindingTags.map((tag) => tag.value);

    let referenceTag =
      reference && !isNullNode(reference) ? reifyExpression(reference) : buildReferenceTag();

    if (node.flags.fragment && !node.flags.cover) {
      for (let child of Tags.traverse(node.tags)) {
        if (![OpenNodeTag, CloseNodeTag].includes(child.type)) built = Tags.push(built, child);
      }
      continue;
    }

    if (node.type === NullTag || node.type === GapTag) {
      throw new Error('not implemented');
      node = buildStubNode(node);
    }

    let property = buildProperty(referenceTag.value, bindings, node);
    built = Tags.push(
      built,
      buildChild(
        PropertyWrapper,
        buildPropertyWrapper([referenceTag, bindingTags, buildChild(Property, property)], property),
      ),
    );
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

  if (typeof node.type === 'string') {
    throw new Error();
  }

  if (node.flags.token && !node.type) {
    return getCooked(node);
  }

  switch (node.type?.description || node.type) {
    case 'Document': {
      let tree = get(['tree', 'node'], node);

      tree = reifyExpression(tree);

      return Object.freeze({
        flags: fragmentFlags,
        type: null,
        bounds: tree.bounds,
        tags: tree.tags,
        children: tree.tags[1][1],
        attributes: {},
      });
    }

    case 'TreeNode': {
      let open = get('openTag', node);

      let openTag = reifyExpression(open);

      let { flags, type, attributes, literalValue } = openTag.value;

      if (literalValue && !flags.token) {
        let tokenFragment = Object.freeze({
          flags: tokenFragmentFlags,
          type: null,
          bounds: buildBounds(),
          tags: Tags.fromValues([
            buildOpenNodeTag(tokenFragmentFlags, null, literalValue, {}, true),
          ]),
          children: Tags.fromValues([]),
          attributes: {},
        });

        let children = Tags.fromValues([
          buildPropertyWrapperTagFrom(buildReference(), buildBindingg(), tokenFragment),
        ]);
        return freeze({
          flags,
          type,
          bounds: buildBounds(),
          tags: Tags.fromValues([
            buildOpenNodeTag(flags, type, null, attributes),
            children,
            buildCloseNodeTag(),
          ]),
          children,
          attributes,
        });
      } else {
        let tags = buildTags(node);
        return freeze({
          flags,
          type,
          bounds: buildBounds(),
          tags,
          children: Tags.getValues(tags)[1],
          attributes,
        });
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
      let arrayOperatorToken = get('arrayOperatorToken', node);
      let flags = get('flags', node);

      name = name && (reifyExpression(name) || null);
      type = type && reifyExpression(type);
      flags = (flags && reifyReferenceFlags(flags)) || undefined;

      return buildReferenceTag(type, name, !isNull(arrayOperatorToken), flags);
    }

    case 'LiteralTag': {
      return buildLiteralTag(getCooked(get(['value', 'content'], node)));
    }

    case 'Identifier': {
      return getCooked(get('content', node));
    }

    case 'IdentifierPath': {
      return freeze([...list('segments', node)].map((segment) => reifyExpression(segment)));
    }

    case 'AttributeDefinition': {
      let path = get('path', node);
      let value = get('value', node);

      path = path && reifyExpression(path).map((segment) => segment.name);
      value = value && reifyExpression(value);

      return buildAttributeDefinition(path, value);
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
      let attributes = get('attributes', node);
      let literalValue = get('literalValue', node);
      let openToken = get('openToken', node);
      let selfClosing = get('selfClosingToken', node);

      literalValue = literalValue && reifyExpression(literalValue);

      if (!openToken) {
        if (!literalValue) throw new Error();

        return buildOpenNodeTag(tokenFragmentFlags, null, literalValue, {});
      }

      let anonymousToken = !openToken;

      flags = anonymousToken ? tokenFragmentFlags : (flags && reifyNodeFlags(flags)) || nodeFlags;
      type = (type && reifyExpression(type)) || null;
      attributes = (attributes && reifyExpression(attributes)) || {};
      selfClosing = !!(selfClosing && reifyExpression(selfClosing));

      // if (literalValue && !flags.token) {
      //   return buildOpenNodeTag(tokenFragmentFlags, null, literalValue, {}, true);
      // }

      return buildOpenNodeTag(flags, type, literalValue, attributes, selfClosing);
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
      return buildStubNode(tag);

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
      let type = get('type', node);
      let attributes = get('attributes', node);
      let literalValue = get('literalValue', node);

      flags = (flags && reifyNodeFlags(flags)) || {};
      type = type
        ? type.type === Symbol.for('String')
          ? getCooked(get('content', type))
          : reifyExpression(type)
        : null;
      attributes = attributes ? reifyExpression(attributes) : {};
      literalValue = literalValue && reifyExpression(literalValue);

      return freeze({ flags, type, literalValue, attributes });
    }

    case 'FragmentMatcher': {
      let flags = get('flags', node);

      flags = (flags && reifyNodeFlags(flags)) || {};

      return {
        flags,
        type: Symbol.for('@bablr/fragment'),
        literalValue: null,
        attributes: null,
      };
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

      if (boundMatcher.type !== Symbol.for('BoundNodeMatcher')) throw new Error();

      let { nodeMatcher, bindingMatchers } = reifyExpression(boundMatcher);

      return freeze({ refMatcher, bindingMatchers, nodeMatcher });
    }

    case 'ReferenceMatcher': {
      let type = get('type', node);
      let name = get('name', node);
      let isArray = !isNull(get('openIndexToken', node));
      let flags = get('flags', node);

      type = type && reifyExpression(type);
      name = name && reifyExpression(name);
      flags = (flags && reifyReferenceFlags(flags)) || referenceFlags;

      return freeze({ type, name, isArray, flags });
    }

    case 'BoundNodeMatcher': {
      let bindingMatchers, nodeMatcher;
      if (get(['nodeMatcher', 'open'], node)) {
        bindingMatchers = [...list('bindingMatchers', node)].map(reifyExpression);
        nodeMatcher = reifyExpression(get('nodeMatcher', node));
      } else {
        ({ bindingMatchers, nodeMatcher } = reifyExpression(get('nodeMatcher', node)));
      }

      return freeze({ bindingMatchers, nodeMatcher });
    }

    case 'BoundNode': {
      let bindingTags, node_;
      if (get(['node', 'openTag'], node)) {
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
      return freeze({ segments });
    }

    case 'BindingSegment': {
      let path = get('path', node);

      switch (path.type && path.type.description) {
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
      return buildStubNode(buildGapTag());

    case 'NullNodeMatcher':
      return buildStubNode(buildNullTag());

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
