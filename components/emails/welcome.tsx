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
          <title>Welcome to Feedbackland!</title>
        </Head>
        <Preview>Your feedback platform is ready.</Preview>
        <Body className="bg-gray-100 font-sans">
          <Container className="mx-auto my-10 max-w-xl rounded-lg bg-white py-5 pb-12 shadow-md">
            <Section className="px-6 py-8 sm:px-12">
              <Section className="mb-8 text-center">
                <Img
                  src="https://public.feedbackland.com/feedbackland_logo.jpg"
                  width="182"
                  height="24"
                  alt="Feedbackland logo"
                  className="mx-auto my-0"
                />
              </Section>
              <Text className="mb-6 text-center text-3xl font-bold text-gray-800">
                Welcome to Feedbackland!
              </Text>
              <Text className="text-base leading-relaxed text-black">
                Congratulations! Your feedback platform is all set up and ready
                for you to start collecting feedback and generating your
                roadmap.
              </Text>
              <Section className="my-8 text-center">
                <Button
                  href={`https://${orgId}.feedbackland.com`}
                  className="hover:bg-opacity-80 rounded-sm bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                >
                  Access Your Platform
                </Button>
              </Section>
              <Text className="text-base leading-relaxed text-black">
                If you haven't done so already, go ahead and add the widget to
                your app.
              </Text>
              <p>Step 1: Install the package</p>
              <pre>
                <code>npm i feedbackland-react</code>
              </pre>
              <p>Step 2: Paste the snippet into your codebase</p>
              <pre>
                <code>{overlayWidgetCodeSnippet}</code>
              </pre>
            </Section>

            <Hr className="my-6 border-t border-gray-300" />

            <Section className="px-6 py-6 sm:px-12">
              <Text className="text-base leading-relaxed text-black">
                Have feedback about Feedbackland? We'd love to hear it! Share
                your thoughts, suggestions, or report any issues on our feedback
                platform.
              </Text>
              <Section className="my-8 text-center">
                <Button
                  href={`https://feedback.feedbackland.com`}
                  className="hover:bg-opacity-80 rounded-sm bg-black px-5 py-3 text-center text-[14px] font-semibold text-white no-underline"
                >
                  Share Your Feedback
                </Button>
              </Section>
            </Section>

            <Hr className="my-6 border-t border-gray-300" />

            <Section className="px-6 pt-6 pb-12 sm:px-12">
              <Text className="text-base leading-relaxed text-black">
                If you have any questions, need help getting started, or just
                want to say hi, don't hesitate to reach out to us directly at{" "}
                <Link
                  href="mailto:hello@feedbackland.com"
                  className="text-black underline"
                >
                  hello@feedbackland.com
                </Link>
                .
              </Text>
              <Text className="mt-5 text-base leading-relaxed text-black">
                Happy feedback collecting!
              </Text>
              <Text className="mt-5 text-base leading-relaxed text-black">
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
