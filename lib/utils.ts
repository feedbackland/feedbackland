import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import imageSize from "image-size";
import { validate as uuidValidate, version as uuidVersion } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const reservedSubdomains = [
  "api",
  "feedback",
  "new",
  "auth",
  "public",
  "static",
  "get-started",
];

export const convertToSubdomain = (text: string) => {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w.-]+/g, "") // Remove non-alphanumeric characters (except hyphens and periods initially)
    .replace(/\.+/g, "") // Remove all periods
    .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 63); // Truncate to the maximum subdomain length (63 characters)
};

export function capitalizeFirstLetter(val: string) {
  return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

export function isUuidV4(uuid: string) {
  return uuidValidate(uuid) && uuidVersion(uuid) === 4;
}

const getUrlObject = (urlString?: string | null) => {
  if (urlString && urlString.length > 0) {
    return new URL(urlString);
  }

  if (typeof window !== "undefined") {
    return window.location;
  }

  return null;
};

export const getIsSubdirOrg = (urlString?: string | null) => {
  const url = getUrlObject(urlString);

  if (!url) return false;

  const { host } = url;

  return host?.includes("localhost") || host?.includes("vercel.app");
};

export const getSubdomain = (urlString?: string | null) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { hostname, pathname } = url;

  const isSubdirOrg = getIsSubdirOrg(urlString);

  if (isSubdirOrg) {
    const segments = pathname.split("/").filter(Boolean);
    return segments.length > 0 ? segments[0] : "";
  }

  const parts = hostname.split(".");

  return parts.length > 2 ? parts[0] : null;
};

export const getMaindomain = (urlString?: string) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { hostname, host } = url;

  const isSubdirOrg = getIsSubdirOrg(urlString);

  if (isSubdirOrg) return host;

  const parts = hostname.split(".");

  return parts.length > 1 ? parts.slice(-2).join(".") : hostname;
};

export const getPlatformUrl = (urlString?: string) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { pathname, protocol, hostname, host } = url;

  const isSubdirOrg = getIsSubdirOrg(urlString);

  if (!isSubdirOrg) return `${protocol}//${hostname}`;

  const parts = pathname.split("/");

  const orgName = parts?.[1];

  return `${protocol}//${host}${orgName ? `/${orgName}` : ""}`;
};

export const getVercelUrl = () => {
  if (process?.env?.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  } else if (process?.env?.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
  }

  return null;
};

export const navigateToSubdomain = ({ subdomain }: { subdomain: string }) => {
  if (subdomain) {
    const { protocol } = window.location;
    const isSubdirOrg = getIsSubdirOrg();
    const maindomain = getMaindomain();
    const url = isSubdirOrg
      ? `${protocol}//${maindomain}/${subdomain}`
      : `${protocol}//${subdomain}.${maindomain}`;
    window.location.href = url;
  }
};

export const getIsSelfHosted = (
  context: "server" | "client" | "all" = "all",
) => {
  if (context === "server") {
    return process?.env?.SELF_HOSTED === "true";
  }

  if (context === "client") {
    return process?.env?.NEXT_PUBLIC_SELF_HOSTED === "true";
  }

  if (context === "all") {
    return !!(
      process?.env?.SELF_HOSTED === "true" ||
      process?.env?.NEXT_PUBLIC_SELF_HOSTED === "true"
    );
  }

  return false;
};

const getImageDimensions = (
  source: string,
): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () =>
      reject(new Error("Failed to load image to get dimensions."));
    img.src = source;
  });
};

function getImageExtension(base64: string) {
  const match = base64.match(/^data:image\/(\w+);base64,/);
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  return mimeType === "jpeg" ? "jpg" : mimeType;
}

async function getBlob(base64: string) {
  const response = await fetch(base64);
  const blob = await response.blob();
  return blob;
}

export const uploadImage = async (base64Image: string) => {
  try {
    const { width, height } = await getImageDimensions(base64Image);
    const imageExtension = getImageExtension(base64Image);
    const blob = await getBlob(base64Image);
    const filename = `image-${uuidv4()}.${imageExtension}`;
    const { error } = await supabase.storage
      .from("images")
      .upload(filename, blob);

    if (error) {
      throw error;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("images").getPublicUrl(filename);

    return { publicUrl, width, height };
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
    const base64Image = match[3];

    try {
      const { publicUrl, width, height } = await uploadImage(base64Image);

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

export const getPriorityLabel = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "Low priority";
  } else if (priorityScore < 70) {
    return "Medium priority";
  } else if (priorityScore < 95) {
    return "High priority";
  }

  return "Critical priority";
};

export const getPriorityColor = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "blue";
  } else if (priorityScore < 70) {
    return "green";
  } else if (priorityScore < 95) {
    return "orange";
  }

  return "red";
};

export const getOverlayWidgetCodeSnippet = ({
  orgId,
  orgSubdomain,
}: {
  orgId: string;
  orgSubdomain: string;
}) => {
  const isSelfHosted = getIsSelfHosted();

  if (isSelfHosted) {
    const vercelUrl = getVercelUrl();

    const url = vercelUrl
      ? `${vercelUrl}/${orgSubdomain}`
      : `http://localhost:${process.env.PORT ?? 3000}/${orgSubdomain}`;

    return `import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="${orgId}" // your platform's ID
  url="${url}" your platform's URL
  mode="light" // the color mode of the widget, 'light' or 'dark'
  button={<button>Feedback</button>} // bring your own button, or a button from your favorite component library
/>`;
  }

  return `import { FeedbackButton } from 'feedbackland-react';

<FeedbackButton
  platformId="${orgId}" // your platform's ID
  mode="light" // the color mode of the widget, 'light' or 'dark'
  button={<button>Feedback</button>} // bring your own button, or a button from your favorite component library
/>`;
};
