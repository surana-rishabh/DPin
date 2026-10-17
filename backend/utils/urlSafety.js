import net from 'node:net';

const blockedHostSuffixes = ['.localhost', '.local', '.internal', '.lan', '.home'];

export function isPrivateIp(address) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');

  if (net.isIPv4(value)) {
    const [a, b, c] = value.split('.').map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (net.isIPv6(value)) {
    if (value === '::' || value === '::1') return true;
    if (value.startsWith('fc') || value.startsWith('fd')) return true;
    if (/^fe[89ab]/.test(value)) return true;
    if (value.startsWith('ff') || value.startsWith('2001:db8:')) return true;
    if (value.startsWith('::ffff:')) return isPrivateIp(value.slice(7));
  }

  return false;
}

export function normalizeMonitorUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) {
    throw new Error('URL must be a string no longer than 2048 characters');
  }

  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('URL is invalid');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported');
  }
  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not supported');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    !hostname ||
    hostname === 'localhost' ||
    blockedHostSuffixes.some((suffix) => hostname.endsWith(suffix)) ||
    isPrivateIp(hostname)
  ) {
    throw new Error('Private and local network targets are not allowed');
  }

  if (url.port && !((url.protocol === 'http:' && url.port === '80') || (url.protocol === 'https:' && url.port === '443'))) {
    throw new Error('Only standard HTTP and HTTPS ports are supported');
  }

  url.hash = '';
  return url.toString();
}
