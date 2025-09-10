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

