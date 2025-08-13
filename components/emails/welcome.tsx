import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Html,
  Img,
  Link,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

export const WelcomeEmail = ({
  orgId,
  overlayWidgetCodeSnippet,
  platformUrl,
}: {
  orgId: string;
  overlayWidgetCodeSnippet: string;
  platformUrl: string;
}) => {
  return (
    <Tailwind>
      <Html lang="en">
        <Head>
          <title>Your feedback platform is ready</title>
        </Head>
        <Body className="bg-gray-50 p-6 font-sans">
          <Container className="mx-auto max-w-xl border border-solid border-gray-300 bg-white p-6 shadow-md">
            <Section className="mb-3 pt-2 text-center">
              <Img
                src="https://zfk6n7wmgpfhtlwc.public.blob.vercel-storage.com/feedbackland_logo_email.jpg"
                width="190"
                height="42"
                alt="Feedbackland logo"
                className="mx-auto"
              />
            </Section>

            <Section className="mb-5">
              <Text className="mb-6 text-center text-2xl font-bold text-black">
                Your feedback platform is ready!
              </Text>

              <Text className="mb-6 text-base text-black">
                Congratulations! Your platform is all set up and ready to start
                collecting feedback.
              </Text>

              <Section className="text-center">
                <Button
                  href={platformUrl}
                  className="hover:bg-opacity-80 mx-auto rounded-sm bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                >
                  Access Your Platform
                </Button>
              </Section>
            </Section>

            <Section className="mb-4">
              <Text className="mb-6 text-base text-black">
                If you haven't done so already, go ahead and add the widget to
                your app:
              </Text>

              <Text className="mb-2 text-sm text-black">
                Step 1: Install the package
              </Text>
              <pre className="bg-black px-2 py-2 text-xs text-white">
                <code>npm i feedbackland-react</code>
              </pre>

              <Text className="mb-2 text-sm text-black">
                Step 2: Paste the snippet into your codebase
              </Text>
              <pre className="bg-black p-3 text-xs text-white">
                <code>{overlayWidgetCodeSnippet}</code>
              </pre>
            </Section>

            <Section>
              <Text className="mb-5 text-base text-black">
                If you have any questions or need help getting started, don't
                hesitate to reach out to us directly at{" "}
                <Link
                  href={`mailto:${process.env.RESEND_EMAIL_SENDER}`}
                  className="text-black underline"
                >
                  {process.env.RESEND_EMAIL_SENDER}
                </Link>
              </Text>

              <Text className="text-base text-black">
                Best regards,
                <br />
                The Feedbackland Team
              </Text>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};
