import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

export function InvoiceEmail(props: {
  brandName: string;
  clientName: string;
  invoiceNumber: string;
  total: string;
  currency: string;
}) {
  return (
    <Html>
      <Head />
      <Preview>
        Invoice {props.invoiceNumber} from {props.brandName}
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
            Invoice <strong>{props.invoiceNumber}</strong> is ready for payment.
          </Text>
          <Text>
            Amount due: <strong>{props.total}</strong> ({props.currency})
          </Text>
          <Text>Log in to your client area to pay securely.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export default InvoiceEmail;
