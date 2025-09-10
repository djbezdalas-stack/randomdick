export function GET(request) {
  return new Response(
    JSON.stringify({ message: "Hello from Vercel!" }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // allow your frontend to fetch
      },
    }
  );
}

/* export default async function handler(req, res) {
  const { tag } = req.query;

  if (!tag) {
    return res.status(400).json({ error: "Missing player tag" });
  }

  try {
    const apiUrl = `https://api.clashroyale.com/v1/players/%23${tag}`;
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Bearer ${process.env.CR_TOKEN}`, // token hidden in Vercel
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return res.status(response.status).json(error);
    }

    const data = await response.json();

    // Enable CORS so browser fetch works
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error", details: err.message });
  }
} */