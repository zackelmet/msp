import { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { db } from "@/lib/firebase/firebaseClient";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import { ManualTest } from "@/lib/types/pentest";

export function useManualTests(engagementId?: string) {
  const { currentUser } = useAuth();
  const [tests, setTests] = useState<ManualTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setTests([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "manualTests"),
      where("userId", "==", currentUser.uid),
      orderBy("startTime", "desc")
    );

    if (engagementId) {
      q = query(
        collection(db, "manualTests"),
        where("userId", "==", currentUser.uid),
        where("engagementId", "==", engagementId),
        orderBy("startTime", "desc")
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const testList: ManualTest[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ManualTest[];
        setTests(testList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching manual tests:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, engagementId]);

  return { tests, loading, error };
}
