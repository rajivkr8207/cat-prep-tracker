export const PREPARATION_FIELDS = [
  "title",
  "date",
  "startTime",
  "endTime",
  "actual",
  "attempted",
  "correct",
  "notes",
  "planned",
  "priority",
  "section",
  "status",
];

export function getPreparationPayload(body) {
  const unsupportedFields = Object.keys(body).filter(
    (field) => !PREPARATION_FIELDS.includes(field),
  );

  if (unsupportedFields.length > 0) {
    return {
      error: `Unsupported field(s): ${unsupportedFields.join(", ")}`,
    };
  }

  return { payload: body };
}
