export default async function handler(req, res) {
  try {
    // 0) Healthcheck (útil en navegador)
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, msg: "takeapp-to-tookan alive" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    // 1) Env vars
    const apiKey = process.env.TOOKAN_API_KEY;
    const mapRaw = process.env.MERCHANT_MAP;
    if (!apiKey) {
      return res.status(500).json({ ok: false, error: "Falta TOOKAN_API_KEY en Vercel" });
    }
    if (!mapRaw) {
      return res.status(500).json({ ok: false, error: "Falta MERCHANT_MAP en Vercel" });
    }

    let merchantMap;
    try {
      merchantMap = JSON.parse(mapRaw);
    } catch (e) {
      return res.status(500).json({ ok: false, error: "MERCHANT_MAP no es JSON válido" });
    }

    // 2) Body esperado
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

    // Validaciones mínimas
    if (!order_id)   return res.status(400).json({ ok:false, error:"Falta order_id" });
    if (!store_name) return res.status(400).json({ ok:false, error:"Falta store_name" });
    if (!customer_address) return res.status(400).json({ ok:false, error:"Falta customer_address" });

    // 3) Merchant ID por store_name EXACTO
    const merchantId = merchantMap[store_name];
    if (!merchantId) {
      return res.status(400).json({
        ok: false,
        error: `No hay Merchant ID para '${store_name}'. Revisa MERCHANT_MAP y que coincida EXACTO.`
      });
    }

    // 4) Horario de entrega (Tookan a veces lo exige)
    //    ahora +15 minutos, formato 'YYYY-MM-DD HH:mm:ss'
    const dt = new Date(Date.now() + 15 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");

    // 5) Construir payload Tookan (entrega simple)
    const tookanPayload = {
      api_key: apiKey,
      order_id: String(order_id),
      job_description: `Pedido TakeApp ${order_id}`,
      customer_username: customer_name || "Cliente",
      customer_phone: customer_phone || "",
      customer_email: customer_email || "",
      customer_address: customer_address,
      latitude: customer_lat || "",
      longitude: customer_lng || "",
      job_delivery_datetime: dt,
      timezone: "-06:00",
      has_pickup: 0,              // 0 = solo entrega (drop-off)
      merchant_id: merchantId,
      tags: ["TakeApp", store_name],
      custom_field_template: items.length ? "Items" : "",
      meta_data: items.map((it) => ({
        label: it?.name || "Item",
        data: `${it?.quantity ?? 1} x ${it?.price ?? ""}`.trim()
      })),
      job_delivery_notes: notes || ""
    };

    // 6) Llamar a Tookan
    const resp = await fetch("https://api.tookanapp.com/v2/create_task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tookanPayload)
    });

    const data = await resp.json().catch(() => ({}));

    // Éxito en Tookan = status 200
    if (!data || data.status !== 200) {
      return res.status(502).json({
        ok: false,
        error: "Tookan rechazó la solicitud",
        detail: data || null,
        sent: tookanPayload // para depurar qué enviamos
      });
    }

    return res.status(200).json({ ok: true, tookan: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err?.message || "Error interno" });
  }
}
