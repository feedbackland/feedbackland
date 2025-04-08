import OrgLayoutInner from "./layout-inner";

export default async function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OrgLayoutInner>{children}</OrgLayoutInner>;
}
