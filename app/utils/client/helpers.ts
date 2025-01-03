export const getSubdomain = () => {
  return window?.location?.hostname?.split(".")?.[0];
};

export const getDomainInfo = () => {
  // Get full hostname (e.g., "app.example.com" or "localhost:3000")
  const hostname = window.location.hostname;

  // Handle localhost
  if (hostname === "localhost" || /^([0-9.]+)$/.test(hostname)) {
    return {
      subdomain: null,
      domain: hostname,
    };
  }

  // Split hostname into parts
  const parts = hostname.split(".");

  // For hostnames like "app.example.com"
  if (parts.length > 2) {
    return {
      subdomain: parts[0],
      domain: parts.slice(1).join("."),
    };
  }

  // For hostnames like "example.com"
  return {
    subdomain: null,
    domain: hostname,
  };
};

export const navigateToSubdomain = (subdomain: string) => {
  const currentUrl = window.location;
  const newUrl = `${currentUrl.protocol}//${subdomain}.${currentUrl.hostname}${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
  window.location.href = newUrl; // This changes the subdomain and reloads the page
};
