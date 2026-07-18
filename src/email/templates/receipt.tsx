import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function ReceiptEmail(props: {
  brandName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>
        Payment received for {props.invoiceNumber}
      </Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", background: "#f6f7f9" }}>
        <Container
          style={{
            background: "#ffffff",
            padding: "24px",
            margin: "24px auto",
            maxWidth: "560px",
          }}
        >
          <Heading as="h1">{props.brandName}</Heading>
          <Text>Hi {props.clientName},</Text>
          <Text>
            We received your payment for invoice{" "}
            <strong>{props.invoiceNumber}</strong>.
          </Text>
          <Text>
            Amount paid: <strong>{props.total}</strong>
          </Text>
          <Text>Thank you for your business.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default ReceiptEmail;
