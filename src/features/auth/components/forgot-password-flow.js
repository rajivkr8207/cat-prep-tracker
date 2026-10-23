"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { requestJson } from "@/lib/api-client";

function RequestCodeForm({ onCodeRequested, onBack }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({ defaultValues: { email: "" } });

  async function submit(values) {
    try {
      await requestJson("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      onCodeRequested(values.email.trim().toLowerCase());
    } catch (error) {
      setError("root.server", { message: error.message });
    }
  }

  return (
    <form className="stack-form" noValidate onSubmit={handleSubmit(submit)}>
      <label>
        Email address
        <input
          autoComplete="email"
          className="border-border bg-surface text-ink"
          type="email"
          {...register("email", {
            required: "Enter your email address.",
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Enter a valid email address." },
          })}
        />
        {errors.email ? <span className="field-error">{errors.email.message}</span> : null}
      </label>
      {errors.root?.server ? <p className="form-error" role="alert">{errors.root.server.message}</p> : null}
      <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Sending code…" : "Send reset code"}
        <ArrowRight size={18} />
      </button>
      <button className="auth-secondary-link" onClick={onBack} type="button">
        <ArrowLeft size={15} /> Back to sign in
      </button>
    </form>
  );
}

function VerifyCodeForm({ email, onVerified, onRestart }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({ defaultValues: { otp: "" } });

  async function submit(values) {
    try {
      const result = await requestJson("/api/auth/verify-reset-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp: values.otp }),
      });
      onVerified(result.resetToken);
    } catch (error) {
      setError("root.server", { message: error.message });
    }
  }

  return (
    <form className="stack-form" noValidate onSubmit={handleSubmit(submit)}>
      <p className="password-reset-copy">
        If an account exists for <strong>{email}</strong>, a six-digit code has been sent.
      </p>
      <label>
        Six-digit code
        <input
          autoComplete="one-time-code"
          className="border-border bg-surface text-ink"
          inputMode="numeric"
          maxLength={6}
          {...register("otp", {
            required: "Enter the six-digit code.",
            pattern: { value: /^\d{6}$/, message: "Enter all six digits." },
          })}
        />
        {errors.otp ? <span className="field-error">{errors.otp.message}</span> : null}
      </label>
      {errors.root?.server ? <p className="form-error" role="alert">{errors.root.server.message}</p> : null}
      <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Checking code…" : "Verify code"}
        <ArrowRight size={18} />
      </button>
      <button className="auth-secondary-link" disabled={isSubmitting} onClick={onRestart} type="button">
        Request a new code
      </button>
    </form>
  );
}

function NewPasswordForm({ email, resetToken, onCompleted }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    control,
  } = useForm({ defaultValues: { password: "", confirmPassword: "" } });
  const password = useWatch({ control, name: "password" });

  async function submit(values) {
    try {
      await requestJson("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({
          email,
          resetToken,
          newPassword: values.password,
        }),
      });
      onCompleted();
    } catch (error) {
      setError("root.server", { message: error.message });
    }
  }

  return (
    <form className="stack-form" noValidate onSubmit={handleSubmit(submit)}>
      <label>
        New password
        <input
          autoComplete="new-password"
          className="border-border bg-surface text-ink"
          type="password"
          {...register("password", {
            required: "Enter your new password.",
            minLength: { value: 6, message: "Use at least 6 characters." },
          })}
        />
        {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
      </label>
      <label>
        Confirm new password
        <input
          autoComplete="new-password"
          className="border-border bg-surface text-ink"
          type="password"
          {...register("confirmPassword", {
            required: "Confirm your new password.",
            validate: (value) => value === password || "Passwords do not match.",
          })}
        />
        {errors.confirmPassword ? <span className="field-error">{errors.confirmPassword.message}</span> : null}
      </label>
      {errors.root?.server ? <p className="form-error" role="alert">{errors.root.server.message}</p> : null}
      <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Updating password…" : "Set new password"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}

export default function ForgotPasswordFlow({ onBackToLogin }) {
  const [step, setStep] = useState("request");
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");

  if (step === "complete") {
    return (
      <div className="password-reset-complete" role="status">
        <CheckCircle2 size={30} />
        <p>Your password has been changed. You can now sign in with your new password.</p>
        <button className="auth-secondary-link" onClick={onBackToLogin} type="button">
          <ArrowLeft size={15} /> Back to sign in
        </button>
      </div>
    );
  }

  if (step === "reset") {
    return (
      <NewPasswordForm
        email={email}
        onCompleted={() => setStep("complete")}
        resetToken={resetToken}
      />
    );
  }

  if (step === "verify") {
    return (
      <VerifyCodeForm
        email={email}
        onRestart={() => {
          setResetToken("");
          setStep("request");
        }}
        onVerified={(token) => {
          setResetToken(token);
          setStep("reset");
        }}
      />
    );
  }

  return (
    <RequestCodeForm
      onBack={onBackToLogin}
      onCodeRequested={(requestedEmail) => {
        setEmail(requestedEmail);
        setStep("verify");
      }}
    />
  );
}
