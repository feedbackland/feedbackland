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
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

export const ResetPasswordEmail = ({ url }: { url: string }) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="m-auto bg-slate-100 px-2 py-10 font-sans">
          <Preview>Reset password</Preview>
          <Container className="mx-auto my-[40px] max-w-[465px] rounded-[6px] border border-solid border-[#eaeaea] bg-white p-[20px]">
            <Section className="mt-[32px]">
              <Img
                src={`https://public.${process.env.VERCEL_PROJECT_PRODUCTION_URL}/feedbackland_logo_email.png`}
                width="170"
                height="20"
                alt="Feedbackland"
                className="mx-auto my-0"
              />
            </Section>
            <Heading className="mx-0 my-[30px] p-0 text-center text-[24px] font-normal text-black">
              Reset your password
            </Heading>
            <Text className="text-[14px] leading-[24px] text-black">
              Hello,
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              Lost your password? We&apos;ve received a request to reset the
              password for your account.
            </Text>
            <Text className="text-[14px] leading-[24px] text-black">
              To reset your password, click on the button below:
            </Text>
            <Section className="my-[32px] text-center">
              <Button
                className="rounded bg-[#000000] px-5 py-3 text-center text-[12px] font-semibold text-white no-underline"
                href={url}
              >
                Reset password
              </Button>
            </Section>
            <Text className="text-[14px] leading-[24px] text-black">
              or copy and paste this URL into your browser:{" "}
              <Link href={url} className="text-blue-600 no-underline">
                {url}
              </Link>
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
