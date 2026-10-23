"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight } from "lucide-react";
import { requestJson } from "@/lib/api-client";

export default function LoginForm({ initialError, onAuthenticated, onForgotPassword }) {
  const [serverError, setServerError] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({ defaultValues: { identifier: "", password: "" } });

  async function submit(values) {
    setServerError("");
    try {
      const result = await requestJson("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });
      onAuthenticated(result.user);
    } catch (error) {
      setServerError(error.message);
    }
  }

  return (
    <form className="stack-form" noValidate onSubmit={handleSubmit(submit)}>
      <label>
        Email or username
        <input
          autoComplete="username"
          className="border-border bg-surface text-ink"
          {...register("identifier", { required: "Enter your email or username." })}
        />
        {errors.identifier ? <span className="field-error">{errors.identifier.message}</span> : null}
      </label>
      <button
        className="auth-secondary-link auth-forgot-link"
        onClick={onForgotPassword}
        type="button"
      >
        Forgot password?
      </button>
      <label>
        Password
        <input
          autoComplete="current-password"
          className="border-border bg-surface text-ink"
          type="password"
          {...register("password", {
            required: "Enter your password.",
            minLength: { value: 6, message: "Password must be at least 6 characters." },
          })}
        />
        {errors.password ? <span className="field-error">{errors.password.message}</span> : null}
      </label>
      {serverError || initialError ? <p className="form-error" role="alert">{serverError || initialError}</p> : null}
      <button className="button button-primary auth-submit" disabled={isSubmitting} type="submit">
        {isSubmitting ? "One moment…" : "Sign in"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
