import { Injectable, Logger } from '@nestjs/common';
import { parse } from '@rsql/parser';
import { InvalidSearchExpression } from '../../domain/errors/errors.js';

type MongoQuery = Record<string, unknown>;
export type RsqlValue = string | number | null;

// @rsql/ast is only a transitive dependency, so its node types are derived from parse().
export type ExpressionNode = ReturnType<typeof parse>;
export type ComparisonNode = Extract<ExpressionNode, { type: 'COMPARISON' }>;

/** Plain field paths only: no `$` operators, so a selector cannot inject a Mongo operator. */
const SELECTOR_PATTERN = /^[A-Za-z_][A-Za-z0-9_.]*$/;
export const MAX_REGEX_LENGTH = 100;

@Injectable()
export class RsqlParser {
  private readonly logger = new Logger(RsqlParser.name);

  public parse(rsql: string | undefined): MongoQuery {
    const node = this.parseExpression(rsql);
    return node ? this.toMongo(node) : {};
  }

  /** The syntax tree of an expression, undefined for an empty one; an invalid one is an InvalidSearchExpression. */
  public parseExpression(rsql: string | undefined): ExpressionNode | undefined {
    if (!rsql || rsql.trim() === '') return undefined;
    let node: ExpressionNode;
    try {
      node = parse(rsql);
    } catch (error) {
      throw new InvalidSearchExpression(`Invalid RSQL query: ${rsql}. ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    checkSelectors(node);
    return node;
  }

  /** The Mongo filter of a syntax tree from parseExpression. */
  public toMongo(node: ExpressionNode): MongoQuery {
    const result = this.processNode(node);
    this.logger.verbose(`Converted MongoDB query: ${JSON.stringify(result)}`);
    return result;
  }

  private processNode(node: ExpressionNode): MongoQuery {
    if (node.type === 'COMPARISON') return this.processComparison(node);
    switch (node.operator) {
      case ';':
        return { $and: [this.processNode(node.left), this.processNode(node.right)] };
      case ',':
        return { $or: [this.processNode(node.left), this.processNode(node.right)] };
      default:
        throw new InvalidSearchExpression(`Unsupported logic operator: ${node.operator}`);
    }
  }

  private processComparison(node: ComparisonNode): MongoQuery {
    let field = node.left.selector;
    if (field === 'id') field = '_id';
    const raw = node.right.value;
    const value = coerce(Array.isArray(raw) ? raw[0] : raw);

    switch (node.operator) {
      case '==':
        return { [field]: value };
      case '!=':
        // For null, require field exists and is not null (inverse of == null)
        if (value === null) return { [field]: { $ne: null, $exists: true } };
        return { [field]: { $ne: value } };
      case '>':
        return { [field]: { $gt: value } };
      case '>=':
        return { [field]: { $gte: value } };
      case '<':
        return { [field]: { $lt: value } };
      case '<=':
        return { [field]: { $lte: value } };
      case '=in=':
        return { [field]: { $in: toArray(raw).map(coerce) } };
      case '=out=':
        return { [field]: { $nin: toArray(raw).map(coerce) } };
      case '=re=': {
        if (value === null) throw new InvalidSearchExpression('Regex operator cannot be applied to null');
        const text = String(value);
        checkRegexLength(text);
        // Case-insensitive substring match: the value is text, not a pattern.
        return { [field]: { $regex: escapeRegex(text), $options: 'i' } };
      }
      default:
        throw new InvalidSearchExpression(`Unsupported operator: ${node.operator}`);
    }
  }
}

export const toArray = (raw: string | string[]): string[] => (Array.isArray(raw) ? raw : [raw]);

/** Every selector of the tree is a plain field path. */
function checkSelectors(node: ExpressionNode): void {
  if (node.type !== 'COMPARISON') {
    checkSelectors(node.left);
    checkSelectors(node.right);
    return;
  }
  const field = node.left.selector;
  if (!SELECTOR_PATTERN.test(field) || field.split('.').some(part => part === '')) {
    throw new InvalidSearchExpression(`Invalid field selector: ${field}`);
  }
}

export function checkRegexLength(text: string): void {
  if (text.length > MAX_REGEX_LENGTH) throw new InvalidSearchExpression(`Regex value longer than ${MAX_REGEX_LENGTH} characters`);
}

/** `null` (any case) becomes null and numeric strings become numbers; anything else stays a string. */
export function coerce(raw: string | undefined): RsqlValue {
  if (raw === undefined) throw new InvalidSearchExpression('Missing comparison value');
  if (raw.trim().toLowerCase() === 'null') return null;
  if (raw.trim() !== '') {
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return raw;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
