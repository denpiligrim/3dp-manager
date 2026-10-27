import { BadRequestException } from '@nestjs/common';

/** Convert a JSON/base64 profile or a Happ deep link to a subscription line. */
export function buildHappRoutingLink(profile?: string): string {
  const value = profile?.trim() || '';
  if (value === 'happ://routing/off') return value;

  const match = /^happ:\/\/routing\/(add|onadd)\/([^\s]+)$/.exec(value);
  const payload = match ? match[2] : value;
  try {
    let json = payload;
    if (!payload.startsWith('{')) {
      if (!/^[A-Za-z0-9+/]+={0,2}$/.test(payload)) throw new Error();
      json = Buffer.from(payload, 'base64').toString('utf8');
    }
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error();
    }
    const encoded = Buffer.from(JSON.stringify(parsed), 'utf8').toString(
      'base64',
    );
    return `happ://routing/${match?.[1] || 'add'}/${encoded}`;
  } catch {
    throw new BadRequestException(
      'Invalid Happ routing profile: expected a JSON object, base64 or happ://routing link',
    );
  }
}
