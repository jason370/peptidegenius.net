exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: "Missing OPENAI_API_KEY environment variable." }) };
  }

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Invalid JSON request body." }) }; }

  const prompt = String(body.prompt || "").trim();
  const inventory = Array.isArray(body.inventory) ? body.inventory : [];
  const builderState = body.builderState || {};
  const userIntent = String(builderState.intent || "").trim();
  if (!prompt) {
    return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: "Missing prompt." }) };
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      plan: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string", minLength: 1 },
            lane: { type: "string", enum: ["breakfast", "lunch", "dinner", "bedtime"] },
            days: {
              type: "array",
              minItems: 1,
              items: { type: "string", enum: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] }
            },
            dose: { anyOf: [{ type: "number" }, { type: "string" }] },
            unit: { type: "string", minLength: 1 },
            purpose: { type: "string", minLength: 1 }
          },
          required: ["name", "lane", "days", "dose", "unit", "purpose"]
        }
      }
    },
    required: ["plan"]
  };

  const strengthenedPrompt = [
    prompt,
    "",
    userIntent ? ("USER REQUEST (follow this closely):\n" + userIntent) : "",
    "CRITICAL NON-EMPTY OUTPUT RULE:",
    "- Do NOT return an empty array or empty plan.",
    "- Return at least one plan row.",
    "- If information is insufficient, return one cautious review-needed row rather than no rows.",
    "- Prefer exact inventory names/codes when present.",
    "- Inventory names/codes: " + (inventory.length ? inventory.join(", ") : "none detected"),
    "- Builder state: " + JSON.stringify(builderState)
  ].join("\n");

  const input = [
    {
      role: "system",
      content: [{
        type: "input_text",
        text: "You are a TrackMyPeps stack planning assistant. Return only JSON matching the provided schema. Never return an empty plan. Use cautious, non-prescriptive language in purpose fields."
      }]
    },
    { role: "user", content: [{ type: "input_text", text: strengthenedPrompt }] }
  ];

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        max_output_tokens: 5000,
        text: {
          format: {
            type: "json_schema",
            name: "trackmypeps_stack_plan_nonempty",
            strict: true,
            schema
          }
        }
      })
    });
  } catch (err) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "OpenAI request failed: " + err.message }) };
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { statusCode: response.status, headers, body: JSON.stringify({ ok: false, error: data.error?.message || "OpenAI API error", details: data }) };
  }

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
  catch {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Could not parse model JSON output.", raw: text, details: data }) };
  }

  const plan = Array.isArray(parsed) ? parsed : parsed.plan;
  if (!Array.isArray(plan) || plan.length === 0) {
    return { statusCode: 502, headers, body: JSON.stringify({ ok: false, error: "Model returned an empty plan. Try selecting goals/inventory or use fallback draft.", raw: parsed }) };
  }

  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, plan, model, usage: data.usage || null }) };
};