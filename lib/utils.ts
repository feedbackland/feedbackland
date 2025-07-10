import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { v4 as uuidv4 } from "uuid";
import { convert } from "html-to-text";
import sanitizeHtml from "sanitize-html";
import imageSize from "image-size";
import { validate as uuidValidate, version as uuidVersion } from "uuid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export const reservedSubdomains = [
  "feedback",
  "new",
  "auth",
  "public",
  "static",
  "get-started",
];

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

export const getIsLocalHost = (urlString?: string | null) => {
  const url = getUrlObject(urlString);
  if (!url) return false;
  const { host } = url;
  return host?.includes("localhost") || host?.includes("vercel.app");
};

export const getSubdomain = (urlString?: string | null) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { hostname, pathname } = url;

  const isLocalHost = getIsLocalHost(urlString);

  if (isLocalHost) {
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

  const isLocalHost = getIsLocalHost(urlString);

  if (isLocalHost) return host;

  const parts = hostname.split(".");

  return parts.length > 1 ? parts.slice(-2).join(".") : hostname;
};

export const getPlatformUrl = (urlString?: string) => {
  const url = getUrlObject(urlString);

  if (!url) return null;

  const { pathname, protocol, hostname, host } = url;

  const isLocalHost = getIsLocalHost(urlString);

  if (!isLocalHost) return `${protocol}//${hostname}`;

  const parts = pathname.split("/");

  const orgName = parts?.[1];

  return `${protocol}//${host}${orgName ? `/${orgName}` : ""}`;
};

export const navigateToSubdomain = ({ subdomain }: { subdomain: string }) => {
  if (subdomain) {
    const { protocol } = window.location;
    const isLocalhost = getIsLocalHost();
    const maindomain = getMaindomain();
    const url = isLocalhost
      ? `${protocol}//${maindomain}/${subdomain}`
      : `${protocol}//${subdomain}.${maindomain}`;
    window.location.href = url;
  }
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

  let modifiedHTML = html; // Start with original HTML

  const matches = Array.from(html.matchAll(base64Regex));

  // Create an array of promises, one for each image processing task
  const processingPromises = matches.map(async (match) => {
    const fullMatch = match[0];
    const imageType = match[2];
    const base64Data = match[3];

    try {
      // Decode base64 to buffer for image-size
      const imageBuffer = Buffer.from(base64Data, "base64");

      const { width, height } = imageSize(imageBuffer); // Get dimensions

      const blob = base64ToBlob({
        base64: base64Data,
        contentType: `image/${imageType}`,
      });

      const filename = `image-${uuidv4()}.${imageType}`;

      // Upload to Supabase
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(filename, blob);

      if (uploadError) {
        throw uploadError; // Propagate upload error
      }

      // Get public URL
      // Using 'as any' as a workaround for persistent TS error where 'error' property is not recognized on the type.
      const {
        data: { publicUrl },
      } = supabase.storage.from("images").getPublicUrl(filename);

      if (!publicUrl) {
        throw new Error("Failed to get public URL for uploaded image.");
      }

      // Return the original match and the replacement string
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

      // Return null or the original match if processing fails for this image
      return { original: fullMatch, replacement: fullMatch }; // Keep original if error
    }
  });

  // Wait for all image processing tasks to complete
  const results = await Promise.all(processingPromises);

  // Perform replacements after all promises are resolved
  results.forEach((result) => {
    if (result) {
      // Ensure result is not null/undefined from potential errors handled above
      modifiedHTML = modifiedHTML.replace(result.original, result.replacement);
    }
  });

  return modifiedHTML; // Return the final modified HTML
};

export const clean = (htmlString: string) => {
  return sanitizeHtml(htmlString, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "a", "span"]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      span: ["data-type", "data-id", "data-label"],
      img: ["src", "width", "height", "alt"],
    },
    allowedClasses: {
      span: ["mention"],
    },
  });
};

export const getPlainText = (htmlString: string) => {
  const plainText = convert(sanitizeHtml(htmlString), {
    wordwrap: false,
    selectors: [
      { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
      { selector: "table", format: "inline" },
    ],
  })
    .replace(/\s+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();

  return plainText;
};

export const getPriorityLabel = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "Low priority";
  } else if (priorityScore < 70) {
    return "Medium priority";
  } else if (priorityScore < 95) {
    return "High priority";
  } else {
    return "Critical priority";
  }
};

export const getPriorityColor = (priorityScore: number) => {
  if (priorityScore < 40) {
    return "blue";
  } else if (priorityScore < 70) {
    return "green";
  } else if (priorityScore < 95) {
    return "orange";
  } else {
    return "red";
  }
};

export const getOverlayWidgetCodeSnippet = ({
  orgId,
}: {
  orgId: string;
}) => `import { OverlayWidget } from "feedbackland-react";

function FeedbackButton() {
  return (
    <OverlayWidget
      id="${orgId}"
      mode="dark" // light or dark, defaults to dark
    >
      <button>Feedback</button> {/*bring your own button */}
    </OverlayWidget>
  );
}`;

export const roadmapLimit = (plan: string) => {
  if (plan === "free") {
    return 5;
  } else if (plan === "pro") {
    return 20;
  } else if (plan === "max") {
    return 100;
  }

  return 5;
};

export const adminLimit = (plan: string) => {
  if (plan === "free") {
    return 2;
  } else if (plan === "pro") {
    return 5;
  } else if (plan === "max") {
    return undefined;
  }

  return 2;
};

export const analyzablePostLimit = (plan: string) => {
  if (plan === "free") {
    return 100;
  } else if (plan === "pro") {
    return 1000;
  } else if (plan === "max") {
    return 10000;
  }

  return 100;
};
