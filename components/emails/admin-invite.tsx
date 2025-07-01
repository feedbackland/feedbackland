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
    <Html>
      <Head />
      <Tailwind>
        <Body className="mx-auto my-auto bg-white font-sans text-base text-gray-700">
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-lg border border-solid border-gray-200 bg-white p-[20px] shadow-md">
            {/* Logo Section */}
            <Section className="mt-[32px] text-center">
              <Img
                src="https://public.feedbackland.com/feedbackland_logo.jpg"
                width="182"
                height="24"
                alt="Feedbackland logo"
                className="mx-auto my-0"
              />
            </Section>

            {/* Heading */}
            <Heading className="mx-0 my-[30px] p-0 text-center text-[18px] leading-[28px] font-normal text-black">
              You&apos;re Invited to be an Admin
            </Heading>

            {/* User Greeting */}
            <Text className="text-[14px] leading-[24px] text-black">Hi,</Text>

            {/* Main Invitation Text */}
            <Text className="text-[14px] leading-[24px] text-black">
              You&apos;ve been invited to join a Feedbackland platform as an
              administrator! This role grants you special permissions to manage
              and analyze platform feedback, and generate roadmaps.
            </Text>

            {/* Call to Action Button */}
            <Section className="mt-[32px] mb-[32px] text-center">
              <Button
                className="hover:bg-opacity-80 rounded-sm bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                href={inviteLink}
              >
                Accept Invitation
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
              <Link
                href={`https://feedbackland.com`}
                className="text-brand text-[12px] no-underline"
              >
                Visit feedbackland.com
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default AdminInviteEmail;
