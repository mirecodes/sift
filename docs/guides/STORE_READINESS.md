# STORE_READINESS.md

What App Store Connect and Google Play ask for, with Sift's answers (guidance_v2 Step 6.7). Fill these in when you create the listings; update this file if the app changes what it collects.

## Data the app collects

Only when the user signs in (local-only use collects nothing). No tracking, no ads, no analytics SDKs, no data sold or shared with third parties.

| Data | Why | Linked to the user | App Store label | Play data safety |
|---|---|---|---|---|
| Email address | Sign-in | Yes | Contact Info → Email Address · App Functionality | Personal info → Email · Account management |
| User id | Account | Yes | Identifiers → User ID · App Functionality | App info → Other IDs |
| Push token, platform, app version, locale | Push notifications | Yes | Identifiers → Device ID · App Functionality | Device or other IDs · App functionality |
| Handle (`name#tag`), group names, reports (Phase 7+) | Friends, groups, moderation | Yes | User Content → Other User Content · App Functionality | App activity → Other user-generated content |
| Focus sessions, island, animals, gold, items | The game itself | Yes | Usage Data → Product Interaction · App Functionality | App activity → Other actions |

- Data is encrypted in transit (HTTPS). Users can delete their account and all its data in the app (Settings → Account → Delete account, Step 5.4).
- iOS privacy manifest: `ios/App/App/PrivacyInfo.xcprivacy` (no tracking; required-reason APIs: UserDefaults `CA92.1`, file timestamps `C617.1`). Third-party SDKs (Firebase) ship their own manifests.
- Export compliance: only standard HTTPS → `ITSAppUsesNonExemptEncryption = NO` (already in `Info.plist`).

## Age rating

Mild cartoon battles between islands (Phase 9: animals "vanish" from a raid, no blood). No gambling with money (gold is earned only, never bought), no user chat. Expected: 9+ (Apple), PEGI 7 / Everyone (IARC). Answer "Infrequent/Mild cartoon or fantasy violence"; user-generated content: handles and group names, filtered and reportable.

## Required features (checklist)

- [x] In-app account deletion (Step 5.4).
- [x] Sign in with Apple wherever Google sign-in is offered (Step 5.4; needs the Apple provider in Supabase, `BACKEND_SETUP.md`).
- [ ] Block and report users, name filter (Step 7.2).
- [x] No permission at first launch: notifications at the first Focus start, push after a one-line explanation at the first social action.
- [x] No real-money purchases. If ever added, they must use the stores' in-app purchase systems.

## Review notes (paste into App Store Connect / Play Console)

> Sift is a focus timer: start a focus, and a small animal joins your island when it ends. To see the social features, sign in with the demo account below (email code sign-in: the code is sent to the demo inbox; or use the reviewer code we configure for this address). The demo account is already in a group with friends, so the Friends and Group tabs, rankings and wars are populated. Push notifications are optional and only about friends and groups; they never arrive while a focus is running.

Create the demo account once the social phases are live: sign in, set a handle, join a group with 2–3 other test accounts, run a few sessions on each. Keep its credentials in the store consoles only (not in this repo).

## Screenshots

Phone (6.9" and 6.5" iPhone, a 6"+ Android phone) and tablet: Home with the island, Focus, Break reveal, Collection, Group ranking. Take them from the simulator with `backend.provider: fake` and the dummy data (`testMode.dummyData`, dev build only).
