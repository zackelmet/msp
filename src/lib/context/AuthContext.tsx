"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import { DefaultCookieManager } from "../cookies/DefaultCookieManager";
import { AuthService } from "../auth/AuthService";

type UserClaims = {
  [key: string]: any;
};

interface AuthContextType {
  currentUser: User | null;
  userClaims: UserClaims | null;
  isLoadingAuth: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userClaims: null,
  isLoadingAuth: true,
});

export const useAuth = () => useContext(AuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
  authService: AuthService;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({
  children,
  authService,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userClaims, setUserClaims] = useState<UserClaims | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      setIsLoadingAuth(false);

      if (user) {
        const claims = await authService.getUserClaims(user);
        setUserClaims(claims);
        DefaultCookieManager.addAuthCookie(user.uid);
        // Mint the httpOnly, server-verified session cookie the /admin surface
        // trusts (the plain uid cookie above is NOT a security token).
        try {
          const idToken = await user.getIdToken();
          await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          });
        } catch (e) {
          console.error("session cookie sync failed", e);
        }
      } else {
        setUserClaims(null);
        DefaultCookieManager.removeAuthCookie();
        fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
      }
    });

    return () => unsubscribe();
  }, [authService]);

  useEffect(() => {
    if (isLoadingAuth) return;

    if (!currentUser && pathname.startsWith("/app")) {
      router.push("/login");
    } else if (currentUser && !currentUser.emailVerified && currentUser.providerData[0]?.providerId === "password" && pathname.startsWith("/app")) {
      // Email/password users must verify before accessing the app
      router.push("/verify-email");
    } else if (currentUser && pathname.startsWith("/login")) {
      router.push("/app/dashboard");
    } else if (currentUser && !currentUser.emailVerified && currentUser.providerData[0]?.providerId === "password" && pathname === "/verify-email") {
      // Stay on verify-email — do nothing
    }
  }, [currentUser, pathname, router, isLoadingAuth]);

  const value = {
    currentUser,
    userClaims,
    isLoadingAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
