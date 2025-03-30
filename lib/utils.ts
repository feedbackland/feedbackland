import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const reservedSubdomains = ["get-started", "auth", "public"];

export const slugifySubdomain = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w.-]+/g, "") // Remove non-alphanumeric characters (except hyphens and periods initially)
    .replace(/\.+/g, "") // Remove all periods
    .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 63); // Truncate to the maximum subdomain length (63 characters)
};

const getUrlObject = (urlString?: string) => {
  if (urlString && urlString.length > 0) {
    return new URL(urlString);
  }

  if (typeof window !== "undefined") {
    return window.location;
  }

  return null;
};

export const getSubdomain = (urlString?: string | null) => {
  if (!urlString || urlString.length === 0) return null;

  const url = getUrlObject(urlString);

  if (!url) return null;

  const { hostname, pathname } = url;

  if (hostname.includes("localhost")) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : "";
  }

  const parts = hostname.split(".");

  return parts.length > 2 ? parts[0] : null;
};

export const getMaindomain = (urlString?: string) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { hostname } = url;

  if (hostname.includes("localhost")) {
    return "localhost";
  }

  const parts = hostname.split(".");

  return parts.length <= 2 ? hostname : parts.slice(-2).join(".");
};

export const getPlatformUrl = (urlString?: string) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  if (!url.hostname.includes("localhost")) {
    return `${url.protocol}//${url.hostname}`;
  } else {
    const pathParts = url.pathname.split("/");

    if (pathParts.length > 1 && pathParts[1]) {
      return `${url.protocol}//${url.hostname}:${url.port}/${pathParts[1]}`;
    }

    return `${url.protocol}//${url.hostname}:${url.port}`;
  }
};

export const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
};

export const base64ToBlob = ({
  base64,
  contentType,
}: {
  base64: string;
  contentType: string;
}) => {
  const byteCharacters = atob(base64);
  const byteArrays = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);

    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
};

export const processImagesInHTML = async (html: string) => {
  const base64Regex = /<img.*?src="(data:image\/(.*?);base64,([^"]*))"[^>]*>/g;
  let modifiedHTML = html;

  const matches = Array.from(html.matchAll(base64Regex));

  for (const match of matches) {
    const fullMatch = match[0];
    // const dataURL = match[1];
    const imageType = match[2];
    const base64Data = match[3];

    try {
      const blob = base64ToBlob({
        base64: base64Data,
        contentType: `image/${imageType}`,
      });
      const filename = `image-${uuidv4()}.${imageType}`;
      const { error } = await supabase.storage
        .from("images")
        .upload(filename, blob);

      if (error) {
        throw error;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filename);

      modifiedHTML = modifiedHTML.replace(
        fullMatch,
        `<img src="${publicUrl}" alt="Uploaded Image">`,
      );
    } catch (uploadError) {
      console.error("Error uploading image:", uploadError);
    }
  }

  return modifiedHTML;
};
