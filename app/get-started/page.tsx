"use client";

import { CreateOrgCard } from "@/components/app/create-org/card";
import { FeedbacklandLogoFull } from "@/components/ui/logos";
import { useMaindomain } from "@/hooks/use-maindomain";

const navigateToSubdomain = ({
  subdomain,
  maindomain,
}: {
  subdomain: string | null | undefined;
  maindomain: string | null | undefined;
}) => {
  if (maindomain && subdomain) {
    const { protocol, port } = window.location;
    const isLocalhost = maindomain.includes("localhost");
    const url = isLocalhost
      ? `${protocol}//${maindomain}:${port}/${subdomain}`
      : `${protocol}//${subdomain}.${maindomain}`;
    window.location.href = url;
  }
};

export default function GetStartedPage() {
  const maindomain = useMaindomain();

  return (
    <div className="bg-muted/50 m-auto flex min-h-dvh w-dvw flex-col items-center pt-14">
      <FeedbacklandLogoFull className="mb-14 w-[165px]" />
      <CreateOrgCard
        onSuccess={({ orgSubdomain: subdomain }) => {
          navigateToSubdomain({ maindomain, subdomain });
        }}
      />
    </div>
  );
}
