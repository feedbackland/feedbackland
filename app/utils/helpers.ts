// host: "new.localhost:3000";
// hostname: "new.localhost";
// href: "http://new.localhost:3000/";
// origin: "http://new.localhost:3000";
// pathname: "/";
// port: "3000";
// protocol: "http:";

export const getRootDomain = ({
  host,
}: {
  host: string | null | undefined;
}) => {
  if (host && host.length > 0) {
    const parts = host.split(".");

    if (host.includes("localhost")) {
      // e.g. 'localhost:3000' or 'new.localhost:3000'
      return parts[parts.length - 1]; // e.g. 'localhost:3000'
    } else if (parts.length > 1) {
      // e.g. 'feedbackland.com' or 'new.feedbackland.com'
      const tld = parts[parts.length - 1]; // e.g. 'com'
      const root = parts[parts.length - 2]; // e.g. 'feedbackland'
      return `${root}.${tld}`; // feedbackland.com
    }
  }

  return null;
};

export const subdomainRegex = /^(?!.*\.)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

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
