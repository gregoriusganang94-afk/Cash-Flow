# Security Specification & Payload-First TDD

## 1. Data Invariants
1. A `UserSettings` document at `/users/{userId}` can only be read, created, or updated by the verified authenticated user whose `request.auth.uid == userId`.
2. A `CashFlowTransaction` document at `/users/{userId}/transactions/{transactionId}` cannot exist without a parent `/users/{userId}` document (`exists(...)` Master Gate) and must carry `userId == request.auth.uid`.
3. `createdAt` and `updatedAt` must equal `request.time` on creation; `createdAt` and `userId` are immutable on update, and `updatedAt` must equal `request.time` on update.
4. No unverified email users, no ghost/shadow fields, no arbitrary oversized strings, and no `list` queries without explicit `resource.data.userId == request.auth.uid`.
5. A `ShareSnapshot` at `/shares/{shareId}` requires a >= 16 char capability ID, contains zero PII (`email` forbidden), allows public `get` ONLY when `active == true`, forbids unauthenticated/cross-tenant `list`, and restricts writes/deletes strictly to the verified owner.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Unauthenticated Read/Write**: `auth: null` attempting `get` or `create` on `/users/u1/transactions/tx1`. -> `PERMISSION_DENIED`
2. **Unverified Email Write**: `auth: { uid: 'u1', token: { email_verified: false } }` attempting `create` on `/users/u1`. -> `PERMISSION_DENIED`
3. **Cross-Tenant Read/List**: `auth: { uid: 'u2' }` attempting `list` or `get` on `/users/u1/transactions`. -> `PERMISSION_DENIED`
4. **Identity Spoofing on Create**: `auth: { uid: 'u1' }` creating `/users/u1/transactions/tx1` with `userId: 'u2'`. -> `PERMISSION_DENIED`
5. **Orphaned Transaction Create**: `auth: { uid: 'u1' }` creating `/users/u1/transactions/tx1` before `/users/u1` exists. -> `PERMISSION_DENIED`
6. **Shadow / Ghost Field Injection**: Creating `/users/u1` or `/shares/{shareId}` with extra field `isAdmin: true`. -> `PERMISSION_DENIED`
7. **ID Poisoning**: Creating `/users/u1/transactions/<200-char-invalid-id$%>` or `/shares/shortid` (< 16 chars). -> `PERMISSION_DENIED`
8. **Negative or Zero Amount**: Creating a transaction with `amount: -50000` or `amount: 0`. -> `PERMISSION_DENIED`
9. **Invalid Transaction Type**: Creating a transaction with `type: 'transfer'` instead of `'income' | 'expense'`. -> `PERMISSION_DENIED`
10. **Client Timestamp Forgery**: Creating a transaction or share snapshot with `createdAt` set to a past client timestamp instead of `serverTimestamp()`. -> `PERMISSION_DENIED`
11. **Immutable Field Tampering**: Updating a transaction or share snapshot's `userId` or `createdAt`. -> `PERMISSION_DENIED`
12. **Public Enumeration / Inactive Share Read**: `auth: null` attempting `list` on `/shares` or `get` on `/shares/{id}` where `active == false`. -> `PERMISSION_DENIED`
