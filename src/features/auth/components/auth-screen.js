"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import ThemeToggle from "@/components/ui/theme-toggle";
import LoginForm from "@/features/auth/components/login-form";
import RegisterForm from "@/features/auth/components/register-form";
import ForgotPasswordFlow from "@/features/auth/components/forgot-password-flow";

export default function AuthScreen({ initialError, onAuthenticated }) {
  const [mode, setMode] = useState("login");

  function changeMode(nextMode) {
    setMode(nextMode);
  }

  return (
    <main className="auth-screen grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(330px,0.92fr)_minmax(420px,1.08fr)]">
      <section className="auth-poster" aria-label="CAT Prep introduction">
        <div className="brand-lockup">
          <span className="brand-mark">C</span>
          <span>CAT PREP</span>
        </div>
        <div className="poster-copy">
          <span className="eyebrow">YOUR NEXT CHAPTER STARTS HERE</span>
          <h1>
            Small steps.
            <br />
            <span>Big percentile.</span>
          </h1>
          <p>
            Make every study session count. Plan your prep, track the work, and
            keep showing up.
          </p>
        </div>
        <div className="poster-stamp" aria-hidden="true">
          <Target size={25} strokeWidth={2.5} />
          <span>STAY<br />ON TRACK</span>
        </div>
        <span className="poster-foot">BUILT FOR THE LONG GAME · EST. TODAY</span>
      </section>
      <section className="auth-panel">
        <div className="auth-topline">
          <span>PREP, WITH PURPOSE.</span>
          <ThemeToggle />
        </div>
        <div className="auth-content">
          <span className="eyebrow">
            {mode === "login" ? "WELCOME BACK" : mode === "recovery" ? "ACCOUNT RECOVERY" : "LET'S GET STARTED"}
          </span>
          <h2>
            {mode === "login"
              ? "Pick up your pace."
              : mode === "recovery"
                ? "Reset your password."
                : "Make this your year."}
          </h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to get back to your study plan."
              : mode === "recovery"
                ? "We’ll email you a one-time code to verify it’s you."
                : "Create an account and start your CAT prep journey."}
          </p>
          {mode === "recovery" ? null : (
            <div className="auth-tabs" role="tablist" aria-label="Account access">
              <button
                aria-selected={mode === "login"}
                onClick={() => changeMode("login")}
                role="tab"
                type="button"
              >
                Sign in
              </button>
              <button
                aria-selected={mode === "register"}
                onClick={() => changeMode("register")}
                role="tab"
                type="button"
              >
                Create account
              </button>
            </div>
          )}
          {mode === "login" ? (
            <LoginForm
              initialError={initialError}
              onAuthenticated={onAuthenticated}
              onForgotPassword={() => changeMode("recovery")}
            />
          ) : mode === "register" ? (
            <RegisterForm
              initialError={initialError}
              onAuthenticated={onAuthenticated}
            />
          ) : (
            <ForgotPasswordFlow onBackToLogin={() => changeMode("login")} />
          )}
          <p className="auth-terms">SHOW UP. TRACK THE WORK. STAY FOCUSED.</p>
        </div>
      </section>
    </main>
  );
}
