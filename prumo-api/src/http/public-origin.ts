export function publicOrigin(): string {
  const value =
    process.env.PRUMO_PUBLIC_ORIGIN ??
    (process.env.NODE_ENV === 'production'
      ? undefined
      : 'http://localhost:3000');
  if (!value || new URL(value).origin !== value) {
    throw new Error('PRUMO_PUBLIC_ORIGIN must be a URL origin without a path');
  }
  return value;
}
