export const TASK_SECTIONS = Object.freeze({
  QUANT: "Quant",
  VARC: "VARC",
  DILR: "DILR",
  REVISION: "Revision",
  MOCK_TEST: "Mock test",
  ANALYSIS: "Analysis",
  OTHER: "Other",
});

export const TASK_SECTION_VALUES = Object.freeze(
  Object.values(TASK_SECTIONS),
);

export const TASK_STATUSES = Object.freeze({
  PENDING: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
  PARTLY_DONE: "Partly done",
  NOT_DONE: "Not done",
  SKIPPED: "Skipped",
  RESCHEDULED: "Rescheduled",
});

export const TASK_STATUS_VALUES = Object.freeze(
  Object.values(TASK_STATUSES),
);

export const TASK_PRIORITIES = Object.freeze({
  MUST_DO: "Must do",
  SHOULD_DO: "Should do",
  BONUS: "Bonus",
});

export const TASK_PRIORITY_VALUES = Object.freeze(
  Object.values(TASK_PRIORITIES),
);
