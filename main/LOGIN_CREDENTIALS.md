# Login Credentials (Seed Data)

This file lists seeded users from `prisma/seed.ts`.

Use these after running:

```bash
npx prisma db push
npx prisma db seed
```

## Shared Passwords

- `ADMIN` users: `Admin123!`
- `STUDENT` and `SUPERVISOR` demo users: `Demo123!`

## Admin Logins

| Email | Password | Status | Can Log In |
|---|---|---|---|
| `admin@supervisor-match.local` | `Admin123!` | `ACTIVE` | Yes |
| `admin.ops@supervisor-match.local` | `Admin123!` | `ACTIVE` | Yes |

## Supervisor Logins

| Email | Password | Status | Can Log In |
|---|---|---|---|
| `sarah.wilson@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `david.chen@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `fatima.noor@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `managed.supervisor@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `invited.supervisor@supervisor-demo.local` | `Demo123!` | `PENDING` | No |
| `elena.rossi@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `omar.haddad@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `priya.nair@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `james.okafor@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `lina.meyer@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `marcus.bell@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `nadia.khan@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `victor.silva@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `hannah.choi@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `yusuf.ali@supervisor-demo.local` | `Demo123!` | `ACTIVE` | Yes |

## Student Logins

| Email | Password | Status | Can Log In |
|---|---|---|---|
| `ahmed.khan@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `maria.lee@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `john.carter@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `aisha.patel@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `tom.reyes@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `managed.student@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `suspended.student@student-demo.local` | `Demo123!` | `SUSPENDED` | No |
| `invited.student@student-demo.local` | `Demo123!` | `PENDING` | No |
| `sana.imran@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `liam.evans@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `noor.hassan@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `emily.turner@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `aarav.shah@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `maya.green@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `daniel.owen@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `zara.iqbal@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `ethan.clark@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |
| `amina.yusuf@student-demo.local` | `Demo123!` | `ACTIVE` | Yes |

## Notes

- `PENDING` users are blocked from login by design.
- `SUSPENDED` users are blocked from login by design.
- Some active users may be redirected to onboarding before dashboard access.

## Extra Profiles Added (Quick Copy)

All below use password: `Demo123!`

### Extra Supervisors (10)

- `elena.rossi@supervisor-demo.local`
- `omar.haddad@supervisor-demo.local`
- `priya.nair@supervisor-demo.local`
- `james.okafor@supervisor-demo.local`
- `lina.meyer@supervisor-demo.local`
- `marcus.bell@supervisor-demo.local`
- `nadia.khan@supervisor-demo.local`
- `victor.silva@supervisor-demo.local`
- `hannah.choi@supervisor-demo.local`
- `yusuf.ali@supervisor-demo.local`

### Extra Students (10)

- `sana.imran@student-demo.local`
- `liam.evans@student-demo.local`
- `noor.hassan@student-demo.local`
- `emily.turner@student-demo.local`
- `aarav.shah@student-demo.local`
- `maya.green@student-demo.local`
- `daniel.owen@student-demo.local`
- `zara.iqbal@student-demo.local`
- `ethan.clark@student-demo.local`
- `amina.yusuf@student-demo.local`
