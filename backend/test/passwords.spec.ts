import { hashPassword, verifyPassword } from '../src/auth/passwords';
test('bcrypt compares full Unicode passwords and rejects truncation beyond 72 bytes', async () => {
  const password = 'Mật khẩu @123'; const stored = await hashPassword(password,10);
  expect(stored).toMatch(/^\$2[aby]\$/); expect(await verifyPassword(password,stored)).toBe(true);
  expect(await verifyPassword(password+'x',stored)).toBe(false);
  await expect(hashPassword('á'.repeat(37))).rejects.toThrow('72 byte');
  expect(await verifyPassword('a'.repeat(73),stored)).toBe(false);
});
