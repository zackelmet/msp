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
import { Engagement } from "@/lib/types/pentest";

export function useEngagements() {
  const { currentUser } = useAuth();
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setEngagements([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "engagements"),
      where("createdBy", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const engagementList: Engagement[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Engagement[];
        setEngagements(engagementList);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching engagements:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  return { engagements, loading, error };
}
