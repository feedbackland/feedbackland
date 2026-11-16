import { randomBytes } from "node:crypto";
import {
  issueSearchCapability,
  searchLifetimeMs,
} from "../../lib/search/capability";

export function searchTicket(expires = Date.now() + searchLifetimeMs) {
  return issueSearchCapability(randomBytes(32).toString("hex"), expires);
}
