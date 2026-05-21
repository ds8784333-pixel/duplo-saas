// Helper Mercado Pago — cobrança Pix.
// Docs: https://www.mercadopago.com.br/developers/pt/reference/payments/_payments/post
const MP_API = "https://api.mercadopago.com";

function token() {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error("MP_ACCESS_TOKEN não configurado");
  return t;
}

export type MpPixResult = {
  id: number;
  status: string;
  qrCodeBase64: string;
  copiaECola: string;
  ticketUrl?: string;
  expiresAt?: string;
};

export async function createPixPayment(params: {
  amount: number;
  description: string;
  payerEmail: string;
  payerName?: string;
  externalReference: string;
  notificationUrl?: string;
}): Promise<MpPixResult> {
  const body = {
    transaction_amount: Number(params.amount.toFixed(2)),
    description: params.description,
    payment_method_id: "pix",
    external_reference: params.externalReference,
    ...(params.notificationUrl ? { notification_url: params.notificationUrl } : {}),
    payer: {
      email: params.payerEmail,
      first_name: params.payerName?.split(" ")[0] || "Cliente",
    },
  };

  const r = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": params.externalReference,
    },
    body: JSON.stringify(body),
  });

  const data = await r.json();
  if (!r.ok) {
    throw new Error(`MP error ${r.status}: ${data?.message || JSON.stringify(data)}`);
  }

  const tx = data.point_of_interaction?.transaction_data;
  if (!tx?.qr_code_base64 || !tx?.qr_code) {
    throw new Error("MP não retornou QR Code");
  }

  return {
    id: data.id,
    status: data.status,
    qrCodeBase64: tx.qr_code_base64,
    copiaECola: tx.qr_code,
    ticketUrl: tx.ticket_url,
    expiresAt: data.date_of_expiration,
  };
}

export async function getPayment(id: string | number) {
  const r = await fetch(`${MP_API}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`MP get payment ${r.status}`);
  return r.json();
}
