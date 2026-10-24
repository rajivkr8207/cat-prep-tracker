export const PREPARATION_SECTIONS = Object.freeze({
  QUANT: "Quant",
  VARC: "VARC",
  DILR: "DILR",
  REVISION: "Revision",
  MOCK_TEST: "Mock_test",
  OTHER: "Other",
});

export const PREPARATION_SECTION_VALUES = Object.freeze(
  Object.values(PREPARATION_SECTIONS),
);

export const PREPARATION_STATUSES = Object.freeze({
  PENDING: "Pending",
  NOT_STARTED: "Not_Started",
  IN_PROGRESS: "In Progress",
  DONE: "Done",
  NOT_DONE: "Not_Done",
  SKIPPED: "Skipped",
  RESCHEDULED: "Rescheduled",
});

export const PREPARATION_STATUS_VALUES = Object.freeze(
  Object.values(PREPARATION_STATUSES),
);

export const PREPARATION_PRIORITIES = Object.freeze({
  MUST_DO: "Must do",
  SHOULD_DO: "Shoud do",
  BONUS: "Bonus",
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
});

export const PREPARATION_PRIORITY_VALUES = Object.freeze(
  Object.values(PREPARATION_PRIORITIES),
);
