import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "./firebase";
import type { AccountStatus, ClientProfile, UserDoc } from "../types/models";
export async function getUserDoc(uid: string) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? (s.data() as UserDoc) : null;
}
export async function upsertClientProfile(
  profile: ClientProfile,
) {
  const cleanProfile = Object.fromEntries(
    Object.entries(profile).filter(
      ([, value]) => value !== undefined,
    ),
  );

  await setDoc(
    doc(db, "clientProfiles", profile.uid),
    {
      ...cleanProfile,
      updatedAt: serverTimestamp(),
    },
    {
      merge: true,
    },
  );
}
export async function listUsers(status?: AccountStatus) {
  const c = collection(db, "users");
  const q = status
    ? query(
        c,
        where("status", "==", status),
        orderBy("createdAt", "desc"),
        limit(100),
      )
    : query(c, orderBy("createdAt", "desc"), limit(100));
  const s = await getDocs(q);
  return s.docs.map((d) => d.data() as UserDoc);
}
export async function updateAccountStatus(uid: string, status: AccountStatus) {
  await updateDoc(doc(db, "users", uid), {
    status,
    updatedAt: serverTimestamp(),
  });
}
export async function deleteUserDoc(uid: string) {
  await deleteDoc(doc(db, "users", uid));
}
export async function getClientProfile(uid: string): Promise<ClientProfile | null> {
  const snapshot = await getDoc(
    doc(db, "clientProfiles", uid),
  );

  return snapshot.exists()
    ? (snapshot.data() as ClientProfile)
    : null;
}