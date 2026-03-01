"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase/firebaseClient";

export function useUserScans(uid?: string | null) {
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setScans([]);
      setLoading(false);
      return;
    }

    // Listen to the top-level `pentests` collection (new AI pentest system)
    const pentestsQ = query(
      collection(db, "pentests"),
      where("userId", "==", uid),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      pentestsQ,
      (snap) => {
        const items: any[] = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            scanId: doc.id,
            type: data.type,
            target: data.targetUrl,
            status: data.status,
            startTime: data.createdAt || null,
            endTime: data.completedAt || null,
            results: data.results || null,
            vulnerabilities: data.vulnerabilities || [],
          };
        });
        setScans(items);
        setLoading(false);
      },
      (err) => {
        console.error("useUserScans: pentests snapshot error", err);
        setScans([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [uid]);

  return { scans, loading };
}
