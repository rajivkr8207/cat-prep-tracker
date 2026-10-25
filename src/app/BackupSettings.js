"use client";

import { useState } from "react";
import { requestJson } from "@/lib/api-client";

function downloadFile(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BackupSettings({ onDataReset }) {
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  // 1. Full JSON Backup
  async function handleDownloadBackup() {
    setError("");
    setNotice("");
    setDownloading(true);
    try {
      const data = await requestJson("/api/preparation/backup");
      downloadFile(
        "CAT_2027_Diary_Backup.json",
        JSON.stringify(data, null, 2),
        "application/json",
      );
      setNotice("Full backup downloaded successfully.");
    } catch (err) {
      setError(err.message || "Failed to download backup.");
    } finally {
      setDownloading(false);
    }
  }

  // 2. Import JSON Backup
  async function handleImportBackup(event) {
    setError("");
    setNotice("");
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm("Import this backup? Existing records will be updated with the backup data.")) {
      event.target.value = "";
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error("This file does not contain valid JSON.");
      }

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid backup file: expected a JSON object.");
      }

      const res = await requestJson("/api/preparation/restore", {
        method: "POST",
        body: JSON.stringify(parsed),
      });

      const r = res.restored || {};
      const summary = [
        r.tasks ? `${r.tasks} tasks` : null,
        r.reflections ? `${r.reflections} reflections` : null,
        r.topics ? `${r.topics} topics` : null,
        r.mocks ? `${r.mocks} mocks` : null,
        r.revisions ? `${r.revisions} revisions` : null,
        r.syllabusProgress ? `${r.syllabusProgress} syllabus items` : null,
      ]
        .filter(Boolean)
        .join(", ");

      setNotice(`Backup imported successfully: ${summary || "Records updated"}.`);
      onDataReset?.();
    } catch (err) {
      setError(err.message || "Could not import backup. Ensure it is a valid CAT 2027 Diary JSON backup.");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  // 3. Export Tasks CSV
  async function handleExportCsv() {
    setError("");
    setNotice("");
    try {
      const allTasks = [];
      let page = 1;
      let pages = 1;
      do {
        const result = await requestJson(`/api/preparation/tasks?page=${page}&limit=500`);
        allTasks.push(...result.tasks);
        pages = result.pagination.pages;
        page += 1;
      } while (page <= pages);

      const headers = [
        "date",
        "task",
        "section",
        "priority",
        "start_time",
        "end_time",
        "planned_minutes",
        "status",
        "attempted",
        "correct",
        "actual_minutes",
        "notes",
      ];

      const rows = allTasks.map((t) => {
        const values = {
          date: t.date,
          task: t.title,
          section: t.section,
          priority: t.priority,
          start_time: t.startTime,
          end_time: t.endTime,
          planned_minutes: t.planned,
          status: t.status,
          attempted: t.attempted,
          correct: t.correct,
          actual_minutes: t.actual,
          notes: t.notes,
        };
        return headers
          .map((h) => `"${String(values[h] ?? "").replace(/"/g, '""')}"`)
          .join(",");
      });

      downloadFile(
        "CAT_2027_Tasks.csv",
        [headers.join(","), ...rows].join("\r\n"),
        "text/csv;charset=utf-8;",
      );
      setNotice("Task CSV exported successfully.");
    } catch (err) {
      setError(err.message || "Could not export tasks CSV.");
    }
  }

  // 4. Delete All Diary Data
  async function handleClearAll() {
    setError("");
    setNotice("");
    if (
      !window.confirm(
        "Are you sure you want to delete ALL diary data? This will remove all tasks, reflections, reviews, topics, practice sessions, revisions, and mocks from your account. Download a backup first if needed.",
      )
    ) {
      return;
    }

    setClearing(true);
    try {
      await requestJson("/api/preparation/backup", { method: "DELETE" });
      setNotice("All diary data has been deleted.");
      onDataReset?.();
    } catch (err) {
      setError(err.message || "Failed to clear diary data.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <section id="view-settings" className="diary-panel">
      <div className="diary-topbar">
        <div>
          <h2>⚙️ Backup, export & settings</h2>
          <p className="diary-muted diary-small">
            Data is stored in your secure account. Download backups regularly so you can restore or archive your preparation records at any time.
          </p>
        </div>
      </div>

      {notice ? <div className="diary-notice diary-small" style={{ marginBottom: "14px", color: "#166534" }}>{notice}</div> : null}
      {error ? <div className="diary-notice diary-small" style={{ marginBottom: "14px", color: "#991b1b" }}>{error}</div> : null}

      <div className="diary-controls" style={{ gap: "12px", alignItems: "center" }}>
        <button
          type="button"
          className="diary-primary"
          id="backupJson"
          disabled={downloading}
          onClick={handleDownloadBackup}
        >
          {downloading ? "Generating backup…" : "Download full backup (JSON)"}
        </button>

        <label
          className="tab"
          htmlFor="restoreFile"
          style={{ display: "inline-flex", alignItems: "center", cursor: "pointer", margin: 0 }}
        >
          {uploading ? "Importing…" : "Import backup"}
        </label>
        <input
          id="restoreFile"
          type="file"
          accept=".json,application/json"
          style={{ maxWidth: "260px" }}
          disabled={uploading}
          onChange={handleImportBackup}
        />

        <button
          type="button"
          onClick={handleExportCsv}
        >
          Export tasks CSV
        </button>

        <button
          type="button"
          className="diary-danger"
          id="clearAll"
          disabled={clearing}
          onClick={handleClearAll}
        >
          {clearing ? "Deleting…" : "Delete all diary data"}
        </button>
      </div>

      <div className="diary-notice diary-small" style={{ marginTop: "16px" }}>
        <strong>Secure data persistence:</strong> Your preparation records are securely synchronized with your authenticated account.
        Backups export your tasks, reflections, weekly and monthly reviews, topic mastery, practice sessions, syllabus progress, revision queue, and mock tests.
      </div>
    </section>
  );
}
