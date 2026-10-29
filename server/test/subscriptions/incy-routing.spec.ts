import { BadRequestException } from '@nestjs/common';
import { buildIncyRoutingLink } from 'src/subscriptions/incy-routing';

describe('INCY routing', () => {
  const json = JSON.stringify({ Name: 'Правила', DirectSites: ['geosite:ru'] });
  const base64 = Buffer.from(json, 'utf8').toString('base64');

  it.each([
    json,
    base64,
    `incy://routing/add/${base64}`,
    `://routing/add/${base64}`,
  ])('encodes an embedded profile: %s', (input) => {
    expect(buildIncyRoutingLink(input)).toBe(`incy://routing/add/${base64}`);
  });

  it('preserves activation and disabling', () => {
    expect(buildIncyRoutingLink(`incy://routing/onadd/${base64}`)).toBe(
      `incy://routing/onadd/${base64}`,
    );
    expect(buildIncyRoutingLink('incy://routing/off')).toBe(
      'incy://routing/off',
    );
    expect(buildIncyRoutingLink('://routing/off')).toBe('incy://routing/off');
  });

  it('turns a profile URL into autorouting without fetching it', () => {
    expect(buildIncyRoutingLink('https://example.com/profile.json')).toBe(
      'incy://autorouting/add/https://example.com/profile.json',
    );
  });

  it.each(['routing', 'autorouting'])(
    'preserves one-time import versus auto-update for %s',
    (mode) => {
      const link = `incy://${mode}/onadd/https://example.com/profile.json?version=2`;
      expect(buildIncyRoutingLink(link)).toBe(link);
    },
  );

  it.each([
    '',
    '[]',
    'null',
    'bad profile',
    'incy://routing/unknown/e30=',
    'incy://autorouting/add/e30=',
    'incy://autorouting/onadd/file:///tmp/profile.json',
    'https://example.com/profile.json\nvless://injected',
    'incy://routing/add/e30=\nvless://injected',
  ])('rejects invalid input: %s', (input) => {
    expect(() => buildIncyRoutingLink(input)).toThrow(BadRequestException);
  });
});
