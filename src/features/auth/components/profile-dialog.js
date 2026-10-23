"use client";

import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import Dialog from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";

export default function ProfileDialog({ user, onClose, onUpdated }) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: {
      fullName: user.fullName || "",
      username: user.username || "",
      email: user.email || "",
      mobile: user.mobile || "",
    },
  });

  async function submit(values) {
    try {
      const result = await requestJson(`/api/auth/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      onUpdated(result.user);
      onClose();
    } catch (error) {
      setError("root.server", { type: "server", message: error.message });
    }
  }

  return (
    <Dialog eyebrow="YOUR ACCOUNT" title="Your profile" onClose={onClose}>
      <form className="task-form grid grid-cols-1 gap-3 md:grid-cols-2" noValidate onSubmit={handleSubmit(submit)}>
        <label className="field-full">
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
        <label className="field-full">
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
        <label className="field-full">
          Email
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
        <label className="field-full">
          Mobile <span className="optional-label">OPTIONAL</span>
          <input
            autoComplete="tel"
            className="border-border bg-surface text-ink"
            inputMode="numeric"
            {...register("mobile", {
              validate: (value) => !value || /^[6-9]\d{9}$/.test(value) || "Enter a valid 10-digit mobile number.",
            })}
          />
          {errors.mobile ? <span className="field-error">{errors.mobile.message}</span> : null}
        </label>
        {errors.root?.server ? <p className="form-error field-full" role="alert">{errors.root.server.message}</p> : null}
        <div className="dialog-actions field-full">
          <button className="button button-quiet" onClick={onClose} type="button">Cancel</button>
          <button className="button button-primary" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Saving…" : "Save profile"}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
