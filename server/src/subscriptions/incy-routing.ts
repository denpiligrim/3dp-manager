import { BadRequestException } from '@nestjs/common';
import { buildHappRoutingLink } from './happ-routing';

/** INCY supports embedded profiles and URL sources downloaded by the client. */
export function buildIncyRoutingLink(profile?: string): string {
  const value = profile?.trim() || '';
  const match =
    /^(?:incy)?:\/\/(routing|autorouting)\/(add|onadd)\/([^\s]+)$/.exec(value);
  const payload = match?.[3] || value;

  try {
    if (match?.[1] === 'autorouting' || /^https?:\/\//.test(payload)) {
      if (/\s/.test(payload)) throw new Error();
      const url = new URL(payload);
      if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
        throw new Error();
      }
      return `incy://${match?.[1] || 'autorouting'}/${match?.[2] || 'add'}/${payload}`;
    }

    const happValue = value.replace(
      /^(?:incy)?:\/\/routing\//,
      'happ://routing/',
    );
    return buildHappRoutingLink(happValue).replace(/^happ:/, 'incy:');
  } catch {
    throw new BadRequestException(
      'Invalid INCY routing profile: expected a JSON object, base64, HTTP(S) URL or incy://routing link',
    );
  }
}
