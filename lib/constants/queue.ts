export const QUEUE_NAMES = {
  REPORT_PROCESSING: "report-processing",
  ANALYTICS: "analytics",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  EXTRACT_REPORT: "extract_report",
  GENERATE_REPORT_PAGE_IMAGES: "generate_report_page_images",
  ROLLUP_ANALYTICS_DAILY: "rollup_analytics_daily",
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];