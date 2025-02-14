import {
  Tailwind,
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Link,
} from "@react-email/components";

export const PasswordResetEmail = ({ url }: { url: string }) => {
  return (
    <Html lang="en">
      <Head />
      <Tailwind>
        <Body className="bg-slate-200">
          <Container className="rounded-sm bg-white p-10 shadow-sm">
            <Heading as="h1">Reset password</Heading>
            <Text>Use the link below to reset your password</Text>
            <Link href={url}>Reset your password</Link>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};
