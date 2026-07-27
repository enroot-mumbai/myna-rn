# Pending post-login route (deep link context)

Date: 2026-07-27  
Status: Approved design  
Scope: React Native app (`myna-rn`) only

## Problem

Logged-out users open website / App Link destinations (period-tracking, learn, profile, home, telehealth, etc.). The app shows the login screen. Without stashing the original destination, that context is lost after login.

Also: user may not have the app installed yet; context can be missed across process kills.

## Goal

Store intended destination when a logged-out user hits a stashable deep link, then redirect there after successful login.

## Approach

Pending-route stash in AsyncStorage (mirrors signup referrer + notification URL patterns). On `LOG_IN`, RN navigates via existing `navigateWebView`.

## Storage

| Key | Value |
|-----|--------|
| `pending_post_login_url` | Full web URL, e.g. `https://host/learn/physical-health` |
| `pending_post_login_timestamp` | Epoch ms |

- TTL: **7 days** (resume-this-visit intent; shorter than signup referrer 90d)
- Overwrite on newer stashable deep link
- Expired or missing → treat as no pending route

## Auth-only paths (do not stash)

- `/signup`, `signup`
- `/welcome`, `welcome`
- `/login`, `login`
- `/` and empty path

All other app paths are stashable (period-tracking, learn, profile, home, telehealth, dashboard, etc.).

## Flow — app installed, logged out

1. Deep link / App Link resolves via `handleDeepLink` / `resolveDeepLinkUrl`.
2. If `!isUserLoggedIn()` and path is stashable:
   - `storePendingPostLoginUrl(fullUrl)`
   - Open login surface: return base `WEB_URL` (web already shows login when unauthenticated; avoid flashing protected page).
3. User logs in → web posts `LOG_IN` with token.
4. RN reads pending URL if within TTL → `navigateWebView(url)` → `clearPendingPostLoginUrl`.
5. No pending / expired → no extra navigation (login’s normal landing).

## Flow — already logged in

Deep link navigates immediately. No stash.

## Flow — no app (Android install referrer)

Extend existing install-referrer handling beyond signup:

- Referrer may include `route` / `utm_content` pointing at a non-signup path (e.g. `/learn/...`).
- On first open, if logged out and route is stashable: build full URL → `storePendingPostLoginUrl` → show login (`WEB_URL`).
- After `LOG_IN` → same restore as above.
- Parse / referrer failure → fall back to login/home. No crash.

iOS deferred deep link: **out of scope** this pass.

## Cold-start priority

1. Pending notification URL (unchanged)
2. Initial deep link — if logged out + stashable → store pending + open `WEB_URL` (login)
3. Stored signup referrer (welcome/signup flow unchanged)
4. Install referrer — signup **or** pending-route stash
5. First-launch welcome / else `WEB_URL`

## Code surface

### `src/utils/DeepLinkHandler.ts`

- `storePendingPostLoginUrl(url: string): Promise<void>`
- `getPendingPostLoginUrl(): Promise<string | null>` — TTL check; clear if expired
- `clearPendingPostLoginUrl(): Promise<void>`
- `isAuthOnlyPath(path: string): boolean`
- Update `resolveDeepLinkUrl`: logged out + stashable → store full URL, return `WEB_URL`
- Update `checkInstallReferrer`: non-signup stashable `route` → pending URL when logged out

### `App.tsx`

- On successful `LOG_IN`: after `saveToken`, call `getPendingPostLoginUrl()`; if present → `navigateWebView(url)` then clear
- Do **not** clear pending post-login URL when clearing notification stash
- Signup referrer clear remains on web `CLEAR_REFERRER_DATA`, not auto on login

## Error handling

- AsyncStorage failure → log; do not block login
- Malformed / non-app-host pending URL → clear and ignore
- Never store external hosts

## Testing (minimal)

No new test framework. Small assert-style self-check or documented manual cases:

1. Logged out + deep link `/learn/...` → keys set → login → lands on learn → keys cleared
2. Auth-only path `/signup` → no pending keys
3. Expired timestamp (>7d) → `getPendingPostLoginUrl` returns null
4. Install referrer with `route=/learn/...` (Android) → pending set → after login navigate

## Out of scope

- iOS deferred deep links after install
- Web / backend repo changes
- Changing signup/welcome referrer 90-day attribution flow
- Changing notification URL TTL (1 hour)

## Success criteria

- Logged-out deep link to any stashable path survives login and lands on that path
- Process kill mid-login still restores within 7 days
- Android no-app → install referrer path recovers when `route` present
- Signup / welcome / notification flows keep current behavior
