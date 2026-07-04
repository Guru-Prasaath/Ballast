import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hashes to something other than the plaintext', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash).not.toBe('correct horse battery');
    expect(hash.length).toBeGreaterThan(20);
  });

  it('verifies a correct password', async () => {
    const hash = await hashPassword('s3cret-pw');
    await expect(verifyPassword('s3cret-pw', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('s3cret-pw');
    await expect(verifyPassword('wrong', hash)).resolves.toBe(false);
  });
});
