function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function rowsToCSV(rows) {
  const columns = ["vendor","warehouse","product_name","catalog_name","strength","quantity","unit","price_usd","currency","min_order","notes"];
  const lines = [columns.join(",")];
  for (const r of rows || []) lines.push(columns.map(c => csvEscape(r[c])).join(","));
  return lines.join("\n");
}
exports.handler = async function(event) {
  const headers = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"Content-Type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ ok:false, error:"Method not allowed" }) };
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ ok:false, error:"Missing OPENAI_API_KEY environment variable." }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:"Invalid JSON request body." }) }; }

  const vendor = String(body.vendor || "").trim();
  const warehouse = String(body.warehouse || "China").trim();
  const sourceFileName = String(body.source_file_name || body.image_file_name || "[unknown source]").trim();
  const priceListText = String(body.price_list_text || "").trim();
  const imageDataUrl = String(body.image_data_url || "").trim();

  if (!vendor) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:"Missing vendor." }) };
  if (!priceListText && !imageDataUrl) return { statusCode: 400, headers, body: JSON.stringify({ ok:false, error:"Missing price list text or image." }) };

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const schema = {
    type:"object",
    additionalProperties:false,
    properties:{
      rows:{
        type:"array",
        items:{
          type:"object",
          additionalProperties:false,
          properties:{
            vendor:{type:"string"},
            warehouse:{type:"string", enum:["US","China","Unknown"]},
            product_name:{type:"string"},
            catalog_name:{type:"string"},
            strength:{anyOf:[{type:"number"},{type:"string"}]},
            quantity:{type:"string"},
            unit:{type:"string"},
            price_usd:{anyOf:[{type:"number"},{type:"string"}]},
            currency:{type:"string"},
            min_order:{type:"string"},
            notes:{type:"string"}
          },
          required:["vendor","warehouse","product_name","catalog_name","strength","quantity","unit","price_usd","currency","min_order","notes"]
        }
      }
    },
    required:["rows"]
  };

  const instructions = [
    "Normalize this vendor peptide price list for TrackMyPeps.",
    "Return rows matching the JSON schema only.",
    "",
    "CRITICAL VENDOR RULE:",
    "Use this Vendor value EXACTLY in every row: " + vendor,
    "Use this Warehouse value EXACTLY in every row: " + warehouse,
    "Source file name: " + sourceFileName,
    "",
    "Required columns:",
    "vendor,warehouse,product_name,catalog_name,strength,quantity,unit,price_usd,currency,min_order,notes",
    "",
    "Rules:",
    "- Warehouse must be US, China, or Unknown.",
    "- price_usd must be numeric when possible; no $ sign.",
    "- Currency should usually be USD unless the source clearly says another currency.",
    "- Split 10mg into strength=10 and unit=mg where possible.",
    "- quantity should describe package quantity if stated, such as 10 vials/kit.",
    "- Preserve blends/combos as one product.",
    "- Omit shipping, payment, contact, discount, disclaimer, and non-product rows.",
    "- Do not invent products or prices."
  ].join("\n");

  const userContent = [{ type:"input_text", text: instructions + (priceListText ? "\n\nPRICE LIST TEXT:\n" + priceListText : "\n\nPRICE LIST IMAGE ATTACHED.") }];
  if (imageDataUrl) {
    userContent.push({ type:"input_image", image_url:imageDataUrl });
  }

  const input = [
    { role:"system", content:[{type:"input_text", text:"You convert messy peptide vendor price lists, including images/screenshots, into structured TrackMyPeps import rows. Use exact vendor/warehouse values supplied by the user. Do not add commentary."}] },
    { role:"user", content:userContent }
  ];

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method:"POST",
      headers:{"Authorization":"Bearer "+apiKey,"Content-Type":"application/json"},
      body:JSON.stringify({model,input,max_output_tokens:8000,text:{format:{type:"json_schema",name:"trackmypeps_vendor_price_rows",strict:true,schema}}})
    });
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok:false, error:"OpenAI request failed: "+err.message }) };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify({ ok:false, error:data.error?.message || "OpenAI API error", details:data }) };

  let text = data.output_text;
  if (!text && Array.isArray(data.output)) {
    const parts = [];
    for (const item of data.output) {
      if (!item || !Array.isArray(item.content)) continue;
      for (const c of item.content) {
        if (typeof c.text === "string") parts.push(c.text);
        if (typeof c.output_text === "string") parts.push(c.output_text);
      }
    }
    text = parts.join("\n").trim();
  }

  let parsed;
  try { parsed = JSON.parse(text || "{}"); }
  catch { return { statusCode: 502, headers, body: JSON.stringify({ ok:false, error:"Could not parse model output.", raw:text, details:data }) }; }

  let rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  rows = rows.map(r => ({
    vendor,
    warehouse,
    product_name:String(r.product_name||"").trim(),
    catalog_name:String(r.catalog_name||"").trim(),
    strength:r.strength == null ? "" : r.strength,
    quantity:String(r.quantity||"").trim(),
    unit:String(r.unit||"").trim(),
    price_usd:r.price_usd == null ? "" : r.price_usd,
    currency:String(r.currency||"USD").trim() || "USD",
    min_order:String(r.min_order||"").trim(),
    notes:String(r.notes||"").trim()
  })).filter(r => (r.product_name || r.catalog_name) && r.price_usd !== "");

  const csv = rowsToCSV(rows);
  return { statusCode:200, headers, body:JSON.stringify({ ok:true, rows, csv, row_count:rows.length, model, usage:data.usage || null }) };
};