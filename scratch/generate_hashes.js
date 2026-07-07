import crypto from 'crypto';

const passwords = {
  planner: 'planner123',
  leader: 'leader123',
  operator: 'operator123',
  board: 'board123'
};

const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt:${salt.toString('hex')}:${derived.toString('hex')}`;
};

console.log('--- Hash Results ---');
for (const [role, pw] of Object.entries(passwords)) {
  console.log(`${role}: ${hashPassword(pw)}`);
}
