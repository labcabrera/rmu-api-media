import { bindSelectors, matchesRsql } from '../../../../src/modules/shared/infrastructure/db/rsql-matcher.js';
import { RsqlParser } from '../../../../src/modules/shared/infrastructure/db/rsql-parser.js';

const parser = new RsqlParser();
const tree = (rsql: string) => parser.parseExpression(rsql)!;
const record = {
  id: 'base:images/races/elf.png',
  category: 'races',
  url: 'images/races/elf.png',
  sizeBytes: 2048,
  width: null,
  verified: true,
  metadata: { source: 'repo' },
};
const matches = (rsql: string) => matchesRsql(tree(rsql), record);

describe('matchesRsql', () => {
  it.each([
    ['category==races', true],
    ['category==items', false],
    ['category!=items', true],
    ['missing!=x', true],
    ['missing==null', true],
    ['width==null', true],
    ['width!=null', false],
    ['category!=null', true],
    ['sizeBytes==2048', true],
    ['sizeBytes>2000', true],
    ['sizeBytes>=2048', true],
    ['sizeBytes<2048', false],
    ['sizeBytes<=2048', true],
    ['category>q', true],
    ['category<q', false],
    ['category>1', false],
    ['category=in=(items,races)', true],
    ['category=in=(items,npcs)', false],
    ['missing=in=(null,x)', true],
    ['category=out=(items,npcs)', true],
    ['category=out=(races)', false],
    ['url=re=ELF', true],
    ['sizeBytes=re=20', false],
    ['metadata.source==repo', true],
    ['metadata.source.deep==repo', false],
    ['category==races;sizeBytes>4000', false],
    ['category==items,sizeBytes>1000', true],
    ['id=="base:images/races/elf.png"', true],
    // As in Mongo, the RSQL text "true" is not the boolean true.
    ['verified==true', false],
  ])('%s is %s', (rsql, expected) => {
    expect(matches(rsql)).toBe(expected);
  });

  it('rejects a regex on null and a regex that is too long', () => {
    expect(() => matches('url=re=null')).toThrow(expect.objectContaining({ code: 'invalid-search' }));
    expect(() => matches(`url=re=${'a'.repeat(101)}`)).toThrow(expect.objectContaining({ code: 'invalid-search' }));
  });

  it('rejects an operator it does not know', () => {
    const node = { ...tree('category==races'), operator: '=like=' } as unknown as ReturnType<typeof tree>;
    expect(() => matchesRsql(node, record)).toThrow(expect.objectContaining({ code: 'invalid-search' }));
    const logic = { type: 'LOGIC', operator: '^', left: tree('a==1'), right: tree('b==1') } as unknown as ReturnType<typeof tree>;
    expect(() => matchesRsql(logic, record)).toThrow(expect.objectContaining({ code: 'invalid-search' }));
  });
});

describe('bindSelectors', () => {
  const bind = (rsql: string) => bindSelectors(tree(rsql), { source: 'user' });
  const mongo = (rsql: string) => {
    const bound = bind(rsql);
    return typeof bound === 'boolean' ? bound : parser.toMongo(bound);
  };

  it.each([
    ['source==user', true],
    ['source==base', false],
    ['source!=base', true],
    ['source=in=(base,user)', true],
    ['source==base;category==races', false],
    ['category==races;source==base', false],
    ['source==user,category==races', true],
    ['category==races,source==user', true],
  ])('decides %s as %s', (rsql, expected) => {
    expect(bind(rsql)).toBe(expected);
  });

  it.each([
    ['source==user;category==races', { category: 'races' }],
    ['category==races;source==user', { category: 'races' }],
    ['source==base,category==races', { category: 'races' }],
    ['category==races,source==base', { category: 'races' }],
    ['category==races;owner==x', { $and: [{ category: 'races' }, { owner: 'x' }] }],
    ['(source==base,category==races);(source==user,owner==x)', { category: 'races' }],
  ])('leaves %s as the rest of the filter', (rsql, filter) => {
    expect(mongo(rsql)).toEqual(filter);
  });
});

describe('RsqlParser.parseExpression', () => {
  it('has no tree for an empty expression and rejects a bad selector anywhere in the tree', () => {
    expect(parser.parseExpression('  ')).toBeUndefined();
    expect(parser.parse(undefined)).toEqual({});
    expect(() => parser.parseExpression('category==a;$where==1')).toThrow(expect.objectContaining({ code: 'invalid-search' }));
    expect(() => parser.parseExpression('a..b==1')).toThrow(expect.objectContaining({ code: 'invalid-search' }));
  });
});
