import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import imageSize from "image-size";
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

function getImageInfoFromDataUrl(dataUrl: string) {
  if (!dataUrl || !dataUrl.startsWith("data:")) {
    return { contentType: null, extension: null };
  }

  const mimeMatch = dataUrl.match(/^data:(.+?)[;,]/);

  if (!mimeMatch || mimeMatch.length < 2) {
    return { contentType: null, extension: null };
  }

  const contentType = mimeMatch[1];
  const extension =
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/gif": "gif",
      "image/svg+xml": "svg",
      "image/webp": "webp",
      "image/bmp": "bmp",
      "image/tiff": "tif",
      "image/x-icon": "ico",
      "image/avif": "avif",
    }[contentType] || null;

  return { contentType, extension };
}

function base64ToBlob({
  base64,
  contentType = "",
}: {
  base64: string;
  contentType: string;
}): Blob {
  const base64Clean = base64.replace(/^data:image\/[^;]+;base64,/, "");
  const byteCharacters = atob(base64Clean);
  const byteNumbers = new Array(byteCharacters.length);

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }

  const byteArray = new Uint8Array(byteNumbers);

  return new Blob([byteArray], { type: contentType });
}

export const uploadImage = async (base64: string) => {
  try {
    const { extension, contentType } = getImageInfoFromDataUrl(base64);
    const blob = base64ToBlob({
      base64,
      contentType: contentType || "image/jpeg",
    });
    const filename = `image-${uuidv4()}.${extension || "jpg"}`;
    const { error } = await supabase.storage
      .from("images")
      .upload(filename, blob);

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filename);

    return { publicUrl };
  } catch (error) {
    throw error;
  }
};

export const processImagesInHTML = async (html: string) => {
  const base64Regex = /<img.*?src="(data:image\/(.*?);base64,([^"]*))"[^>]*>/g;
  let modifiedHTML = html;
  const matches = Array.from(html.matchAll(base64Regex));

  const processingPromises = matches.map(async (match) => {
    const fullMatch = match[0];
    const dataUrl = match[1];
    // const imageExtension = match[2]
    const rawBase64 = match[3];

    try {
      const { publicUrl } = await uploadImage(dataUrl);
      const imageBuffer = Buffer.from(rawBase64, "base64");
      const { width, height } = imageSize(imageBuffer);

      return {
        original: fullMatch,
        replacement: `<img src="${publicUrl}" alt="Uploaded Image" width="${width}" height="${height}">`,
      };
    } catch (error) {
      console.error(
        "Error processing image:",
        error,
        "Original match:",
        fullMatch,
      );

      return { original: fullMatch, replacement: fullMatch };
    }
  });

  const results = await Promise.all(processingPromises);

  results.forEach((result) => {
    if (result) {
      modifiedHTML = modifiedHTML.replace(result.original, result.replacement);
    }
  });

  return modifiedHTML;
};
