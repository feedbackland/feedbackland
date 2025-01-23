import { getRootDomain } from "@/lib/utils";

export const navigateToSubdomain = ({ subdomain }: { subdomain: string }) => {
  const rootDomain = getRootDomain({ host: window.location.host });

  if (rootDomain) {
    window.location.href = `${window.location.protocol}//${subdomain}.${rootDomain}`;
  }
};
