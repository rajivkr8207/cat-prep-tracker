"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Check, KeyRound } from "lucide-react";
import Dialog from "@/components/ui/dialog";
import { requestJson } from "@/lib/api-client";

export default function ChangePasswordDialog({ onClose, onSessionEnded }) {
  const [changed, setChanged] = useState(false);
  const {
    formState: { errors, isSubmitting },
    getValues,
    handleSubmit,
    register,
    setError,
  } = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  async function submit({ currentPassword, newPassword }) {
    try {
      await requestJson("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setChanged(true);
    } catch (error) {
      setError("root.server", { type: "server", message: error.message });
    }
  }

  return (
    <Dialog
      eyebrow="YOUR ACCOUNT"
      onClose={changed ? onSessionEnded : onClose}
      title={changed ? "Password updated" : "Change your password"}
    >
      {changed ? (
        <div className="password-success">
          <span className="password-success-icon"><Check size={22} /></span>
          <p>Your password has been changed. Sign in again with your new password.</p>
          <button className="button button-primary" onClick={onSessionEnded} type="button">
            Continue to sign in
          </button>
        </div>
      ) : (
        <form
          className="task-form grid grid-cols-1 gap-3 md:grid-cols-2"
          noValidate
          onSubmit={handleSubmit(submit)}
        >
          <label className="field-full">
            Current password
            <input
              autoComplete="current-password"
              autoFocus
              className="border-border bg-surface text-ink"
              type="password"
              {...register("currentPassword", {
                required: "Enter your current password.",
              })}
            />
            {errors.currentPassword ? (
              <span className="field-error">{errors.currentPassword.message}</span>
            ) : null}
          </label>
          <label className="field-full">
            New password
            <input
              autoComplete="new-password"
              className="border-border bg-surface text-ink"
              type="password"
              {...register("newPassword", {
                required: "Enter a new password.",
                minLength: {
                  value: 6,
                  message: "Password must be at least 6 characters.",
                },
                validate: (value) =>
                  value !== getValues("currentPassword") ||
                  "New password must be different from your current password.",
              })}
            />
            {errors.newPassword ? (
              <span className="field-error">{errors.newPassword.message}</span>
            ) : null}
          </label>
          <label className="field-full">
            Confirm new password
            <input
              autoComplete="new-password"
              className="border-border bg-surface text-ink"
              type="password"
              {...register("confirmPassword", {
                required: "Confirm your new password.",
                validate: (value) =>
                  value === getValues("newPassword") || "Passwords do not match.",
              })}
            />
            {errors.confirmPassword ? (
              <span className="field-error">{errors.confirmPassword.message}</span>
            ) : null}
          </label>
          {errors.root?.server ? (
            <p className="form-error field-full" role="alert">{errors.root.server.message}</p>
          ) : null}
          <div className="dialog-actions field-full">
            <button className="button button-quiet" onClick={onClose} type="button">
              Cancel
            </button>
            <button className="button button-primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? "Updating…" : "Change password"}
              <KeyRound size={16} />
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
