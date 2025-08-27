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

    const dtDelivery = new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0,19).replace("T"," ");
    const dtPickup = new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0,19).replace("T"," ");

    const hasPickup = pickup_address ? 1 : 0;

    const tookanPayload = {
      api_key: apiKey,
      order_id: String(order_id),
      job_description: `Pedido TakeApp ${order_id}`,
      customer_username: customer_name || "Cliente",
      customer_phone: customer_phone || "",
      customer_email: customer_email || "",
      customer_address,
      latitude: customer_lat || "",
      longitude: customer_lng || "",
      job_delivery_datetime: dtDelivery,
      job_pickup_datetime: hasPickup ? dtPickup : "",
      timezone: "America/Mexico_City",
      merchant_id: merchantId,
      tags: ["TakeApp", store_name],
      custom_field_template: items.length ? "Items" : "",
      meta_data: items.map(it => ({ label: it?.name||"Item", data: `${it?.quantity??1} x ${it?.price??""}` })),
      job_delivery_notes: notes || "",
      has_pickup: hasPickup,
      has_delivery: 1,
      layout_type: 0,
      auto_assignment: 0
    };

    if (hasPickup) {
      tookanPayload.pickup_address = pickup_address;
      tookanPayload.pickup_name = pickup_name || store_name;
      tookanPayload.pickup_phone = pickup_phone || "";
      tookanPayload.pickup_latitude = pickup_lat || "";
      tookanPayload.pickup_longitude = pickup_lng || "";
    }

    const resp = await fetch("https://api.tookanapp.com/v2/create_task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(tookanPayload)
    });
    const data = await resp.json().catch(()=>({}));

    if (!data || data.status !== 200) {
      return res.status(502).json({ ok:false,error:"Tookan rechazó la solicitud",detail:data,sent:tookanPayload});
    }

    return res.status(200).json({ ok:true,tookan:data });
  } catch (err) {
    return res.status(500).json({ ok:false,error:err.message});
  }
}
