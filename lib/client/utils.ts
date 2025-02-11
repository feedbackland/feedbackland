import { getRootDomain } from "@/lib/utils";

export const navigateToSubdomain = ({ subdomain }: { subdomain: string }) => {
  const { host, protocol } = window.location;
  const rootDomain = getRootDomain({ host });
  const isLocalhost = host.includes("localhost");

  if (rootDomain) {
    window.location.href = !isLocalhost
      ? `${protocol}//${subdomain}.${rootDomain}`
      : `${protocol}//${rootDomain}/${subdomain}`;
  }
};

export const getSSOCallbackUrl = ({ context }: { context?: string }) => {
  const url = new URL(window.location.href);

  if (context === "claim-org") {
    url.searchParams.set("org-claimed", "true");
  }

  return url.toString();
};
