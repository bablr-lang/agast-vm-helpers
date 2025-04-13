import { buildEmbeddedObject } from './builders';

const { isArray } = Array;
const isString = (val) => typeof val === 'string';
const isNumber = (val) => typeof val === 'number';

export const embedExpression = (expr) => {
  if (isString(expr) || expr == null || typeof expr === 'boolean' || isNumber(expr)) {
    return expr;
  } else if (isArray(expr)) {
    return expr.map((value) => embedExpression(value));
  } else if (typeof expr === 'object') {
    return buildEmbeddedObject(
      Object.fromEntries(
        Object.entries(expr).map(({ 0: key, 1: value }) => [key, embedExpression(value)]),
      ),
    );
  } else {
    throw new Error();
  }
};

export { buildEmbeddedObject, buildEmbeddedObject as o };
