/**
 * Verification suite specification for Firestore Security Rules ("Dirty Dozen").
 * Designed for @firebase/rules-unit-testing against firestore.rules.
 */

export const DIRTY_DOZEN_CASES = [
  { name: 'Unauthenticated create blocked', path: '/users/u1', expected: 'PERMISSION_DENIED' },
  { name: 'Unverified email blocked', path: '/users/u1', expected: 'PERMISSION_DENIED' },
  { name: 'Cross-tenant list blocked', path: '/users/u1/transactions', expected: 'PERMISSION_DENIED' },
  { name: 'Identity spoofing in userId blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Orphaned transaction without parent user doc blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Shadow field isAdmin blocked', path: '/users/u1', expected: 'PERMISSION_DENIED' },
  { name: 'Path variable ID poisoning blocked', path: '/users/u1/transactions/invalid$id', expected: 'PERMISSION_DENIED' },
  { name: 'Negative amount blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Invalid enum type blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Forged client timestamp blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Immutable createdAt/userId update blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Oversized description (>200 chars) blocked', path: '/users/u1/transactions/tx1', expected: 'PERMISSION_DENIED' },
  { name: 'Unauthenticated list on /shares blocked', path: '/shares', expected: 'PERMISSION_DENIED' },
  { name: 'Inactive share get blocked for viewer', path: '/shares/abcdefghijklmnop', expected: 'PERMISSION_DENIED' },
  { name: 'Short shareId (<16 chars) create blocked', path: '/shares/shortid', expected: 'PERMISSION_DENIED' }
] as const;
