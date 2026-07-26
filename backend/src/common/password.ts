import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

// A valid bcrypt hash of an arbitrary password. Used to run a real comparison for
// non-existent users so login response timing is the same whether or not the email
// exists — closing the user-enumeration side channel.
const DUMMY_HASH = '$2a$10$Fqjh0xp6UQquJ5Ee9PtkFOapLw2PmyF5rJYGso/kSEj9dbQ9.GWa6';

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// Perform a throwaway bcrypt comparison (always false) to match the cost of a real
// password check when the user doesn't exist.
export function compareWithDummy(plain: string): Promise<boolean> {
  return bcrypt.compare(plain, DUMMY_HASH);
}
