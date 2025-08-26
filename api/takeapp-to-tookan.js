export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // 1. Captura datos del body (ajusta según TakeApp)
    const {
      order_id,
      store_name,
      customer_name,
      customer_phone,
      customer_email,
      customer_address,
      customer_lat,
      customer_lng,
      notes,
      items = []
    } = req.body || {};

    if (!order_id || !store_name || !customer_address) {
      return res.status(400).json({ ok: false, error: "Faltan datos mínimos" });
    }

    // 2. Merchant map desde variables de entorno
    const ENV_MAP = process.env.MERCHANT_MAP ? JSON.parse(process.env.MERCHANT_MAP) : {};
    const merchantId = ENV_MAP[store_name];
    if (!merchantId) {
      return res.status(400).json({ ok: false, error: `No hay Merchant ID para ${store_name}` });
    }

    // 3. Payload para Tookan API
    const tookanPayload = {
      api_key: process.env.TOOKAN_API_KEY,
      order_id: String(order_id),
      job_description: `Pedido TakeApp ${order_id}`,
      customer_username: customer_name || "Cliente",
      customer_phone: customer_phone || "",
      customer_email: customer_email || "",
      customer_address: customer_address,
      latitude: customer_lat || "",
      longitude: customer_lng || "",
      job_delivery_datetime: "",
      timezone: "-06:00",
      has_pickup: 0,
      merchant_id: merchantId,
      tags: ["TakeApp", store_name],
      custom_field_template: items.length ? "Items" : "",
      meta_data: items.map((it) => ({
        label: it.name || "Item",
        data: `${it.quantity || 1} x ${it.price || ""}`.trim()
      })),
      job_delivery_notes: notes || ""
    };

    // 4. Llamada a Tookan
    const resp = await fetch("https://api.tookanapp.com/v2/create_task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tookanPayload)
    });
    const data = await resp.json();

    if (!data || data.status !== 200) {
      return res.status(502).json({ ok: false, error: "Error desde Tookan", detail: data });
    }

    return res.status(200).json({ ok: true, tookan: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
