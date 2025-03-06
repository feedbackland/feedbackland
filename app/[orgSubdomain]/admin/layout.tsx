export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div>{children}</div>;

  // if (isAdmin) {
  //   return <div>{children}</div>;
  // } else {
  //   const platformUrl = await getPlatformUrl();
  //   redirect(platformUrl);
  // }
}
