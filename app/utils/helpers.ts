export const getOrgFromUrl = () => {
  return window?.location?.host?.split(".")?.[0];
};
