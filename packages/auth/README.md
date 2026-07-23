# @repo/auth

Shared [Better Auth](https://better-auth.com) configuration for openJII — sessions with email OTP sign-in, organizations (a personal organization is provisioned for every user), API keys, passkeys, last-login-method tracking, and optional generic OAuth providers (ORCID), with the Expo plugin for mobile. Uses `@repo/database` for storage and `@repo/transactional` for auth emails.

Consumed by the backend (server) and by the web and mobile apps (clients).
