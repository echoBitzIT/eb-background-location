# Geo Employee Tracker — Complete QA & Bug Audit Report

**Application:** `eb_geoemployee_tracker_mobile`  
**Date:** 14 August 2026  
**Audit type:** End-to-end static code review (architecture, APIs, navigation, security, Android/iOS). Not a device lab test.  
**Stack:** React Native CLI **0.86.0**, React **19.2.3**, Redux Toolkit, Axios (default timeout 15s), Odoo REST. Not Expo.  
**Scope:** Entire mobile app. No application code was modified during this audit.  
**Secrets:** Firebase / Google Maps keys, tokens, and passwords are **not** reproduced in this report.

---

## 1. Cover / architecture snapshot

Auth is Redux Toolkit plus Axios against a user-entered Odoo HTTPS base URL. Tokens live in AsyncStorage. There is no auth-gated navigator: every screen is on one native stack.

**Main flow:** Fetch URL → Login → Home tools (Geo / Attendance / Time Off) → field check-in, default-route GPS session, task routing + Google Maps WebView, geo history, HR leave.

Session sync is TTL-deduped (15 seconds). Token refresh is single-flight on HTTP 401. Several screens cancel GETs with `AbortController`; several high-traffic screens do not.

---

## 2. Executive summary

| Area | Count (approx.) |
| --- | ---: |
| **Total issues** | **62** |
| Critical | 6 |
| High | 18 |
| Medium | 24 |
| Low | 14 |
| API | 22 |
| UI/UX | 12 |
| Performance | 8 |
| Security | 8 |
| Navigation | 5 |
| Android | 7 |
| iOS | 5 |

**How to read findings**

- **Confirmed** = the code path exists today.
- **Potential** = it can happen under timing, bad API data, or device conditions.

---

## 3. Issue table

### 3.1 Critical

| ID | Category | File | Issue | Why it happens | User impact | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | Auth / Nav | `App.tsx`, `AppNavigator.tsx` | 401 refresh failure logs the user out in Redux/storage but does **not** reset navigation. | `onAuthFailure` calls `logout()` / `clearSession()`; the stack is not auth-aware. Settings logout *does* `reset`. | User stays on Home/tasks with a dead session. | `navigationRef.reset` to Fetch URL/Login. Gate stack on `accessToken`. |
| C2 | Location | `locationTrackingService.ts`, AndroidManifest, Info.plist | Tracking is a JS `setInterval` with no Android foreground service, no `ACCESS_BACKGROUND_LOCATION`, iOS background mode is only `remote-notification`. | Interval pauses when JS is suspended. | Field path **stops in background**. Core product gap. | Native background location + foreground service + Always permission; queue uploads. |
| C3 | Security | `sessionStorage.ts`, AndroidManifest | Access + refresh tokens in **AsyncStorage**; `android:allowBackup="true"`. | Backup/root can copy `@geo_employee_tracker/session`. | Account takeover. | Encrypted storage (Keychain/Keystore); `allowBackup="false"`. |
| C4 | Privacy | `locationTrackingService.ts` | **Production** `console.log` of lat/lng and `point_uuid`. | Logs not wrapped in `__DEV__`. | PII in logcat / crash tools. | Log only in `__DEV__`; never log coordinates. |
| C5 | Android | `AndroidManifest.xml` | `android:icon="@mipmap /ic_launcher"` has a **space**. | Invalid resource name. | Icon/build failure or launcher crash. | Use `@mipmap/ic_launcher`. |
| C6 | Maps / Security | `TaskMapScreen.tsx`, `taskMapHtml.ts`, `GeoHistoryMapScreen.tsx` | Company **Google Maps JS key** injected into WebView HTML. | `fetchFieldMapConfig` returns the key; HTML loads Maps JS with it. | Key extraction, billing abuse if unrestricted. | Restrict key; prefer native map SDK; keep Directions on server. |

### 3.2 High

| ID | Category | File | Issue | Why it happens | User impact | Recommended fix |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | API / UX | `TimeOffCalendarScreen.tsx` | List uses default **`limit: 20`**, no pagination. | `fetchHrLeaves` defaults to 20; screen never loads more. | Older requests missing. | Paginate or load all pages. |
| H2 | Race | `TimeOffRequestScreen.tsx` | `setSubmitting(true)` runs **after** validation. | Two fast taps both see `submitting === false`. | Duplicate leave records. | Lock with a ref immediately on first tap. |
| H3 | API duplicate | `TaskMapScreen.tsx` | Every focus refetches task detail, map-config, and directions. | `useFocusEffect` → `bootstrap`; HTML cleared. | Latency, quota, flicker. | Bootstrap once per `taskId`; cache config. |
| H4 | Performance | `TaskMapScreen.tsx` | `watchPosition` with `distanceFilter: 0`, 1s / 500ms. | Watch starts on every focus. | Battery drain, heat. | Filter 5–15m; interval 3–5s. |
| H5 | API | `TaskRoutingScreen.tsx` | **No AbortSignal**. Refresh uses `loadTasks(() => false)`. | Chip/date/page/focus all call GET; old request continues. | Duplicate GETs; setState after unmount. | AbortController; cancel on unmount. |
| H6 | API duplicate | Time Off Calendar + Request | Calendar loads leave + types on every focus; Request loads types again + up to **200** leaves. | No shared cache. | Slow Time Off flow. | In-memory TTL cache. |
| H7 | API duplicate | `HomeScreen.tsx` + `TaskMapScreen.tsx` | Home fetches task detail to navigate; Map fetches again. | Two GET `/field/tasks/{id}` in one flow. | Delay opening the map. | Pass detail in params or short cache. |
| H8 | Prod / Privacy | `apiClient.ts` | `[TimeOff]` logs run in **production**. | No `__DEV__` guard. | PII in device logs. | Guard or delete. |
| H9 | Error UX | `apiClient.ts` | Unknown 500/403/422 fall through to Axios/`data.error`. | Only some codes mapped. | Users see `Request failed with status code 500`. | Map all 4xx/5xx to safe copy. |
| H10 | Tracking | `locationTrackingService.ts` | Failed uploads dropped; `is_offline_sync` unused. | Catch logs and returns; no queue. | Gaps in the trail offline. | Persist a point queue. |
| H11 | Auth UX | Screens generally | After C1, screens show “Session expired” **in place**. | No global redirect. | Stuck authenticated UI. | Same as C1. |
| H12 | Time | `CheckInScreen.tsx` | Naive datetimes get a **`Z` suffix**. | Treated as UTC. | Wrong worked hours vs local TZ. | Parse as API actually sends time. |
| H13 | Data | auth employee | Time Off fails if `employee.id` missing. | `MobileEmployee.id?: number`. | Cannot load/submit leave. | Require `id` at login. |
| H14 | Security | `android/app/google-services.json` | Firebase client key is **committed**. | Standard RN Firebase file in git. | Abuse if API restrictions are loose. | Restrict by app id/SHA-1; rotate if leaked. |
| H15 | Timeout | `apiClient.ts` | Default **15s**; uploads 60s; stop images **120s**; no retry except 401. | Axios default. | Slow Odoo hits timeout. | 15s GET, 30s mutations, 60s media; one network retry. |
| H16 | Leak | `TaskMapScreen.tsx` | Detail/config/directions **omit `signal`**. | Cancel flag ignores in-flight HTTP. | Calls continue after leaving the map. | Pass AbortSignal; abort on blur. |
| H17 | Interval | `locationTrackingService.ts` | Backend can set **1s** GPS upload. | `uploadInFlight` skips overlaps. | Battery + missed points. | Client floor 10–15s. |
| H18 | UX dead | `HomeScreen.tsx` | Get Help `onPress={() => {}}`. | Stub. | Looks broken. | Wire help URL or hide. |

### 3.3 Medium

| ID | Issue | Plain explanation |
| --- | --- | --- |
| M1 | Home focus session sync | After 15s TTL, every Home focus attempts `GET /field/session`. |
| M2 | Resume prompt once | Tapping **Later** never asks again until Home remounts. |
| M3 | Check-in double session GET | Focus + submit both call sync; TTL usually collapses them. |
| M4 | Task Routing GPS 4s race | Losing `Promise.race` does not cancel `getCurrentCoordinates`; dialog can pop late. |
| M5 | History day max 50 sessions | `limit: 50`, `offset: 0` only. Extra sessions that day hidden. |
| M6 | Occupied dates from first 200 leaves | User might book a day that already has leave. |
| M7 | Login email | Only checks empty, not format; rare double-tap before `loginLoading`. |
| M8 | Fetch URL search | Same one-frame double search. |
| M9 | Profile photo as huge base64 | Memory + large PATCH. |
| M10 | Check-in clock every 1s | Whole screen re-renders. |
| M11 | Notification channel deleted then recreated | User mute/importance reset. |
| M12 | Foreground push only for no-movement | Other FCM types silent in foreground. |
| M13 | iOS When In Use only | Same background gap as C2 on iOS. |
| M14 | No Android foreground location service | Background tracking cannot ship without this. |
| M15 | Invalid Maps key still loads HTML | Blank map possible. |
| M16 | Task Map lat/lng not validated | NaN map / HTML crash if params bad. |
| M17 | Logout revoke 15s × 2 | Best-effort revoke can hang logout. |
| M18 | Splash blocks forever | GPS/camera/network alerts are non-cancelable. |
| M19 | Access gate on all post-splash screens | Cannot view Time Off without camera. |
| M20 | View Details note effect | Params + local note can fight / extra renders. |
| M21 | Task Capture refetch on every focus | Extra GET after camera. |
| M22 | Checklist refetch on every focus | Extra GET after map. |
| M23 | Silent session GET failure | Stale checked-in if server down; no toast. |
| M24 | Time Off kebab stub | More-options does nothing. |

### 3.4 Low

| ID | Issue | Recommended fix |
| --- | --- | --- |
| L1 | Unused packages: MapLibre, `react-native-maps`, Nitro Image, `@react-native/new-app-screen` | Remove unused packages. |
| L2 | Two vector-icon libraries | Keep one. |
| L3 | ProGuard/R8 off in release | Enable with keep rules. |
| L4 | Theme follows OS only | Optional in-app setting. |
| L5 | Terms URL `Linking.openURL` without try/catch | Catch + toast. |
| L6 | Tablet `contentMaxWidth: 480` | Widen if tablets supported. |
| L7 | Portrait lock both platforms | Intentional; none. |
| L8 | Unguarded TaskMap/TaskRouting logs | Guard with `__DEV__`. |
| L9 | `apiClient.ts` ~2400 lines | Split by domain (optional). |
| L10 | Fetch URL rejects ports / localhost | Allow port in debug builds. |
| L11 | No app deep-link intent filters | Add if notifications should open a task. |
| L12 | iOS ATS `NSAllowsArbitraryLoads` false | Keep HTTPS-only (good). |
| L13 | `usesCleartextTraffic` placeholder | False in release. |
| L14 | Almost no tests | Add API/auth tests. |

---

## 4. API call summary

**Timeouts:** Axios **15s** default. Longer: check-in/out, start/end session, add-stop, location upload, leave attach, selfie (**60s**); stop images (**120s**).  
**Retry:** HTTP **401 refresh only** (single-flight).  
**Cancellation:** mixed.

| API | Method | Called from | Timeout | Retry | Duplicate risk | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| `/api/v1/company/search` | GET | Fetch URL | 15s | No | Low (double-tap 1 frame) | Submitting ref |
| `/api/v1/auth/login` | POST | Login | 15s | No | Low | Disable immediately |
| `/api/v1/authentication/token` | POST | Splash + Axios 401 interceptor | 15s | No | Low if splash+API overlap | Share single-flight with splash |
| `/api/v1/authentication/revoke` | POST | Logout (access + refresh) | 15s | No | None | Short timeout (3–5s) |
| `/api/v1/me` | GET | Home/Profile if no employee | 15s | 401 | Low | OK |
| `/api/v1/me` | PATCH | Profile save | 15s | 401 | Low | Already `busy` |
| `/api/v1/field/session` | GET | Splash, Home focus, CheckIn, DefaultRoute, login sync | 15s | 401 | Medium after TTL | Keep TTL; toast on failure |
| `/api/v1/field/check-in` `/check-out` | POST | CheckIn | 60s | 401 | Low | OK (`submittingRef`) |
| `/api/v1/field/start-session` `/end-session` | POST | Default Route | 60s | 401 | Low | OK |
| `/api/v1/field/location` | POST | Interval tracker | 60s | 401 | High frequency | Min 10–15s; queue |
| `/api/v1/field/device-token` | POST/DELETE | Login/splash/logout | 15s | No | Low | OK additive |
| `/api/v1/field/tasks` | GET | Task Routing focus/chip/date/page/refresh | 15s | 401 | **High** (no abort) | Abort + debounce chip |
| `/api/v1/field/tasks/{id}` | GET | Home resume, TaskMap, Capture, Checklist, History | 15s | 401 | **High** | Cache; don’t refetch every focus |
| `/api/v1/field/map-config` | GET | TaskMap + GeoHistoryMap | 15s | 401 | **High** on TaskMap focus | Cache for session |
| `/api/v1/field/directions` | POST | TaskMap route + watch reroute | 15s | 401 | **High** | Abort; keep throttle |
| `/api/v1/field/attendance/calendar` | GET | Attendance month; TimeOff date modal | 15s | 401 | Low | OK |
| `/api/v1/field/history` | GET | Geo History month | 15s | 401 | Low | OK |
| `/api/v1/field/history/years` | GET | Geo History mount | 15s | 401 | Low | OK |
| `/api/v1/field/history/sessions` | GET | Day screen | 15s | 401 | Low | Paginate if total > 50 |
| `/api/v1/field/sessions/{id}` | GET | Session screen | 15s | 401 | Low | OK |
| `/api/v1/field/sessions/{id}/route` | GET | History map | 15s | 401 | Low | Parallel OK |
| `/api/v1/records/hr.leave` | GET | Calendar focus; Request occupancy | 30s | 401 | **High** | Cache; paginate |
| `/api/v1/records/hr.leave.type` | GET | Calendar + Request | 30s | 401 | **High** | Cache |
| `/api/v1/records/hr.leave` | POST | Request submit | 15s | 401 | **High** | Immediate lock |
| `hr.leave/{id}/attachments` | POST | After create | 60s | 401 | Low | Retry attach without second leave |
| Task start/arrive/complete/cancel/pause | POST | Map/Capture | 15s | 401 | Medium | Keep refs |
| Stop note/selfie/images | PATCH/POST | Capture | 60–120s | 401 | Medium | Cancel on leave |

**Over-called (do not remove the API; reduce frequency):** `GET /field/session` on every Home focus after TTL; `GET /field/tasks/{id}` + map-config + directions on every TaskMap focus; `hr.leave` + `hr.leave.type` on every Time Off Calendar focus and again on Request; Task Routing GET on every focus when returning from a task.

**Required:** login, session sync after check-in, location upload while tracking, task mutations, leave create.

---

## 5. Screen-by-screen summary

| Screen | API issues | UI issues | Navigation | Performance | State | Severity |
| --- | --- | --- | --- | --- | --- | --- |
| Splash | Session refresh + `field/session` + push | Blocks on GPS/camera/network | `replace` Home/Fetch URL | Sequential waits | Cancel on unmount OK | Medium |
| Fetch URL | Search double-tap potential | KeyboardAvoiding OK | From splash via replace | — | URL persisted | Low |
| Login | Weak email validation | Terms + password toggle OK | `reset` Home | — | Redux loading | Medium |
| Home | Session sync on focus; resume task-detail; Get Help stub | Check In/Out label OK | Resume → Map/Capture | — | `resumePromptedRef` | High |
| Settings | Logout revoke | Logout color hardcoded | `reset` Fetch URL (good) | Revoke wait | — | Low |
| Profile | Conditional GET me; large avatar PATCH | Edit/read modes | Back OK | Base64 memory | Form vs employee | Medium |
| Check-In | Session GET + check-in/out | 1s clock rerender | Selfie round-trip | Timer | TZ `Z` bug | High |
| Selfie camera | None | VisionCamera focus | `returnTo` checkIn/visitStop | Camera lifecycle | `beforeRemove` while capturing | Low |
| Geo Management | None | Rows OK | To Default/Task Routing | — | — | Low |
| Default Route | Session GET; start/end | Hydrate spinner | Check-in CTA | — | submittingRef OK | Medium |
| Task Routing | Tasks GET no abort; GPS race | Pagination UI | To map/checklist | GPS 4s | Chip/page refetch | High |
| What Needs To Be Done | Detail every focus | Checklist | Back | — | Local progress merge | Medium |
| Task Map | Detail+config+directions every focus; 1Hz GPS | WebView map; banners | Back; start/arrive | **Battery** | Many refs | Critical/High |
| Task Capture | Detail every focus; selfie/complete | Requirements gating | Pop to routing | Image upload | Dual focus work | Medium |
| View Details | add-stop | Notes/photo | Default-route stop | — | Param sync | Medium |
| Geo History | years + month history | Month pills | To day | — | Abort OK | Low |
| Geo History Day | Sessions cap 50 | Cards | To session | — | — | Medium |
| Geo History Session | Session GET | — | To map/task | — | Abort OK | Low |
| Geo History Map | map-config + route | WebView | Back | HTML map | Abort OK | Medium |
| Geo History Task Detail | Task + stop images | Image viewer | Back | Base64 images | Abort OK | Medium |
| Attendance Calendar | Month GET | Calendar/list | — | Abort OK | Month reload | Low |
| Time Off Calendar | Leaves 20 + types every focus; kebab stub | FAB; chips | To Request | — | Abort OK | High |
| Time Off Request | Types + 200 leaves + holiday calendar; double submit | Date modal; attachments | goBack | Logs PII | Occupancy incomplete | High |

---

## 6. Bug explanations (plain language)

### 6.1 Critical (fix first)

#### C1 — Session dies, but the app still looks logged in

**Where:** `App.tsx` (`onAuthFailure`) + `AppNavigator.tsx`

If the access token expires and refresh fails, Redux and storage are cleared, but the stack is **not** sent back to Fetch URL / Login. Settings logout *does* reset navigation. Silent 401 logout does not.

**User sees:** Home, maps, time off still on screen. Buttons fail or show “session expired” with no way out except force-close.

**Fix:** On auth failure, `navigationRef.reset` to Fetch URL (or Login). Optionally hide the logged-in stack when `accessToken` is null.

#### C2 — GPS tracking stops when the app is in the background

**Where:** `locationTrackingService.ts` (`setInterval`), AndroidManifest, iOS `Info.plist`

Uploads run on a JS timer. There is no Android foreground service, no `ACCESS_BACKGROUND_LOCATION`, and iOS only has `remote-notification` (not location) background mode.

**User sees:** Trail gaps when they lock the phone or switch apps. No-movement alerts and history become wrong. This is the core of a field tracker.

**Fix:** Native background location + notification; queue points when offline; do not rely on JS `setInterval` alone. This is a **large** native change (later epic).

#### C3 — Tokens stored insecurely + Android backup

**Where:** `sessionStorage.ts` (AsyncStorage), `AndroidManifest.xml` `allowBackup="true"`

Access + refresh tokens sit in plaintext AsyncStorage and can be included in device backup.

**Impact:** Stolen session / account takeover on a lost or backed-up phone.

**Fix:** Keychain (iOS) / Keystore (Android). Set `allowBackup="false"`.

#### C4 — Live GPS logged in production

**Where:** `locationTrackingService.ts` → `uploadCurrentPoint`

`console.log` prints latitude, longitude, `point_uuid` **without** `__DEV__`.

**Impact:** Coordinates in Logcat / crash tools (privacy).

**Fix:** Remove or wrap in `__DEV__`. Never log coordinates.

#### C5 — Android launcher icon path is broken

**Where:** `android/app/src/main/AndroidManifest.xml`

`android:icon="@mipmap /ic_launcher"` has a **space** after `mipmap`.

**Impact:** Bad icon, failed resource compile, or launcher crash.

**Fix:** `@mipmap/ic_launcher` (no space).

#### C6 — Google Maps JS API key inside the WebView

**Where:** `TaskMapScreen.tsx`, `taskMapHtml.ts`, `GeoHistoryMapScreen.tsx`

Backend `map-config` returns the company Google key; the app injects it into HTML. Anyone can extract it from the WebView.

**Impact:** Billing abuse if the key is not tightly restricted.

**Fix:** Restrict the key (package name / SHA-1 / HTTP referrer). Prefer a native map SDK. Keep Directions on the server (already proxied). Do not paste the key into chats or this report.

### 6.2 High

#### H1 — Time Off list only loads 20 requests

`TimeOffCalendarScreen` → `fetchHrLeaves` default `limit: 20`. No pagination. Older leaves missing; filters look empty.

#### H2 — Double-tap can create two time-off requests

`handleSubmit` checks `if (submitting) return` first, but `setSubmitting(true)` is **after** validation. Two fast taps both pass. Duplicate leave records.

#### H3 — Task Map reloads APIs every time you come back

Every focus: task detail + map-config + directions; WebView HTML is cleared. Flicker, delay, extra Google/Odoo quota.

#### H4 — Task Map GPS watch is too aggressive

`distanceFilter: 0`, interval 1000ms, fastestInterval 500ms. Battery drain and extra reroute calls.

#### H5 — Task list requests are not cancelled

Chip/date/page/focus fire `GET /field/tasks` with **no AbortSignal**. Pull-to-refresh uses `loadTasks(() => false)`, so leaving the screen does not cancel. Duplicate GETs; possible state update after unmount.

#### H6 — Time Off Calendar and Request hit the same APIs twice

Calendar: `hr.leave` + `hr.leave.type` on **every focus**. Request: types again + up to 200 leaves. Slow Time Off flow.

#### H7 — Opening a task from Home hits task-detail twice

Home already `GET /field/tasks/{id}` to navigate; Map fetches it again.

#### H8 — Time Off debug logs run in production

`apiClient.ts` logs employeeId, dates, names with no `__DEV__`.

#### H9 — Ugly / raw API errors shown to users

Unmapped 500/403/422 become Axios text or raw Odoo `error`. Users see `Request failed with status code 500`.

#### H10 — Offline GPS points are thrown away

Upload failure is logged and dropped. Types have `is_offline_sync` but it is unused. Holes in the trail with no internet.

#### H11 — No redirect after interceptor logout

Same as C1 from the user’s point of view.

#### H12 — Check-in times can be wrong (timezone)

Datetimes without `Z` get `Z` appended, treated as UTC. Wrong clock / worked hours.

#### H13 — Time Off breaks if `employee.id` is missing

Login employee type has optional `id`. List/submit skip or toast “profile missing”.

#### H14 — Firebase client key is in git

Normal for Firebase, but dangerous if the key has no app/SHA restrictions. Restrict in Google Cloud; rotate if it was shared widely.

#### H15 — Timeout strategy is uneven

15s default prevents infinite hang; some GETs have no extra timeout; device-token register has no extra timeout; no retry except 401.

#### H16 — Task Map HTTP continues after you leave

`cancelled` flag ignores in-flight HTTP. AbortController on blur needed.

#### H17 — Server can set GPS upload every 1 second

Client allows 1s; uploads take up to 60s; `uploadInFlight` skips, so points are lost and battery dies. Floor at 10–15 seconds.

#### H18 — “Get Help” does nothing

`HomeScreen` `onPress={() => {}}`. Open a URL or hide the button.

### 6.3 Medium

See issue table M1–M24. Highlights:

- **M2:** Resume task “Later” never re-prompts until Home remounts.
- **M4:** Location dialog can appear after the task list already loaded.
- **M5/M6:** Pagination caps hide data (50 sessions / 200 leaves).
- **M19:** GPS + camera required on **all** post-splash screens including Time Off.
- **M23:** Session GET failure silently uses local attendance (stale check-in).
- **M24:** Time Off kebab is a stub.

### 6.4 Low

Unused map libraries, two icon packages, ProGuard off, almost no tests, huge `apiClient.ts`, Fetch URL rejects staging URLs with ports, no deep links.

### 6.5 Auth, timeout, offline, crash (short)

**Auth:** Tokens in AsyncStorage; Bearer per call (not Axios default header). Refresh is single-flight on 401. Splash refresh is a **second path**. No proactive refresh before expiry (30s skew only at splash). Logout from Settings is complete; interceptor logout is **not**. Push unregister on logout/auth failure.

**Timeout / hang:** 15s default prevents infinite Axios hang. Splash/GPS waits **can** feel infinite. `slowWaitToast` only tracks **non-GET** after 3.5s. GET screens can spin until 15s then error (good) or until abort.

**Offline:** NetInfo on splash only. Later screens map Axios no-response to `network_error`. Location points are **not** queued. Attendance sync **silently** uses cache.

**Crashes (realistic):** invalid map coords; WebView/Maps JS; missing `employee.id`; unhandled `setState` on TaskRouting refresh; VisionCamera if no device; assuming `checklist.todo` arrays (parser throws → error UI, not crash).

---

## 7. Fix priority

### 7.1 Fix immediately (Critical + High)

1. **C1** — Redirect to login when refresh fails (auth-aware navigation).
2. **C2 / H10 / H17 / M13 / M14** — Real background tracking + upload queue + sane min interval (C2 is a large follow-up).
3. **C3** — Secure token storage; disable backup.
4. **C4 / H8 / L8** — Strip production logs (especially GPS and Time Off).
5. **C5** — Fix launcher icon resource name.
6. **C6 / H14** — Restrict Maps/Firebase keys; stop treating JS Maps key as safe in HTML.
7. **H1 / H2 / H6** — Time Off pagination, submit lock, shared leave-type cache.
8. **H3 / H4 / H16** — Task Map: don’t rebuild on every focus; throttle GPS; abort HTTP.
9. **H5** — Abort Task Routing GETs; fix refresh cancellation.
10. **H9** — Safe API error copy.
11. **H12** — Check-in time zone.
12. **H18** — Remove or implement Get Help.

### 7.2 Fix before production (Medium)

M2 resume prompt, M4 GPS race, M5/M6 pagination caps, M7/M8 double-submit, M9 avatar size, M10 clock interval, M11 notification channel, M19 camera gate on Time Off, M21/M22 focus refetch, M23 silent session errors, M24 kebab, login email format, ProGuard (L3) if you ship obfuscation.

### 7.3 Improvements (Low)

Remove unused MapLibre / RN Maps / Nitro Image / new-app-screen. Split `apiClient.ts`. Tests for auth interceptor and attendance TTL. Optional in-app theme. Tablet width. Deep links if notifications should open a task.

### 7.4 Suggested PR split

1. C5, C4/logs, H2, H18, H17, Manifest backup (small, safe)
2. C1 navigation + H9 errors
3. Time Off H1/H6 + kebab
4. Task Routing H5 + Task Map H3/H4/H16 + Home H7
5. Check-in timezone + access gate + session toast
6. Later epic: **C2 background GPS** + offline queue

---

## 8. Appendix — Agent fix prompt

Copy the block below into a new Agent chat when you want implementation. Do **not** implement full native background GPS (C2) in the first pass unless explicitly requested.

```
You are working in the React Native CLI app at:
/home/deep-patel/Application123/eb_geoemployee_tracker_mobile

Do NOT change business rules unless required to fix a bug.
Do NOT print or commit secrets (tokens, Maps keys, Firebase keys). Mask them.
Do NOT implement full native background GPS in the first pass unless I say so — that is a large follow-up (C2).
Prefer small, reviewable diffs. Match existing code style.

## Context
- RN 0.86 / React 19, Redux Toolkit, Axios (15s default timeout), Odoo REST.
- Tokens in AsyncStorage. Single native stack (not auth-gated).
- Field tracking uses JS setInterval. Maps use WebView + company Google JS key from GET /field/map-config.

## Fix in this pass (required)

### C1 — Auth failure must leave the app
Files: App.tsx, AppNavigator.tsx, authSessionBridge
When refresh fails / onAuthFailure runs, reset navigation to Fetch URL (same as Settings logout). Do not leave the user on Home/tasks with a null token.
Keep a navigationRef and reset it from onAuthFailure (or subscribe to logout and reset).

### C5 — Android icon
File: android/app/src/main/AndroidManifest.xml
Change android:icon from "@mipmap /ic_launcher" (space) to "@mipmap/ic_launcher".

### C3 — Backup + tokens (minimal)
- Set android:allowBackup="false" on the application tag.
- Do not invent a full Keychain migration unless it is small and consistent; if you add encrypted storage, keep loadSession/saveSession/clearSession working for existing users.

### C4 + H8 + TaskMap/TaskRouting/Location production logs
Remove or wrap in `if (__DEV__)`:
- locationTrackingService.ts coordinate logs
- apiClient.ts [TimeOff] console.logs
- TaskMapScreen / TaskRoutingScreen unguarded console.logs that include PII/coords/task names
Do not log tokens, passwords, or map API keys.

### H9 — User-facing API errors
apiClient.ts extractErrorMessage + getAuthErrorMessage:
Never show raw Axios messages or unmapped backend strings. Map 401/403/404/409/422/429/5xx/timeout/network to existing AUTH_ERROR_MESSAGES (add keys if needed).

### H2 — Time off double submit
TimeOffRequestScreen handleSubmit:
Lock immediately with a ref (and setSubmitting) BEFORE validation async work. Ignore extra taps. Keep existing validation and attachment behavior (leave created even if attach fails is OK, but do not create two leaves).

### H1 — Time off list pagination
TimeOffCalendarScreen currently uses fetchHrLeaves default limit 20.
Load all pages or add load-more until the API has no more rows. Cancel with AbortController (already used). Do not break filters/chips.

### H6 — Duplicate Time Off APIs
TimeOffCalendarScreen (focus) and TimeOffRequestScreen both fetch hr.leave.type and hr.leave.
Add a small in-memory cache (module-level or existing store) with short TTL so Request reuses Calendar data when navigating Calendar → Request. Still refetch after successful submit.

### H5 — Task routing abort
TaskRoutingScreen loadTasks:
Use AbortController. handleRefresh must NOT use loadTasks(() => false). Cancel on unmount and when chip/date/page changes.

### H3 + H16 + H4 (Task Map) — do not over-refactor the whole 2000-line file
TaskMapScreen:
- Do not full-bootstrap (task-detail + map-config + rebuild HTML) on every focus. Bootstrap once per taskId; on later focus only resume GPS watch if needed.
- Pass AbortSignal into fetchFieldTaskDetail, fetchFieldMapConfig, fetchFieldDirections; abort on blur.
- Soften watchPosition: distanceFilter ~10, interval ~3000, fastestInterval ~2000 (keep cleanup on blur).
- Keep existing start/arrive/cancel/pause behavior.

### H7 — Home resume duplicate task-detail
HomeScreen fetches task detail then opens TaskMap which fetches again.
Pass enough params so TaskMap can skip the first detail fetch if data is already present, OR a tiny session cache keyed by taskId with short TTL. Do not break resume → TaskCapture vs TaskMap routing.

### H12 — Check-in timezone
CheckInScreen formatTimeLabel / formatTotalHours:
Stop blindly appending "Z". Display times consistently with how Odoo sends them (same approach as GeoHistoryDayScreen formatClock if that is correct). Worked hours must not jump by timezone offset.

### H18 — Get Help
HomeScreen: either hide Get Help or wire it to a real URL/screen. Do not leave onPress={() => {}}.

### H21 / H17 — Client min tracking interval
locationTrackingService: raise MIN_TRACKING_INTERVAL_SECONDS to at least 10 (or 15). Do not allow 1s uploads.

### M19 — Access gate too wide (if easy)
useAccessGateMonitor is enabled for every screen after splash, including Time Off.
Only enforce GPS+camera on field/camera screens (Home optional, CheckIn, DefaultRoute, TaskMap, TaskCapture, Selfie, ViewDetails, Geo). Do not block Time Off / Attendance / Settings / Profile on camera.

### M24 — Time Off kebab
TimeOffCalendarScreen: hide the more-vert button until it has a real action (or implement cancel if the API already supports it — do not invent cancel API).

### M23 — Silent session sync failure
attendanceStorage syncAttendanceFromServerNetwork: on network/API failure, keep local fallback but surface a toast once (or return a flag) so Home/CheckIn can show “Could not refresh attendance” without looping toasts.

### C6 — Maps key (do not break maps)
Do not hardcode a Maps key. Keep fetching map-config.
Add a code comment that the key must be restricted in Google Cloud.
Do not log the key (TaskMap already logs keyLength — keep length only, and only in __DEV__).

## Explicitly OUT OF SCOPE for this pass (unless leftover is tiny)
- C2 full background GPS / Android foreground service / iOS Always location (document a TODO in locationTrackingService only).
- H10 full offline point queue (optional small TODO).
- Removing unused npm packages (MapLibre, react-native-maps, nitro-image) — do it only if you have time at the end and the app still builds conceptually; do not break autolinking mid-fix.
- Rewriting apiClient.ts into many files.
- Changing Odoo backend.

## Verification
- Typecheck / lint the files you touch.
- Confirm AndroidManifest icon has no space.
- Confirm login still works: Fetch URL → Login → Home.
- Confirm 401 refresh failure would reset to Fetch URL (code path).
- Confirm Time Off submit cannot fire twice.
- Confirm Task Routing aborts in-flight GET on unmount.
- Confirm Task Map does not rebuild HTML on every blur/focus of the same task.

When done, list files changed and which bug IDs are fixed vs still open (especially C2, C3 encryption, H10).
```

---

## 9. Document control

| Field | Value |
| --- | --- |
| Title | Geo Employee Tracker — Complete QA & Bug Audit Report |
| Version | 1.0 |
| Date | 14 August 2026 |
| Method | Static code review of the React Native CLI application |
| Code modified | None (audit only) |
| Related source | `docs/QA_Audit_Report.md` |

End of report.
