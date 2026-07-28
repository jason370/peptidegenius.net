exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: "Method not allowed" }) };
  }

  let pkgVersion = "";
  try {
    pkgVersion = require("../../package.json").version || "";
  } catch (_) {}

  const rawVersion = String(process.env.PT_VERSION || pkgVersion || "0.0.0");
  const versionMatch = rawVersion.match(/(\d+(?:\.\d+){1,3})/);
  const version = versionMatch ? versionMatch[1] : rawVersion;
  const channel = String(process.env.PT_RELEASE_CHANNEL || "stable").trim() || "stable";
  const commitRef = String(process.env.COMMIT_REF || "").trim();
  const deployId = String(process.env.DEPLOY_ID || process.env.BUILD_ID || "").trim();
  const buildId = commitRef || deployId || "";

  const baseUrl = String(
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    ""
  ).replace(/\/+$/, "");

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      ok: true,
      version,
      version_raw: rawVersion,
      channel,
      build_id: buildId,
      commit_ref: commitRef || null,
      deploy_id: deployId || null,
      app_url: baseUrl ? baseUrl + "/" : "",
      generated_at: new Date().toISOString()
    })
  };
};
