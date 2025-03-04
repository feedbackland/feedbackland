import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const reservedSubdomains = ["get-started", "auth", "public"];

export const cookieNames = {
  mainDomain: "maindomain",
  subDomain: "subdomain",
  platformUrl: "platform-url",
};

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
