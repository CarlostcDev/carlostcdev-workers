interface Env {AIRLABS_API_KEY: string;}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		if (url.pathname !== "/schedules") return new Response("Not Found", { status: 404 });
		const depIata = url.searchParams.get("dep_iata");
		if (!depIata) return Response.json({ error: "Missing dep_iata parameter" }, { status: 400 });
		const apiUrl = new URL("https://airlabs.co/api/v9/schedules");
		apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
		apiUrl.searchParams.set("dep_iata", depIata);
		apiUrl.searchParams.set("limit", "50");
		const response = await fetch(apiUrl);
		return new Response(response.body, {
			status: response.status,
			headers: {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
		});
	}
} satisfies ExportedHandler<Env>;
