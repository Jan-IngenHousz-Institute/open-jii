# Fix: Unify Logout Flow to Use Consistent /platform/signout Route

## Commit Message

```
fix: unify logout flow to use consistent /platform/signout route

When logging out from the unified navigation (home page), the logout
action was directly calling handleLogout(), which caused deployment
routing issues since the logout needs to come from a consistent route
(/platform/signout) to work with CloudFront cache behavior configuration.

This caused an "Application error: a client-side exception has occurred"
when users logged out from the home page.

Changes:
- Update unified navbar to navigate to /platform/signout instead of
  directly calling handleLogout()
- Add hideBackground query parameter to show backdrop overlay when
  logging out from outside the platform
- Remove direct handleLogout() calls from UserMenu component
- Update tests to verify correct navigation behavior

The sidebar logout flow already used /platform/signout and continues
to work as expected (without the backdrop overlay).

Fixes #660
```

---

## PR Description

### Description

Fixes the logout error when logging out from the unified navigation (home page) by ensuring all logout flows use the consistent `/platform/signout` route.

**Fixes #660**

### Problem

When a user was logged in and attempted to log out from the home page (via the unified navigation), they encountered an error:
```
Application error: a client-side exception has occurred while loading dev.openjii.org
```

This occurred because:
1. The unified navigation directly called `handleLogout()` via a form action
2. The sidebar navigation used a Link to `/platform/signout` 
3. Our deployment (CloudFront) requires logout to come from a consistent route path (`/*/platform/signout`) for proper cache behavior configuration

### Solution

**Unified the logout flow** to always navigate to `/platform/signout?hideBackground=true`:

#### Changes Made

1. **Unified Navbar Component** (`unified-navbar.tsx`)
   - Changed from form action with `handleLogout()` to Link component
   - Both desktop and mobile menus now navigate to `/platform/signout?hideBackground=true`
   - Removed unused `handleLogout` import and `handleSignOut` handler

2. **Signout Page** (`platform/signout/page.tsx`)
   - Added `searchParams` to accept optional `hideBackground` parameter
   - When `hideBackground=true`, displays a full-page backdrop (`bg-black`) to hide platform content
   - When accessed from sidebar (without parameter), no backdrop is shown

3. **Test Updates** (`unified-navbar.test.tsx`)
   - Updated tests to verify Link navigation instead of form submission
   - Removed `handleLogout` mock
   - Updated assertions to check for correct href with query parameter

### Behavior

#### From Unified Navigation (Home/About/Blog pages)
- Clicking logout navigates to `/platform/signout?hideBackground=true`
- Shows dark backdrop overlay to hide any platform content
- User sees only the logout confirmation dialog

#### From Sidebar (Inside /platform)
- Clicking logout navigates to `/platform/signout` (no query param)
- No backdrop overlay shown (user is already in platform context)
- User sees logout confirmation dialog with platform visible behind

### Testing

#### Manual Testing
1. ✅ Log in and navigate to home page
2. ✅ Click logout from unified nav → no error, shows dialog with backdrop
3. ✅ Navigate to `/platform` 
4. ✅ Click logout from sidebar → shows dialog without backdrop
5. ✅ Verify both flows successfully log out

#### Automated Testing
- ✅ All unified navbar tests pass
- ✅ Tests verify correct href with `hideBackground=true` parameter

### Deployment Impact

This fix ensures the logout route matches the CloudFront cache behavior configuration at `/*/platform/signout`, resolving the deployment routing issue.

---

## Files Changed

- `apps/web/components/unified-navbar/unified-navbar.tsx`
- `apps/web/components/unified-navbar/unified-navbar.test.tsx`
- `apps/web/app/[locale]/platform/signout/page.tsx`
