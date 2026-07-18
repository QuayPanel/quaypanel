import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function WelcomeEmail(props: { brandName: string; name: string }) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to {props.brandName}</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", background: "#f6f7f9" }}>
        <Container
          style={{
            background: "#ffffff",
            padding: "24px",
            margin: "24px auto",
            maxWidth: "560px",
          }}
        >
          <Heading as="h1">Welcome to {props.brandName}</Heading>
          <Text>Hi {props.name},</Text>
          <Text>
            Your account has been created. You can manage invoices, orders, and
            payments from your client area.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default WelcomeEmail;
