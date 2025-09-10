export async function GET(request) {
  try {
    const url = new URL(request.url);
    let tag = url.searchParams.get("tag");

    if (!tag) {
      return new Response(
        JSON.stringify({ error: "Missing player tag" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Ensure tag starts with #
    if (!tag.startsWith("#")) tag = "#" + tag;

    // RoyaleAPI proxy endpoint
    const apiUrl = `https://proxy.royaleapi.com/v1/player/${encodeURIComponent(tag)}`;

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.ROYALEAPI_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return new Response(
        JSON.stringify(errorData),
        { status: response.status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const data = await response.json();
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Server error", details: err.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
}
