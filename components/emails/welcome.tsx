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
  Section,
  Text,
  Tailwind,
} from "@react-email/components";

export const WelcomeEmail = ({
  orgId,
  overlayWidgetCodeSnippet,
}: {
  orgId: string;
  overlayWidgetCodeSnippet: string;
}) => {
  return (
    <Tailwind>
      <Html lang="en">
        <Head>
          <title>Your feedback platform is ready</title>
        </Head>
        <Body className="bg-gray-100 p-6 font-sans">
          <Container className="mx-auto max-w-xl border border-solid border-gray-300 bg-white p-6 shadow-md">
            <Section className="mb-5 pt-2 text-center">
              <Img
                src="https://public.feedbackland.com/feedbackland_logo.png"
                width="192"
                height="25"
                alt="Feedbackland logo"
                className="mx-auto"
              />
            </Section>

            <Section className="">
              <Text className="mb-6 text-center text-2xl font-bold text-black">
                Your feedback platform is ready!
              </Text>

              <Text className="mb-6 text-base text-black">
                Congratulations! Your Feedbackland platform is all set up and
                ready to start collecting feedback.
              </Text>

              <Section className="text-center">
                <Button
                  href={`https://${orgId}.feedbackland.com`}
                  className="hover:bg-opacity-80 mx-auto rounded-sm bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                >
                  Access Your Platform
                </Button>
              </Section>
            </Section>

            <Hr className="my-5" />

            <Section className="">
              <Text className="mb-6 text-base text-black">
                If you haven't done so already, go ahead and add it to your app:
              </Text>

              <Text className="mb-2 text-sm text-black">
                Step 1: Install the package
              </Text>
              <pre className="bg-black p-3 text-sm text-white">
                <code>npm i feedbackland-react</code>
              </pre>

              <Text className="mb-2 text-sm text-black">
                Step 2: Paste the snippet into your codebase
              </Text>
              <pre className="bg-black p-3 text-sm text-white">
                <code>{overlayWidgetCodeSnippet}</code>
              </pre>
            </Section>

            <Hr className="my-5" />

            <Section className="">
              <Text className="mb-6 text-base text-black">
                If you have any questions or need help getting started, don't
                hesitate to reach out to us directly at{" "}
                <Link
                  href="mailto:hello@feedbackland.com"
                  className="text-black underline"
                >
                  hello@feedbackland.com
                </Link>
              </Text>

              <Text className="mb-6 text-base text-black">
                Happy feedback collecting!
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
