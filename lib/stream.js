import { Coroutine } from '@bablr/coroutine';
import {
  CloseNodeTag,
  EmbeddedObject,
  GapTag,
  NullTag,
  OpenNodeTag,
  ReferenceTag,
} from './symbols.js';
import {
  getStreamIterator,
  printTag,
  wait,
  StreamIterable,
  prettyGroupTags,
  hoistTrivia,
} from '@bablr/agast-helpers/stream';
import { buildWriteEffect } from './builders.js';

const getEmbeddedObject = (obj) => {
  if (obj.type !== EmbeddedObject) throw new Error();
  return obj.value;
};

function* __generateStandardOutput(tags) {
  const co = new Coroutine(getStreamIterator(tags));

  for (;;) {
    co.advance();

    if (co.current instanceof Promise) {
      co.current = yield wait(co.current);
    }
    if (co.done) break;

    const tag = co.value;

    if (tag.type === 'Effect') {
      const effect = tag.value;
      if (effect.verb === 'write') {
        const writeEffect = getEmbeddedObject(effect.value);
        if (writeEffect.stream == null || writeEffect.stream === 1) {
          yield* writeEffect.text;
        }
      }
    }
  }
}

export const generateStandardOutput = (tags) => new StreamIterable(__generateStandardOutput(tags));

function* __generateAllOutput(tags) {
  const co = new Coroutine(getStreamIterator(tags));

  let currentStream = null;

  for (;;) {
    co.advance();

    if (co.current instanceof Promise) {
      co.current = yield wait(co.current);
    }
    if (co.done) break;

    const tag = co.value;

    if (tag.type === 'Effect') {
      const effect = tag.value;
      if (effect.verb === 'write') {
        const writeEffect = getEmbeddedObject(effect.value);
        const prevStream = currentStream;
        currentStream = getEmbeddedObject(writeEffect.options).stream || 1;
        if (
          prevStream &&
          (prevStream !== currentStream || currentStream === 2) &&
          !writeEffect.text.startsWith('\n')
        ) {
          yield* '\n';
        }
        yield* writeEffect.text;
      }
    }
  }
}

export const generateAllOutput = (tags) => new StreamIterable(__generateAllOutput(tags));

function* __writeCSTMLStrategy(tags) {
  if (!tags) {
    yield buildWriteEffect('<//>');
    return;
  }

  let prevTag = null;

  const co = new Coroutine(getStreamIterator(prettyGroupTags(tags)));

  for (;;) {
    co.advance();

    if (co.current instanceof Promise) {
      co.current = yield wait(co.current);
    }
    if (co.done) break;

    const tag = co.value;

    if (tag.type === ReferenceTag && prevTag.type === NullTag) {
      yield buildWriteEffect(' ');
    }

    if (tag.type === 'Effect') {
      yield tag;

      continue;
    }

    yield buildWriteEffect(printTag(tag));

    prevTag = tag;
  }

  yield buildWriteEffect('\n');
}

export const writeCSTMLStrategy = (tags, options = {}) =>
  new StreamIterable(__writeCSTMLStrategy(tags, options));

function* __writePrettyCSTMLStrategy(tags, options) {
  let { indent = '  ', emitEffects = false, inline: inlineOption = true } = options;

  if (!tags) {
    yield buildWriteEffect('<//>');
    return;
  }

  const co = new Coroutine(getStreamIterator(prettyGroupTags(hoistTrivia(tags))));
  // const co = new Coroutine(getStreamIterator(prettyGroupTags(tags)));
  let indentLevel = 0;
  let first = true;
  let inline = false;
  let ref = null;

  for (;;) {
    co.advance();

    if (co.current instanceof Promise) {
      co.current = yield wait(co.current);
    }
    if (co.done) break;

    const tag = co.value;

    if (tag.type === 'Effect') {
      const effect = tag.value;
      if (emitEffects && effect.verb === 'write') {
        const writeEffect = getEmbeddedObject(effect.value);
        yield buildWriteEffect(
          (first ? '' : '\n') + writeEffect.text,
          getEmbeddedObject(writeEffect.options),
        );

        inline = false;
        first = false;
      } else {
        yield tag;
      }
      continue;
    }

    inline =
      inlineOption &&
      inline &&
      ref &&
      (tag.type === NullTag ||
        tag.type === GapTag ||
        (tag.type === OpenNodeTag && tag.value.selfClosing));

    if (!first && !inline) {
      yield buildWriteEffect('\n');
    }

    if (tag.type === CloseNodeTag) {
      ref = null;
      if (indentLevel === 0) {
        throw new Error('imbalanced tag stack');
      }

      indentLevel--;
    }

    if (!inline) {
      yield buildWriteEffect(indent.repeat(indentLevel));
    } else {
      yield buildWriteEffect(' ');
    }

    yield buildWriteEffect(printTag(tag));

    if (tag.type === ReferenceTag) {
      inline = true;
      ref = tag;
    }

    if (tag.type === OpenNodeTag && !tag.value.selfClosing) {
      indentLevel++;
    }

    first = false;
  }

  yield buildWriteEffect('\n');
}

export const writePrettyCSTMLStrategy = (tags, options = {}) => {
  return new StreamIterable(__writePrettyCSTMLStrategy(tags, options));
};
