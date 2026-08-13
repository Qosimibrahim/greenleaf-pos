/**
 * Error reporting — captures application errors for monitoring.
 * Logs to console in development; can be wired to a real service.
 */
export function reportError(
  error: unknown,
  context: Record<string, unknown> = {},
) {
  console.error("[AppError]", error, context);
}

// Alias used in root error boundary
export { reportError as reportLovableError };
