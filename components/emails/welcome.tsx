import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

export const WelcomeEmail = ({ orgId }: { orgId: string }) => {
  const previewText = `Welcome to Feedbackland! Your new feedback platform is ready.`;

  return (
    <Tailwind>
      <Html lang="en">
        <Head>
          <title>Welcome to Feedbackland!</title>
        </Head>
        <Preview>{previewText}</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-10 max-w-xl rounded-lg bg-white py-5 pb-12 shadow-md">
            <Section className="px-6 py-8 sm:px-12">
              <Section className="mb-8 text-center">
                <Img
                  src="https://public.feedbackland.com/feedbackland_logo_email.png"
                  width="170"
                  height="20"
                  alt="Feedbackland logo"
                  className="mx-auto my-0"
                />
              </Section>
              <Text className="mb-6 text-center text-3xl font-bold text-gray-800">
                Welcome to Feedbackland!
              </Text>
              <Text className="text-base leading-relaxed text-gray-600">
                Congratulations! Your feedback platform is all set up and ready
                for you to start collecting feedback.
              </Text>
              <Section className="my-8 text-center">
                <Button
                  href={`https://${orgId}.feedbackland.com`}
                  className="rounded-lg bg-blue-600 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700"
                >
                  Access Your Platform
                </Button>
              </Section>
              <Text className="text-base leading-relaxed text-gray-600">
                You can start collecting feedback right away. If you're
                wondering where to begin, consider adding the widget to your
                app.
              </Text>
            </Section>

            <Hr className="my-6 border-t border-gray-300" />

            <Section className="px-6 py-6 sm:px-12">
              <Text className="text-base leading-relaxed text-gray-600">
                Your feedback is invaluable. Please feel free to share your
                thoughts, suggestions, or any issues you encounter on our own
                feedback platform:
              </Text>
              <Section className="my-8 text-center">
                <Button
                  href={`https://feedback.feedbackland.com`}
                  className="rounded-lg bg-green-500 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-green-600"
                >
                  Give Feedback on Feedbackland
                </Button>
              </Section>
            </Section>

            <Hr className="my-6 border-t border-gray-300" />

            <Section className="px-6 pt-6 pb-12 sm:px-12">
              <Text className="text-base leading-relaxed text-gray-600">
                If you have any questions, need help getting started, or just
                want to say hi, don't hesitate to reach out to us directly at{" "}
                <Link
                  href="mailto:hello@feedbackland.com"
                  className="text-blue-600 underline hover:text-blue-700"
                >
                  hello@feedbackland.com
                </Link>
                .
              </Text>
              <Text className="mt-5 text-base leading-relaxed text-gray-600">
                Happy feedback collecting!
              </Text>
              <Text className="mt-5 text-base leading-relaxed text-gray-600">
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
