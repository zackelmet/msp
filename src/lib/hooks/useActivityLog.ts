import { useEffect, useState } from "react";
import { useAuth } from "@/lib/context/AuthContext";
import { db } from "@/lib/firebase/firebaseClient";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { ActivityLog } from "@/lib/types/pentest";

export function useActivityLog(limitCount: number = 50) {
  const { currentUser } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "activityLogs"),
      where("userId", "==", currentUser.uid),
      orderBy("timestamp", "desc"),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const logs: ActivityLog[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ActivityLog[];
        setActivities(logs);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching activity logs:", err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, limitCount]);

  return { activities, loading, error };
}
