import { hashPassword, verifyPassword } from '../src/auth/passwords';
import { PASSWORD_POLICY } from '../src/auth/password-policy';

test.each(['abc1!', 'abcdef!', '123456!', 'Abcdefghijk12', ' ab1!cd', 'ab1!cd ', 'ab1 !cd', 'mật1!x', 'mat1!đ', 'a1!😀bc', 'a1!\u00a0bc', 'a1!\tbc', 'ab1!cd\n', 'Abcdefghij1!\u0000'])('new password policy rejects missing requirements, accents and whitespace: %s', password => {
  expect(PASSWORD_POLICY.test(password)).toBe(false);
});

test.each(['ab1!cd', 'AB1!CD', 'Abcdefghij1!', 'abc1_2', 'abc1@2', 'abc1#2'])('new password policy supports short passwords without mixed-case requirement: %s', password => {
  expect(PASSWORD_POLICY.test(password)).toBe(true);
});

test('existing Unicode passwords can still log in; Bcrypt rejects truncation beyond 72 bytes', async () => {
  const password = 'Mật khẩu @123'; const stored = await hashPassword(password,10);
  expect(stored).toMatch(/^\$2[aby]\$/); expect(await verifyPassword(password,stored)).toBe(true);
  expect(await verifyPassword(password+'x',stored)).toBe(false);
  await expect(hashPassword('á'.repeat(37))).rejects.toThrow('72 byte');
  expect(await verifyPassword('a'.repeat(73),stored)).toBe(false);
});
