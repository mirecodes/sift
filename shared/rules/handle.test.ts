import { describe, expect, it } from 'vitest';
import { formatHandle, formatTag, handleKey, nameProblem, parseHandle } from './handle';

describe('handle rule (Step 7.1)', () => {
  it('accepts Hangul, Latin, digits and mixed scripts', () => {
    for (const ok of ['민지', 'Mina', 'mina2', '민지Kim', 'Kim민지99', 'ab', '가나다라마바사아자차카타']) expect(nameProblem(ok)).toBeNull();
  });

  it('rejects jamo, emoji, spaces, symbols and digits only', () => {
    expect(nameProblem('ㄱㄴ')).toBe('chars');
    expect(nameProblem('민ㅏ')).toBe('chars');
    expect(nameProblem('Mina😀')).toBe('chars');
    expect(nameProblem('Mi na')).toBe('chars');
    expect(nameProblem('Mi-na')).toBe('chars');
    expect(nameProblem('1234')).toBe('digits_only');
  });

  it('counts Hangul syllables as one and checks the bounds', () => {
    expect(nameProblem('민')).toBe('length');
    expect(nameProblem('가나다라마바사아자차카타파')).toBe('length'); // 13
    expect(nameProblem('a'.repeat(12))).toBeNull();
    expect(nameProblem('a'.repeat(13))).toBe('length');
  });

  it('normalizes decomposed Hangul to the same key as composed', () => {
    const decomposed = '민지'.normalize('NFD');
    expect(decomposed).not.toBe('민지');
    expect(nameProblem(decomposed)).toBeNull();
    expect(handleKey(decomposed)).toBe(handleKey('민지'));
  });

  it('is case-insensitive for Latin keys and keeps the display case', () => {
    expect(handleKey('Mina')).toBe(handleKey('mina'));
    expect(handleKey('MinaKIM민지')).toBe('minakim민지');
    expect(formatHandle({ name: 'Mina', tag: '0042' })).toBe('Mina#0042');
  });

  it('reserves official words', () => {
    expect(nameProblem('Sift')).toBe('reserved');
    expect(nameProblem('운영자')).toBe('reserved');
    expect(nameProblem('ADMIN')).toBe('reserved');
  });

  it('parses typed handles and formats tags', () => {
    expect(parseHandle(' 민지#4821 ')).toEqual({ name: '민지', tag: '4821' });
    expect(parseHandle('Mina＃0001')).toEqual({ name: 'Mina', tag: '0001' });
    for (const bad of ['Mina', 'Mina#', '#1234', 'Mina#12', 'Mina#0000', 'Mi na#1234', 'Mina#12345']) expect(parseHandle(bad)).toBeNull();
    expect(formatTag(7)).toBe('0007');
  });
});
