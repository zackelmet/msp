"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import "@/lib/onboarding/tour-theme.css";
import { tourSteps } from "@/lib/onboarding/tourSteps";
import { useAuth } from "@/lib/context/AuthContext";

/** Dispatch `new Event(START_TOUR_EVENT)` to (re)play the tour on demand. */
export const START_TOUR_EVENT = "mspp:start-tour";
const SEEN_KEY = "mspp_tour_seen_v1";

/** True only if the anchor exists and is actually on-screen (drops off-canvas
 *  mobile sidebar items so the tour degrades gracefully). */
function isVisible(selector: string): boolean {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
}

export default function OnboardingTour() {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const autoStartedRef = useRef(false);

  const runTour = (markComplete: boolean) => {
    const steps = tourSteps.filter(
      (s) => !s.element || isVisible(s.element as string),
    );
    if (steps.length === 0) return;

    const persist = async () => {
      try {
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        /* ignore */
      }
      if (markComplete && currentUser?.uid) {
        try {
          const { getFirestore, doc, updateDoc, serverTimestamp } =
            await import("firebase/firestore");
          const app = (await import("@/lib/firebase/firebaseClient")).default;
          await updateDoc(doc(getFirestore(app), "users", currentUser.uid), {
            onboardingCompleted: true,
            onboardingCompletedAt: serverTimestamp(),
          });
        } catch (err) {
          console.error("Failed to persist onboarding completion:", err);
        }
      }
    };

    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      overlayColor: "#020a12",
      overlayOpacity: 0.72,
      stagePadding: 6,
      stageRadius: 10,
      popoverClass: "mspp-tour",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      steps,
      onDestroyed: () => {
        void persist();
      },
    });
    driverObj.drive();
  };

  // Auto-start for first-time users, once, on the dashboard route.
  useEffect(() => {
    if (!currentUser || autoStartedRef.current) return;
    if (pathname !== "/app/dashboard") return;
    if (
      typeof window !== "undefined" &&
      window.localStorage.getItem(SEEN_KEY) === "1"
    ) {
      return;
    }
    autoStartedRef.current = true;

    let cancelled = false;
    let timer: number | undefined;
    (async () => {
      // Cross-device guard: skip if Firestore already marks it complete.
      try {
        const { getFirestore, doc, getDoc } = await import("firebase/firestore");
        const app = (await import("@/lib/firebase/firebaseClient")).default;
        const snap = await getDoc(
          doc(getFirestore(app), "users", currentUser.uid),
        );
        if (snap.data()?.onboardingCompleted) return;
      } catch {
        /* fall through — localStorage guard already passed */
      }
      if (cancelled) return;
      // Let the dashboard content mount before measuring anchor positions.
      timer = window.setTimeout(() => runTour(true), 700);
    })();

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, pathname]);

  // Manual replay via the "Take a tour" button.
  useEffect(() => {
    const handler = () => runTour(true);
    window.addEventListener(START_TOUR_EVENT, handler);
    return () => window.removeEventListener(START_TOUR_EVENT, handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  return null;
}
