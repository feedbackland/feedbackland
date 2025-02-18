import { getBaseDomainFromUrl, triggers } from "@/lib/utils";

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

  if (context === triggers.claimOrg) {
    url.searchParams.set(triggers.claimOrg, "true");
  }

  return url.toString();
};
