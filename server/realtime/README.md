# ARIA Realtime secure endpoint

Expected endpoint: `POST /api/realtime/session`

1. Authenticate the Firebase user.
2. Verify `users/{uid}` is an approved active client or authorized admin.
3. Load `clientProfiles/{uid}` and only the workout data needed for the session.
4. Create a short-lived OpenAI Realtime client secret/session for `gpt-realtime-2.1-mini`.
5. Return only the ephemeral client credential/session information required by the browser.
6. Never expose the OpenAI server API key to the React app.

Recommended backend: Node.js + TypeScript.
