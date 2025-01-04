export const getSubdomain = () => {
  if (typeof window !== "undefined") {
    const hostParts = window?.location?.hostname?.split(".");
    const subdomain = hostParts.length > 2 ? hostParts[0] : null;
    return subdomain;
  }

  return null;
};

export const navigateToSubdomain = ({
  currentSubdomain,
  newSubdomain,
}: {
  currentSubdomain: string | null;
  newSubdomain: string;
}) => {
  if (typeof window !== "undefined") {
    if (currentSubdomain && currentSubdomain.length > 0) {
      window.location.href = window.location.origin.replace(
        currentSubdomain,
        newSubdomain
      );
    } else {
      window.location.href = `${window.location.protocol}//${newSubdomain}.${window.location.host}`;
    }
  }
};
