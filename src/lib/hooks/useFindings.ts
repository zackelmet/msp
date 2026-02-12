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
import { Finding } from "@/lib/types/pentest";

export function useFindings(engagementId?: string) {
  const { currentUser } = useAuth();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setFindings([]);
      setLoading(false);
      return;
    }

    let q = query(
      collection(db, "findings"),
      where("userId", "==", currentUser.uid),
      orderBy("discoveredAt", "desc")
    );

    if (engagementId) {
      q = query(
        collection(db, "findings"),
        where("userId", "==", currentUser.uid),
        where("engagementId", "==", engagementId),
        orderBy("discoveredAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const findingList: Finding[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Finding[];
        setFindings(findingList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching findings:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, engagementId]);

  return { findings, loading, error };
}
