export async function GET(request) {
  try {
    const url = new URL(request.url);
    let tag = url.searchParams.get("tag");

    // DEBUG: log the raw URL and tag
    console.log("Full request URL:", request.url);
    console.log("Parsed tag:", tag);

    if (!tag) {
      return new Response(
        JSON.stringify({ error: "Missing player tag" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }

    if (!tag.startsWith("#")) tag = "#" + tag;

    const apiUrl = `https://proxy.royaleapi.dev/v1/players/${encodeURIComponent(tag)}`;
    console.log("Final API URL:", apiUrl); // DEBUG

    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.ROYALEAPI_KEY}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.log("API error response:", errorData); // DEBUG
      return new Response(JSON.stringify(errorData), {
        status: response.status,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });

  } catch (err) {
    console.log("Server error:", err); // DEBUG
    return new Response(
      JSON.stringify({ error: "Server error", details: err.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
