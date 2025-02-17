import { getSubdomainFromUrl } from "@/lib/utils";

export const navigateToSubdomain = (subdomain: string) => {
  const { host, protocol } = window.location;
  const isLocalhost = host.includes("localhost");
  const url = isLocalhost
    ? `${protocol}//${host}/${subdomain}`
    : `${protocol}//${subdomain}.${host.replace(`${subdomain}.`, "")}`;
  window.location.href = url;
};

export const getSSOCallbackUrl = ({ context }: { context?: string }) => {
  const url = new URL(window.location.href);

  if (context === "claim-org") {
    url.searchParams.set("claim-org", "true");
  }

  return url.toString();
};

export const getSubdomain = () => {
  const subdomain = getSubdomainFromUrl(window.location.href);
  return subdomain;
};
