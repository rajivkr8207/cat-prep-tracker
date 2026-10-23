"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowRight } from "lucide-react";
import { requestJson } from "@/lib/api-client";

export default function RegisterForm({ initialError, onAuthenticated }) {
  const [serverError, setServerError] = useState("");
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm({
    defaultValues: { fullName: "", username: "", email: "", password: "" },
  });

  async function submit(values) {
    setServerError("");
    try {
      const result = await requestJson("/api/auth/register", {
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
        Full name
        <input
          autoComplete="name"
          className="border-border bg-surface text-ink"
          {...register("fullName", {
            required: "Enter your full name.",
            minLength: { value: 2, message: "Use at least 2 characters." },
            maxLength: { value: 120, message: "Use 120 characters or fewer." },
          })}
        />
        {errors.fullName ? <span className="field-error">{errors.fullName.message}</span> : null}
      </label>
      <label>
        Username
        <input
          autoComplete="username"
          className="border-border bg-surface text-ink"
          {...register("username", {
            required: "Choose a username.",
            minLength: { value: 3, message: "Use at least 3 characters." },
            maxLength: { value: 30, message: "Use 30 characters or fewer." },
            pattern: { value: /^[a-z0-9]+$/, message: "Use lowercase letters and numbers only." },
            setValueAs: (value) => value.toLowerCase(),
          })}
        />
        {errors.username ? <span className="field-error">{errors.username.message}</span> : null}
      </label>
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
      <label>
        Password
        <input
          autoComplete="new-password"
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
        {isSubmitting ? "One moment…" : "Create account"}
        <ArrowRight size={18} />
      </button>
    </form>
  );
}
