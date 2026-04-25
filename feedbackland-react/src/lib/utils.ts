import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { version as uuidVersion } from "uuid";
import { validate as uuidValidate } from "uuid";

// Custom merge logic to handle 'fl:' prefix collisions
export function cn(...inputs: ClassValue[]) {
  const merged = clsx(inputs);
  const classes = merged.split(/\s+/).filter(Boolean);

  const mapping: Record<string, string> = {};
  const strippedClasses = classes.map((cls) => {
    // Strip fl: prefix if present so twMerge sees them as standard utility classes
    const stripped = cls.startsWith("fl:") ? cls.slice(3) : cls;
    // Store the mapping. If multiple classes map to the same stripped version,
    // the last one wins, which matches CSS cascade and twMerge behavior.
    mapping[stripped] = cls;
    return stripped;
  });

  const result = twMerge(strippedClasses);

  return result
    .split(/\s+/)
    .filter(Boolean)
    .map((cls) => mapping[cls] || cls)
    .join(" ");
}

export function validateUUID(uuid: string) {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}
