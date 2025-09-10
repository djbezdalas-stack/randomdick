export async function GET(request) {
  try {
    const url = new URL(request.url);
    let tag = url.searchParams.get("tag");
    if (!tag) tag = "#8Y0YV92QQ"; // default test

    if (!tag.startsWith("#")) tag = "#" + tag;

    const apiUrl = `https://proxy.royaleapi.dev/v1/players/${encodeURIComponent(tag)}`;

    // DEBUG: log what header we are actually sending
    console.log("Authorization header sent:", `Bearer ${process.env.ROYALEAPI_KEY}`);

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.ROYALEAPI_KEY}`,
      },
    });
    console.log("ROYALEAPI_KEY exists?", !!process.env.ROYALEAPI_KEY);
    const data = await response.json();
    if (!response.ok) {
      console.log("API error response:", data);
      return new Response(JSON.stringify(data), {
        status: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const masteries = (data.badges || [])
  .filter(b => b.name.startsWith("Mastery"))
  .map(m => ({
    name: m.name.replace(/^Mastery/, ""), // optional: remove prefix
    level: m.level,
    maxLevel: m.maxLevel,
    progress: m.progress,
    target: m.target,
    icon: m.iconUrls?.large || "",
  }));

    return new Response(JSON.stringify(masteries), {
      status: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  } catch (err) {
    console.log("Server error:", err);
    return new Response(JSON.stringify({ error: "Server error", details: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
