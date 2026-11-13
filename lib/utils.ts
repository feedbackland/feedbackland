import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { validate as uuidValidate, version as uuidVersion } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function capitalizeFirstLetter(val: string) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export function isUuidV4(uuid: string) {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}
