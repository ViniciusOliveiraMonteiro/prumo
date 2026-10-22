import { expect, test } from 'vitest';
import { assertApplicationDatabaseUrl } from './identity.database.js';

const local = 'postgresql://prumo_app:example@127.0.0.1:54329/prumo_dev';

test('the local maintenance guard rejects effective host and role overrides', () => {
  expect(() => assertApplicationDatabaseUrl(local, true)).not.toThrow();
  for (const override of ['?host=remote.example', '?user=postgres']) {
    expect(() =>
      assertApplicationDatabaseUrl(local + override, true),
    ).toThrow();
  }
});

test('the API guard rejects a driver-level role override', () => {
  expect(() => assertApplicationDatabaseUrl(local)).not.toThrow();
  expect(() => assertApplicationDatabaseUrl(local + '?user=postgres')).toThrow(
    'The API must use the prumo_app database role',
  );
});

test('a malformed connection string does not appear in the error', () => {
  try {
    assertApplicationDatabaseUrl('postgresql://prumo_app:secret-value@[');
    throw new Error('Expected URL validation to fail');
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe('Invalid application database URL');
  }
});
