import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

export const AdminInviteEmail = ({
  invitedByUsername = "A Feedbackland Team Member",
  inviteLink,
  feedbacklandUrl,
}: {
  invitedByUsername?: string;
  inviteLink: string;
  feedbacklandUrl: string;
}) => {
  const previewText = `Join ${invitedByUsername} on Feedbackland as an Admin`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-offwhite mx-auto my-auto font-sans text-base text-gray-700">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-lg border border-solid border-gray-200 bg-white p-[20px] shadow-md">
            {/* Logo Section */}
            <Section className="mt-[32px] text-center">
              <Img
                src={`https://public.${process.env.VERCEL_URL}/feedbackland_logo_email.png`}
                width="170"
                height="20"
                alt="Feedbackland Logo"
                className="mx-auto my-0 rounded-md"
              />
            </Section>

            {/* Heading */}
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              You&apos;re Invited to be an Admin on{" "}
              <strong>Feedbackland</strong>!
            </Heading>

            {/* User Greeting */}
            <Text className="text-[14px] leading-[24px] text-black">Hi,</Text>

            {/* Main Invitation Text */}
            <Text className="text-[14px] leading-[24px] text-black">
              You&apos;ve been invited to join Feedbackland as an administrator!
              This role grants you special permissions to manage and analyze
              platform feedback, and to comment on feedback with a
              &apos;Admin&apos; label.
            </Text>

            {/* Call to Action Button */}
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="bg-brand hover:bg-opacity-90 rounded-md px-5 py-3 text-center text-[14px] font-semibold text-white no-underline shadow-sm"
                href={inviteLink}
              >
                Accept Invitation & Join
              </Button>
            </Section>

            {/* Link Fallback */}
            <Text className="text-[14px] leading-[24px] text-black">
              Or copy and paste this URL into your browser:
              <Link href={inviteLink} className="text-brand ml-1 no-underline">
                {inviteLink}
              </Link>
            </Text>

            <Text className="mt-[20px] text-[12px] leading-[20px] text-gray-500">
              If you weren&apos;t expecting this invitation, you can safely
              ignore this email.
            </Text>

            {/* Footer */}
            <Section className="mt-[32px] border-t border-solid border-gray-200 pt-[20px] text-center">
              <Text className="text-[12px] text-gray-500">
                © {new Date().getFullYear()} Feedbackland. All rights reserved.
              </Text>
              <Link
                href={feedbacklandUrl}
                className="text-brand text-[12px] no-underline"
              >
                Visit Feedbackland.com
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AdminInviteEmail;
