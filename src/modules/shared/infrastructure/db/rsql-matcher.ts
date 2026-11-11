import { InvalidSearchExpression } from '../../domain/errors/errors.js';
import { checkRegexLength, coerce, toArray, type ComparisonNode, type ExpressionNode, type RsqlValue } from './rsql-parser.js';

/** A record searched in memory: field paths (`metadata.source`) are resolved through nested objects. */
export type RsqlRecord = Record<string, unknown>;

/**
 * Evaluates an RSQL tree from RsqlParser.parseExpression against a record in memory, with the semantics of the Mongo
 * filter RsqlParser builds: values are coerced the same way (null, numbers), `==` is strict, `!=` and `=out=` match
 * a missing field, comparisons only hold between two numbers or two strings and `=re=` is a case-insensitive
 * substring of a text field.
 */
export function matchesRsql(node: ExpressionNode, record: RsqlRecord): boolean {
  if (node.type !== 'COMPARISON') {
    if (node.operator === ';') return matchesRsql(node.left, record) && matchesRsql(node.right, record);
    if (node.operator === ',') return matchesRsql(node.left, record) || matchesRsql(node.right, record);
    throw new InvalidSearchExpression(`Unsupported logic operator: ${node.operator as string}`);
  }
  return matchesComparison(node, resolve(record, node.left.selector));
}

/**
 * Replaces the comparisons on the selectors of `values` (fields every record of a source shares, like `source`) with
 * their result and simplifies the tree: true or false when the whole expression is decided, otherwise what is left.
 */
export function bindSelectors(node: ExpressionNode, values: RsqlRecord): ExpressionNode | boolean {
  if (node.type === 'COMPARISON') {
    return node.left.selector in values ? matchesComparison(node, values[node.left.selector]) : node;
  }
  const left = bindSelectors(node.left, values);
  const right = bindSelectors(node.right, values);
  if (node.operator === ';') {
    if (left === false || right === false) return false;
    if (left === true) return right;
    if (right === true) return left;
  } else {
    if (left === true || right === true) return true;
    if (left === false) return right;
    if (right === false) return left;
  }
  return { ...node, left, right };
}

function matchesComparison(node: ComparisonNode, actual: unknown): boolean {
  const raw = node.right.value;
  const value = coerce(Array.isArray(raw) ? raw[0] : raw);
  switch (node.operator) {
    case '==':
      return value === null ? isMissing(actual) : actual === value;
    case '!=':
      return value === null ? !isMissing(actual) : actual !== value;
    case '>':
      return compare(actual, value, result => result > 0);
    case '>=':
      return compare(actual, value, result => result >= 0);
    case '<':
      return compare(actual, value, result => result < 0);
    case '<=':
      return compare(actual, value, result => result <= 0);
    case '=in=':
      return toArray(raw)
        .map(coerce)
        .some(item => (item === null ? isMissing(actual) : actual === item));
    case '=out=':
      return !toArray(raw)
        .map(coerce)
        .some(item => (item === null ? isMissing(actual) : actual === item));
    case '=re=': {
      if (value === null) throw new InvalidSearchExpression('Regex operator cannot be applied to null');
      const text = String(value);
      checkRegexLength(text);
      return typeof actual === 'string' && actual.toLowerCase().includes(text.toLowerCase());
    }
    default:
      throw new InvalidSearchExpression(`Unsupported operator: ${node.operator}`);
  }
}

const isMissing = (value: unknown) => value === null || value === undefined;

function compare(actual: unknown, value: RsqlValue, test: (result: number) => boolean): boolean {
  if (typeof actual === 'number' && typeof value === 'number') return test(actual - value);
  if (typeof actual === 'string' && typeof value === 'string') return test(actual < value ? -1 : actual > value ? 1 : 0);
  return false;
}

function resolve(record: RsqlRecord, selector: string): unknown {
  let current: unknown = record;
  for (const part of selector.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
