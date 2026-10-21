import "server-only";

type DomainErrorCode =
  "BAD_REQUEST" | "CONFLICT" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND";

export class DomainError extends Error {
  constructor(
    public readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}
