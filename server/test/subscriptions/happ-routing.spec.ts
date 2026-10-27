import { BadRequestException } from '@nestjs/common';
import { buildHappRoutingLink } from 'src/subscriptions/happ-routing';

describe('Happ routing profiles', () => {
  const json = JSON.stringify({
    Name: 'Маршрутизация',
    DirectSites: ['geosite:cn'],
  });
  const encoded = Buffer.from(json, 'utf8').toString('base64');

  it.each([json, encoded, `happ://routing/add/${encoded}`])(
    'converts %s to an add link',
    (input) => {
      expect(buildHappRoutingLink(input)).toBe(`happ://routing/add/${encoded}`);
    },
  );

  it('preserves activation and disable commands', () => {
    const link = `happ://routing/onadd/${encoded}`;
    expect(buildHappRoutingLink(link)).toBe(link);
    expect(buildHappRoutingLink(' happ://routing/off ')).toBe(
      'happ://routing/off',
    );
  });

  it.each([
    '',
    'bad profile',
    '[]',
    'null',
    'e30=\nvless://injected',
    'happ://routing/unknown/e30=',
  ])('rejects invalid profile %s', (input) => {
    expect(() => buildHappRoutingLink(input)).toThrow(BadRequestException);
  });
});
