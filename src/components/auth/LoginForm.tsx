"use client";

import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faGoogle, faWindows } from "@fortawesome/free-brands-svg-icons";
// Lazy-load react-hot-toast and Firebase auth at runtime to avoid DOM access during server prerender
import { useRouter, useSearchParams } from "next/navigation";

enum FormMode {
  Login,
  Register,
}

export default function AuthForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const clearErrorOnChange = () => {
    if (error) setError(null);
  };
  const [formMode, setFormMode] = useState<FormMode>(FormMode.Login);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/app/dashboard";

  const handleGoogleAuth = async () => {
    try {
      const signInModule = await import("@/lib/firebase/signin");
      const { signIn, SignInMethod } = signInModule as any;
      const { user, error } = await signIn(SignInMethod.Google, {
        signupCallback: async (userCredential: any) => {
          // When a new user signs up, call the signup endpoint
          await fetch("/api/users/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              name: userCredential.user.displayName,
            }),
          });
        },
      });
      if (user) {
        router.push(returnUrl);
      } else if (error) {
        const { toast } = await import("react-hot-toast");
        toast.error(error);
      }
    } catch (err) {
      console.error("Google sign-in error:", err);
      const { toast } = await import("react-hot-toast");
      toast.error("An unexpected error occurred during Google sign-in");
    }
  };

  const handleMicrosoftAuth = async () => {
    try {
      const signInModule = await import("@/lib/firebase/signin");
      const { signIn, SignInMethod } = signInModule as any;
      const { user, error } = await signIn(SignInMethod.Microsoft, {
        signupCallback: async (userCredential: any) => {
          await fetch("/api/users/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              name: userCredential.user.displayName,
            }),
          });
        },
      });
      if (user) {
        router.push(returnUrl);
      } else if (error) {
        const { toast } = await import("react-hot-toast");
        toast.error(error);
      }
    } catch (err) {
      console.error("Microsoft sign-in error:", err);
      const { toast } = await import("react-hot-toast");
      toast.error("An unexpected error occurred during Microsoft sign-in");
    }
  };

  const handleLogin = async () => {
    try {
      const signInModule = await import("@/lib/firebase/signin");
      const { signIn, SignInMethod } = signInModule as any;
      const { user, error } = await signIn(SignInMethod.EmailPassword, {
        credentials: {
          email,
          password,
        },
        signupCallback: async (userCredential: any) => {
          // When a new user signs up, call the signup endpoint
          await fetch("/api/users/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              name: userCredential.user.displayName,
            }),
          });
        },
      });
      if (user) {
        router.push(returnUrl);
      } else if (error) {
        const { toast } = await import("react-hot-toast");
        toast.error(error);
      }
    } catch (err) {
      console.error("Email/password sign-in error:", err);
      const { toast } = await import("react-hot-toast");
      toast.error("An unexpected error occurred during login");
    }
  };

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const signUpModule = await import("@/lib/firebase/signup");
      const signUp = signUpModule.default as any;
      const { user, error } = await signUp(
        email,
        password,
        async (userCredential: any) => {
          // Ensure a Firestore user document is created for newly registered users
          await fetch("/api/users/bootstrap", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid: userCredential.user.uid,
              email: userCredential.user.email,
              name: userCredential.user.displayName,
            }),
          });
        },
      );
      if (user) {
        router.push("/verify-email");
      } else if (error) {
        setError(error.message);
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError("An unexpected error occurred during registration");
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      const { toast } = await import("react-hot-toast");
      toast.error("Please enter your email address.");
      return;
    }

    try {
      const authModule = await import("@/lib/firebase/firebaseClient");
      const firebaseAuth = (authModule as any).auth;
      const { sendPasswordResetEmail } = await import("firebase/auth");
      await sendPasswordResetEmail(firebaseAuth, email);
      const { toast } = await import("react-hot-toast");
      toast.success("Password reset email sent.");
    } catch (err) {
      console.error(err);
      const { toast } = await import("react-hot-toast");
      toast.error("An error occurred. Please try again.");
    }
  };

  // Hex grid SVG background — matches landing page
  const HEX_SVG_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='104' viewBox='0 0 120 104'%3E%3Cpolygon points='60,2 112,29 112,75 60,102 8,75 8,29' fill='none' stroke='%234590e2' stroke-width='0.8' opacity='0.22'/%3E%3C/svg%3E")`;

  return (
    <div className="relative min-h-screen bg-[#0a141f] text-white overflow-hidden flex items-center justify-center px-6 py-16">
      {/* Hex grid tile background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ backgroundImage: HEX_SVG_URI, backgroundSize: "120px 104px" }}
      />
      {/* Radial fade over hex grid */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,#0a141f00_0%,#0a141f_70%)]" />
      {/* Blue glow top-left */}
      <div className="absolute -top-32 -left-32 w-[500px] h-[500px] rounded-full bg-[#4590e2]/10 blur-[120px] pointer-events-none" />
      {/* Blue glow bottom-right */}
      <div className="absolute -bottom-32 -right-32 w-[400px] h-[400px] rounded-full bg-[#4590e2]/08 blur-[100px] pointer-events-none" />

      <div className="relative w-full max-w-6xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-12 items-center">
          {/* Left: copy */}
          <div className="flex-1 space-y-5 text-center lg:text-left">
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#4590e2]/10 border border-[#4590e2]/30 text-[#4590e2] text-sm font-semibold"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              MSP PENTESTING CLIENT PORTAL
            </div>
            <h1
              className="text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight"
              style={{ fontFamily: "var(--font-chakra-petch)" }}
            >
              {formMode === FormMode.Login
                ? "Welcome back."
                : "Get started today."}
            </h1>
            <p className="text-gray-300 text-base lg:text-lg max-w-md">
              {formMode === FormMode.Login
                ? "Sign in to view your pentest requests, monitor progress, and download reports."
                : "Create your account and submit your first pentest request in minutes."}
            </p>
            <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
              {[
                "White-Labeled Reports",
                "OSCP-Certified Testers",
                "AI-Powered Testing",
              ].map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#4590e2]/10 border border-[#4590e2]/25 text-[#7ab8f5] text-xs font-medium"
                >
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Right: form card */}
          <div className="flex-1 w-full max-w-md">
            <div className="rounded-2xl bg-[#0d1e30] border border-[#4590e2]/25 shadow-[0_30px_80px_rgba(0,0,0,0.55)] p-7 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p
                    className="text-xs uppercase tracking-[0.18em] text-[#4590e2]/70 mb-1"
                    style={{ fontFamily: "var(--font-chakra-petch)" }}
                  >
                    {formMode === FormMode.Login
                      ? "Welcome back"
                      : "Create account"}
                  </p>
                  <h2
                    className="text-2xl font-bold text-white"
                    style={{ fontFamily: "var(--font-chakra-petch)" }}
                  >
                    {formMode === FormMode.Login ? "Sign in" : "Sign up"}
                  </h2>
                </div>
                <button
                  className="text-sm px-3 py-1.5 border border-[#4590e2]/40 hover:border-[#4590e2] text-[#4590e2] hover:bg-[#4590e2]/10 rounded-lg transition-colors"
                  onClick={() =>
                    setFormMode(
                      formMode === FormMode.Login
                        ? FormMode.Register
                        : FormMode.Login,
                    )
                  }
                >
                  {formMode === FormMode.Login
                    ? "New here?"
                    : "Have an account?"}
                </button>
              </div>

              {error && (
                <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[#4590e2]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#4590e2] transition-colors text-sm"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearErrorOnChange();
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-300">
                    Password
                  </label>
                  <input
                    type="password"
                    placeholder="Enter password"
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[#4590e2]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#4590e2] transition-colors text-sm"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      clearErrorOnChange();
                    }}
                  />
                </div>

                {formMode === FormMode.Register && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-300">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      placeholder="Repeat password"
                      className="w-full px-4 py-3 rounded-lg bg-white/5 border border-[#4590e2]/20 text-white placeholder-gray-500 focus:outline-none focus:border-[#4590e2] transition-colors text-sm"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                )}

                {formMode === FormMode.Login && (
                  <div className="flex justify-end">
                    <button
                      className="text-sm text-gray-400 hover:text-white underline transition-colors"
                      onClick={handleForgotPassword}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {formMode === FormMode.Login ? (
                  <button
                    disabled={!email || !password}
                    onClick={handleLogin}
                    className="relative w-full py-3 text-white font-bold overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: "var(--font-chakra-petch)" }}
                  >
                    <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors rounded" />
                    <span className="absolute inset-0 bg-[#4590e2]/15 group-hover:bg-[#4590e2]/25 transition-colors rounded" />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#0a141f] rotate-45 translate-x-1.5 -translate-y-1.5" />
                    <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-[#0a141f] rotate-45 -translate-x-1.5 translate-y-1.5" />
                    <span className="relative z-10">Sign in</span>
                  </button>
                ) : (
                  <button
                    disabled={!email || !password || !confirmPassword}
                    onClick={handleRegister}
                    className="relative w-full py-3 text-white font-bold overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontFamily: "var(--font-chakra-petch)" }}
                  >
                    <span className="absolute inset-0 border border-[#4590e2]/60 group-hover:border-[#4590e2] transition-colors rounded" />
                    <span className="absolute inset-0 bg-[#4590e2]/15 group-hover:bg-[#4590e2]/25 transition-colors rounded" />
                    <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-[#0a141f] rotate-45 translate-x-1.5 -translate-y-1.5" />
                    <span className="absolute bottom-0 left-0 w-2.5 h-2.5 bg-[#0a141f] rotate-45 -translate-x-1.5 translate-y-1.5" />
                    <span className="relative z-10">Create account</span>
                  </button>
                )}

                <button
                  className="w-full py-3 font-semibold flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 bg-white/5 hover:bg-white/10 text-white rounded transition-colors text-sm"
                  onClick={handleGoogleAuth}
                >
                  <FontAwesomeIcon icon={faGoogle} className="text-base" />{" "}
                  Continue with Google
                </button>

                <button
                  className="w-full py-3 font-semibold flex items-center justify-center gap-2 border border-[#00a4ef]/30 hover:border-[#00a4ef]/60 bg-[#00a4ef]/5 hover:bg-[#00a4ef]/10 text-white rounded transition-colors text-sm"
                  onClick={handleMicrosoftAuth}
                >
                  <FontAwesomeIcon
                    icon={faWindows}
                    className="text-base text-[#00a4ef]"
                  />{" "}
                  Continue with Microsoft
                </button>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-[#4590e2]/30 to-transparent" />

              <p className="text-xs text-gray-500 text-center">
                By continuing you agree to our Terms and Privacy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
