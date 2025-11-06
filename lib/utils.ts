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

    return `import { FeedbackButton } from "feedbackland-react";

export function WidgetDemo() {
  return (
    <FeedbackButton
      platformId="${orgId}" // your platform ID
      url="${url}" your platform URL
    >
      Feedback
    </FeedbackButton>
  );
}`;
  }

  return `import { FeedbackButton } from "feedbackland-react";

export function WidgetDemo() {
  return (
    <FeedbackButton platformId="${orgId}">
      Feedback
    </FeedbackButton>
  );
}`;
};
