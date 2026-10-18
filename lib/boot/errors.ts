import "server-only";
/** Safe, application-authored diagnostics. Never wrap driver/provider text. */
export class BootError extends Error {
  constructor(
    public readonly stage: string,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}
