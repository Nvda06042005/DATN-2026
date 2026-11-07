import { hashPassword, verifyPassword } from '../src/auth/passwords';
import { PASSWORD_POLICY } from '../src/auth/password-policy';

test.each(['Aa1!aaaaaaa', 'abcdefghijk1!', 'ABCDEFGHIJK1!', 'Abcdefghijkl!', 'Abcdefghijk12', 'Abcdefghijk1 ', 'Abcdefghij1!\u0000'])('new password policy rejects missing requirements: %s', password => {
  expect(PASSWORD_POLICY.test(password)).toBe(false);
});

test.each(['Abcdefghij1!', 'Mật khẩu @123', 'LịchSửĐôngA2026!', 'Long phrase with space 1!'])('new password policy supports Unicode and punctuation: %s', password => {
  expect(PASSWORD_POLICY.test(password)).toBe(true);
});

test('bcrypt compares full Unicode passwords and rejects truncation beyond 72 bytes', async () => {
  const password = 'Mật khẩu @123'; const stored = await hashPassword(password,10);
  expect(stored).toMatch(/^\$2[aby]\$/); expect(await verifyPassword(password,stored)).toBe(true);
  expect(await verifyPassword(password+'x',stored)).toBe(false);
  await expect(hashPassword('á'.repeat(37))).rejects.toThrow('72 byte');
  expect(await verifyPassword('a'.repeat(73),stored)).toBe(false);
});
