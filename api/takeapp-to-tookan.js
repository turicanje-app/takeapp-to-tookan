export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json({ ok: true, msg: "takeapp-to-tookan alive" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const apiKey = process.env.TOOKAN_API_KEY;
    const mapRaw = process.env.MERCHANT_MAP;
    if (!apiKey) return res.status(500).json({ ok: false, error: "Falta TOOKAN_API_KEY" });
    if (!mapRaw) return res.status(500).json({ ok: false, error: "Falta MERCHANT_MAP" });

    let merchantMap;
    try { merchantMap = JSON.parse(mapRaw); } catch { return res.status(500).json({ ok:false,error:"MERCHANT_MAP no es JSON válido"}); }

    const {
      order_id, store_name, customer_name, customer_phone,
      customer_email, customer_address, customer_lat, customer_lng,
      notes, items = [], pickup_address, pickup_name, pickup_phone,
      pickup_lat, pickup_lng
    } = req.body || {};

    if (!order_id) return res.status(400).json({ ok:false,error:"Falta order_id" });
    if (!store_name) return res.status(400).json({ ok:false,error:"Falta store_name" });
    if (!customer_address) return res.status(400).json({ ok:false,error:"Falta customer_address" });

    const merchantId = merchantMap[store_name];
    if (!merchantId) return res.status(400).json({ ok:false,error:`No hay Merchant ID para '${store_name}'`});

    const dtDeliver
