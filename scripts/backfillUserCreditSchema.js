const admin = require("firebase-admin");

function initAdmin() {
  if (admin.apps.length) return;

  const projectId =
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail =
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL ||
    process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (
    process.env.FIREBASE_ADMIN_PRIVATE_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    ""
  ).replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
    return;
  }

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

async function backfillUsers() {
  initAdmin();
  const db = admin.firestore();

  console.log("Starting backfill for simplified user schema...");

  const snapshot = await db.collection("users").get();
  if (snapshot.empty) {
    console.log("No users found.");
    return;
  }

  let updated = 0;
  let skipped = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const legacyCredits = data.credits || {};

    const externalIp1To50Credits =
      typeof data.externalIp1To50Credits === "number"
        ? data.externalIp1To50Credits
        : typeof data.level1Credits === "number"
          ? data.level1Credits
          : typeof legacyCredits.web_app === "number"
            ? legacyCredits.web_app
            : typeof legacyCredits.level1 === "number"
              ? legacyCredits.level1
              : 0;

    const externalIp51To100Credits =
      typeof data.externalIp51To100Credits === "number"
        ? data.externalIp51To100Credits
        : typeof data.level2Credits === "number"
          ? data.level2Credits
          : typeof legacyCredits.external_ip === "number"
            ? legacyCredits.external_ip
            : typeof legacyCredits.level2 === "number"
              ? legacyCredits.level2
              : 0;

    const update = {
      uid: data.uid || doc.id,
      email: data.email || "",
      name: data.name || data.displayName || "",
      externalIp1To50Credits,
      externalIp51To100Credits,
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const unchanged =
      data.uid === update.uid &&
      data.email === update.email &&
      data.name === update.name &&
      (data.externalIp1To50Credits ?? data.level1Credits) ===
        update.externalIp1To50Credits &&
      (data.externalIp51To100Credits ?? data.level2Credits) ===
        update.externalIp51To100Credits &&
      !!data.createdAt;

    if (unchanged) {
      skipped += 1;
      continue;
    }

    await doc.ref.set(update, { merge: true });
    updated += 1;
  }

  console.log(
    `Backfill complete. Updated: ${updated}, Skipped: ${skipped}, Total: ${snapshot.size}`,
  );
}

backfillUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Backfill failed:", error);
    process.exit(1);
  });
