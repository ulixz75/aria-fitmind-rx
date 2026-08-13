# ARIA — FitMind Rx

**A**udio **R**ep **I**ntelligence **A**dvisor — **your voice coach anywhere**.

## Stack
React + TypeScript + Vite + PWA + Firebase Auth + Firestore + Firebase Storage. Realtime voice is prepared for `gpt-realtime-2.1-mini`.

## Portals
- Client: authentication, approval gate, dashboard, profile, voice-coach screen.
- Admin: overview, user search, approve/suspend/reactivate/delete profile actions.

## Auth flow
New users are created as `pending`. Admin changes the Firestore user document to `active`. Suspended users are blocked by the application and should also be blocked by rules.

Google and Email/Password are both supported.

## Firebase placeholders
Copy `.env.example` to `.env` and insert your Firebase Web App values.

## Firestore collections
- `users/{uid}` — role/status/access state.
- `clientProfiles/{uid}` — client training profile.
- `workoutSessions/{sessionId}` — session metadata.
- `workoutSessions/{sessionId}/sets/{setId}` — set records.
- `coachConfigs/{configId}` — global ARIA instruction/configuration placeholders.

Rules are included in `firestore.rules`. They use Firebase Authentication + role/status checks. Firestore evaluates web/mobile requests against these rules; queries must also comply with the rule conditions. See Firebase documentation on role-based access and query constraints.

## Storage paths
- `users/{uid}/profile/{filename}`
- `users/{uid}/progress/{filename}`

`storage.rules` restricts access to the owner or an admin and validates image uploads plus size limits.

## GPT-Realtime-2.1-mini
OpenAI's official model page lists audio/text realtime over WebRTC, WebSocket, or SIP and function calling support. The app intentionally does not place an OpenAI secret key in the frontend.

Production flow:
Browser -> Firebase Auth -> secure backend session endpoint -> ephemeral Realtime credential -> WebRTC -> GPT-Realtime-2.1-mini.

The coach instructions are already centralized in `src/services/realtimeCoach.ts` and cover human-like coaching, client memory retrieval, workout state, natural language, safety, and concise voice behavior.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

## Important admin note
The browser can manage Firestore role/status documents only under secure rules. Deleting a Firebase Authentication account requires a privileged server/Admin SDK operation; the current UI intentionally deletes only the Firestore profile and documents this limitation.
