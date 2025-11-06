import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";
import * as React from "react";

export const AdminInviteEmail = ({
  inviteLink,
}: {
  invitedBy: string;
  inviteLink: string;
}) => {
  return (
    <Tailwind>
      <Html lang="en">
        <Head />
        <Body className="bg-gray-50 p-6 font-sans">
          <Container className="mx-auto max-w-xl rounded-md border border-solid border-gray-300 bg-white p-6 shadow-xs">
            {/* Logo Section */}
            <Section className="mb-3 pt-2 text-center">
              <Img
                src="https://zfk6n7wmgpfhtlwc.public.blob.vercel-storage.com/feedbackland_logo_email.jpg"
                width="190"
                height="42"
                alt="Feedbackland logo"
                className="mx-auto"
              />
            </Section>

            {/* Heading */}
            <Heading className="mb-6 text-center text-2xl font-bold text-black">
              You&apos;re invited to be an Admin
            </Heading>

            {/* User Greeting */}
            <Text className="text-sm text-black">Hi,</Text>

            {/* Main Invitation Text */}
            <Text className="mb-6 text-sm text-black">
              You&apos;re invited to join a Feedbackland platform as an
              administrator.
            </Text>

            {/* Call to Action Button */}
            <Section className="mb-6 text-center">
              <Button
                className="hover:bg-opacity-80 rounded-md bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                href={inviteLink}
              >
                Accept Invitation
              </Button>
            </Section>

            {/* Link Fallback */}
            <Text className="mb-6 text-sm text-black">
              Or copy and paste this URL into your browser:
              <Link href={inviteLink} className="text-brand ml-1 no-underline">
                {inviteLink}
              </Link>
            </Text>

            <Text className="mb-6 text-sm text-black">
              If you weren&apos;t expecting this invitation, you can safely
              ignore this email.
            </Text>

            {/* Footer */}
            <Section className="border-t border-solid border-gray-200 pt-[20px] text-center">
              <Link
                href={`https://feedbackland.com`}
                className="text-brand text-[12px] no-underline"
              >
                Visit feedbackland.com
              </Link>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

export default AdminInviteEmail;
