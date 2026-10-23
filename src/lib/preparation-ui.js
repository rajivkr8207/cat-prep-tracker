export const SECTIONS = ["Quant", "VARC", "DILR", "Revision", "Mock_test", "Other"];
export const STATUSES = ["Pending","Not_Started", "In Progress", "Done", "Not_Done", "Skipped", "Rescheduled"];
export const PRIORITIES = ["Must do", "Shoud do", "Bonus", "High", "Medium", "Low"];

export function dateString(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

export function timeToDisplay(value) {
  if (!value) return "";
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export function timeToInput(value) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/i.exec(value || "");
  if (!match) return "09:00";
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

export function timeToMinutes(value) {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/i.exec(value || "");
  if (!match) return Number.MAX_SAFE_INTEGER;
  const hour = (Number(match[1]) % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0);
  return hour * 60 + Number(match[2]);
}
