import "server-only";
import type { InsightFailure } from "./insight-run";

type DomainErrorCode =
  | "BAD_REQUEST"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "TOO_MANY_REQUESTS"
  | "PRECONDITION_FAILED"
  | "SERVICE_UNAVAILABLE"
  | "CLIENT_CLOSED_REQUEST";

const statusByCode: Record<DomainErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PRECONDITION_FAILED: 412,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499,
  SERVICE_UNAVAILABLE: 503,
};

export class DomainError extends Error {
  get status() {
    return statusByCode[this.code];
  }

  constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly retryAfterSeconds?: number,
    public readonly resetsAt?: string,
    public readonly reason?: InsightFailure,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
