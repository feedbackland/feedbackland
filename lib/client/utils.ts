import { getBaseDomainFromUrl } from "@/lib/utils";

export const navigateToSubdomain = (subdomain: string) => {
  const { host, protocol, href } = window.location;
  const isLocalhost = host.includes("localhost");
  const baseDomain = getBaseDomainFromUrl(href);
  const url = isLocalhost
    ? `${protocol}//${host}/${subdomain}`
    : `${protocol}//${subdomain}.${baseDomain}`;
  window.location.href = url;
};

export const getSSOCallbackUrl = ({ context }: { context?: string }) => {
  const url = new URL(window.location.href);

  if (context === "claim-org") {
    url.searchParams.set("claim-org", "true");
  }

  return url.toString();
};
