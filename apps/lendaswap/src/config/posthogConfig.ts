import type { PostHogConfig } from "posthog-js";

const SEEDPHRASE_PATTERNS = [
  /mnemonic/i,
  /seed[-_]?phrase/i,
  /recovery[-_]?phrase/i,
  /private[-_]?key/i,
];

export function sanitizeProperties(properties: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (SEEDPHRASE_PATTERNS.some((pattern) => pattern.test(key))) {
      sanitized[key] = "[REDACTED]";
      continue;
    }

    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeProperties(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export function createPostHogConfig(posthogHost: string): Partial<PostHogConfig> {
  return {
    api_host: posthogHost,
    person_profiles: "identified_only",
    opt_out_capturing_by_default: false,
    session_recording: {
      maskAllInputs: false,
      blockClass: "ph-no-capture",
    },
    sanitize_properties: (properties) => {
      return sanitizeProperties(properties);
    },
    persistence: "localStorage+cookie",
    cookie_expiration: 365,
    secure_cookie: true,
  };
}
