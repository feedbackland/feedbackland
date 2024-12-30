export const getSubdomain = () => {
  return window?.location?.hostname?.split(".")?.[0];
};
