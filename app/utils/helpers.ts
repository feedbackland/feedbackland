// host: "new.localhost:3000";
// hostname: "new.localhost";
// href: "http://new.localhost:3000/";
// origin: "http://new.localhost:3000";
// pathname: "/";
// port: "3000";
// protocol: "http:";

export const getSubdomainFromHost = ({ host }: { host: string }) => {
  const parts = host.split(".");

  if (host.includes("localhost") && parts.length === 2) {
    return parts[0];
  }

  if (!host.includes("localhost") && parts.length === 3 && parts[0] !== "www") {
    return parts[0];
  }

  return null;
};

export const slugifySubdomain = (text: string) => {
  if (!text) {
    return ""; // Handle empty input
  }

  return text
    .toLowerCase()
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/[^\w.-]+/g, "") // Remove non-alphanumeric characters (except hyphens and periods initially)
    .replace(/\.+/g, "") // Remove all periods
    .replace(/--+/g, "-") // Replace multiple hyphens with single hyphen
    .replace(/^-+|-+$/g, "") // Remove leading/trailing hyphens
    .slice(0, 63); // Truncate to the maximum subdomain length (63 characters)
};
