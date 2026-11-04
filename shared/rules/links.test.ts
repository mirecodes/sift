import { describe, expect, it } from 'vitest';
import { deepLinkUrl, parseDeepLink } from './links';

describe('deep links', () => {
  it('reads group invites, friend adds and war replays from URLs and paths', () => {
    expect(parseDeepLink('https://sift.example.com/join/ab12CD34')).toEqual({ kind: 'join', code: 'AB12CD34' });
    expect(parseDeepLink('/war/7f3a-91')).toEqual({ kind: 'war', id: '7f3a-91' });
    expect(parseDeepLink('https://sift.example.com/add/Mina-0042?ref=share')).toEqual({ kind: 'add', name: 'Mina', tag: '0042' });
  });

  it('decodes Hangul names and normalizes them to NFC', () => {
    const url = deepLinkUrl('https://sift.example.com/', { kind: 'add', name: '민지', tag: '4821' });
    expect(url).toBe('https://sift.example.com/add/%EB%AF%BC%EC%A7%80-4821');
    expect(parseDeepLink(url)).toEqual({ kind: 'add', name: '민지', tag: '4821' });
    const decomposed = encodeURIComponent('민지'.normalize('NFD'));
    expect(parseDeepLink(`/add/${decomposed}-4821`)).toEqual({ kind: 'add', name: '민지', tag: '4821' });
  });

  it('still reads the old hash route', () => {
    expect(parseDeepLink('https://sift.example.com/#/join/AB12CD34')).toEqual({ kind: 'join', code: 'AB12CD34' });
  });

  it('rejects anything else', () => {
    for (const bad of ['/', '/join/short', '/join/AB12CD34/x', '/add/Mina', '/add/Mina-42', '/add/-0042', '/shop/x', '/add/%E0%A4%A-0001', 'https://sift.example.com/'])
      expect(parseDeepLink(bad)).toBeNull();
  });

  it('round-trips every kind', () => {
    for (const link of [{ kind: 'join', code: 'ZZ99ZZ99' }, { kind: 'war', id: 'w_1' }, { kind: 'add', name: 'Kim민지', tag: '0001' }] as const)
      expect(parseDeepLink(deepLinkUrl('https://a.b', link))).toEqual(link);
  });
});
