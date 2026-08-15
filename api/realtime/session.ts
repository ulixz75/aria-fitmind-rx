import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const firebaseProjectId =
  process.env.FIREBASE_PROJECT_ID;

const firebaseClientEmail =
  process.env.FIREBASE_CLIENT_EMAIL;

const firebasePrivateKey =
  process.env.FIREBASE_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n",
  );

if (
  !firebaseProjectId ||
  !firebaseClientEmail ||
  !firebasePrivateKey
) {
  throw new Error(
    "Firebase Admin environment variables are not configured.",
  );
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: firebaseProjectId,
      clientEmail:
        firebaseClientEmail,
      privateKey:
        firebasePrivateKey,
    }),
  });
}

const adminAuth = getAuth();
const db = getFirestore();

const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY,
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    const authorization =
      req.headers.authorization;

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer ",
      )
    ) {
      return res.status(401).json({
        error:
          "Missing Firebase authentication token.",
      });
    }

    const idToken =
      authorization.slice(
        "Bearer ".length,
      );

    const decodedToken =
      await adminAuth.verifyIdToken(
        idToken,
      );

    const uid =
      decodedToken.uid;

    const userSnapshot =
      await db
        .collection("users")
        .doc(uid)
        .get();

    if (!userSnapshot.exists) {
      return res.status(403).json({
        error: "User account not found.",
      });
    }

    const userData =
      userSnapshot.data() ?? {};

    const role =
      userData.role;

    const status =
      userData.status;

    const authorized =
      role === "admin" ||
      (
        role === "client" &&
        status === "active"
      );

    if (!authorized) {
      return res.status(403).json({
        error:
          "User is not authorized for Realtime coaching.",
      });
    }

    const clientProfileSnapshot =
      await db
        .collection("clientProfiles")
        .doc(uid)
        .get();

    const clientProfile =
      clientProfileSnapshot.exists
        ? clientProfileSnapshot.data()
        : null;

    const body =
      req.body ?? {};

    const instructions =
      typeof body.instructions ===
      "string"
        ? body.instructions
        : "";

    const sessionContext =
      typeof body.context ===
      "string"
        ? body.context
        : "";

    /*
     * The server can append trusted profile
     * information that came from Firestore.
     *
     * The browser cannot override this data.
     */

    const trustedContext = `
TRUSTED CLIENT PROFILE

Client ID:
${uid}

Display name:
${clientProfile?.displayName ?? "Client"}

Preferred language:
${clientProfile?.preferredLanguage ?? "auto"}

Fitness level:
${clientProfile?.fitnessLevel ?? "Not provided"}

Primary goals:
${
  Array.isArray(
    clientProfile?.primaryGoals,
  )
    ? clientProfile.primaryGoals.join(
        ", ",
      )
    : "Not provided"
}

CLIENT-SUPPLIED SESSION CONTEXT:
${sessionContext}
`;

    /*
     * OpenAI Realtime client secret.
     *
     * The secret returned here is ephemeral.
     * The main OPENAI_API_KEY never reaches the browser.
     */

    const clientSecret =
      await openai.realtime.clientSecrets.create(
        {
          session: {
            type: "realtime",
            model:
              "gpt-realtime-2.1-mini",
            instructions: `${instructions}

${trustedContext}`,
          },
        },
      );

    return res.status(200).json({
      clientSecret:
        clientSecret.value,
      expiresAt:
        clientSecret.expires_at,
    });
  } catch (error) {
    console.error(
      "Realtime session creation failed:",
      error,
    );

    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Unable to create realtime session.",
    });
  }
}