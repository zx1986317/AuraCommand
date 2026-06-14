/**
 * P3 任务 2：chatSearch 工具函数测试
 */
import { describe, it, expect } from 'vitest';
import { findMatches, collectMessageMatches, escapeHtml, escapeRegExp } from '../../src/utils/chatSearch';

describe('chatSearch / findMatches', () => {
  it('空 query 返回空数组', () => {
    expect(findMatches('hello', '')).toEqual([]);
    expect(findMatches('hello', '  ')).toEqual([]);
  });

  it('空 text 返回空数组', () => {
    expect(findMatches('', 'hello')).toEqual([]);
  });

  it('无匹配返回空数组', () => {
    expect(findMatches('hello world', 'xyz')).toEqual([]);
  });

  it('单次匹配', () => {
    const r = findMatches('hello world', 'world');
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ start: 6, end: 11, text: 'world' });
  });

  it('多次匹配', () => {
    const r = findMatches('abcabc', 'abc');
    expect(r).toHaveLength(2);
    expect(r[0]!.start).toBe(0);
    expect(r[1]!.start).toBe(3);
  });

  it('大小写不敏感', () => {
    const r = findMatches('Hello HELLO hello', 'hello');
    expect(r).toHaveLength(3);
  });

  it('中文匹配', () => {
    const r = findMatches('知识库是本地知识库的核心', '知识库');
    expect(r).toHaveLength(2);
  });
});

describe('chatSearch / collectMessageMatches', () => {
  it('空消息返回空', () => {
    expect(collectMessageMatches([], 'test')).toEqual([]);
  });

  it('单条消息单次匹配', () => {
    const r = collectMessageMatches(
      [{ id: 'm1', content: 'hello world' }],
      'world'
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual({ messageId: 'm1', matchIndex: 0, globalIndex: 0 });
  });

  it('多条消息跨消息匹配', () => {
    const r = collectMessageMatches(
      [{ id: 'm1', content: 'foo bar' }, { id: 'm2', content: 'foo baz' }],
      'foo'
    );
    expect(r).toHaveLength(2);
    expect(r[0]!.globalIndex).toBe(0);
    expect(r[1]!.globalIndex).toBe(1);
    expect(r[1]!.messageId).toBe('m2');
  });
});

describe('chatSearch / escapeHtml', () => {
  it('转义特殊字符', () => {
    expect(escapeHtml('<b>"a&b"</b>')).toBe('&lt;b&gt;&quot;a&amp;b&quot;&lt;/b&gt;');
  });

  it('普通文本不变', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });
});

describe('chatSearch / escapeRegExp', () => {
  it('转义正则元字符', () => {
    expect(escapeRegExp('a.*b')).toBe('a\\.\\*b');
  });
});
