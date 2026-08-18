interface Env {AIRLABS_API_KEY: string;}
interface Airport {name: string;iata_code: string | null;}
const corsHeaders = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type"} satisfies Record<string, string>;
const jsonHeaders = {...corsHeaders, "Content-Type": "application/json"} satisfies Record<string, string>;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: corsHeaders});
		if (request.method !== "GET") return new Response("Method Not Allowed", {status: 405, headers: corsHeaders});
		if (!env.AIRLABS_API_KEY) return jsonResponse({error: "Falta AIRLABS_API_KEY"}, 500);
		const url = new URL(request.url);
		if (url.pathname === "/schedules") return await schedules(url, env);
		if (url.pathname === "/airports") return await airports(env);
		if (url.pathname === "/airport") return await airport(url, env);
		return new Response("Not Found", {status: 404, headers: corsHeaders});
	}
} satisfies ExportedHandler<Env>;

async function schedules(url: URL, env: Env): Promise<Response> {
	const depIata = url.searchParams.get("dep_iata");
	if (!depIata) return jsonResponse({error: "Missing dep_iata parameter"}, 400);
	const apiUrl = new URL("https://airlabs.co/api/v9/schedules");
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
	apiUrl.searchParams.set("dep_iata", depIata);
	apiUrl.searchParams.set("limit", "50");
	return await airlabsRequest(apiUrl);
}

async function airports(env: Env): Promise<Response> {
	const apiUrl = new URL("https://airlabs.co/api/v9/airports");
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
	const response = await fetch(apiUrl);
	if (!response.ok) return new Response(response.body, {status: response.status, headers: jsonHeaders});
	const data = await response.json() as Airport[] | {response?: Airport[]};
	const records = Array.isArray(data) ? data : data.response ?? [];
	const result = records.filter(airport => airport.iata_code).map(airport => ({iata_code: airport.iata_code, name: airport.name}));
	return jsonResponse(result, 200);
}

async function airport(url: URL, env: Env): Promise<Response> {
	const iata = url.searchParams.get("iata")?.trim().toUpperCase();
	if (!iata) return jsonResponse({error: "Missing iata parameter"}, 400);
	const apiUrl = new URL("https://airlabs.co/api/v9/airports");
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
	apiUrl.searchParams.set("iata_code", iata);
	const response = await fetch(apiUrl);
	if (!response.ok) return new Response(response.body, {status: response.status, headers: jsonHeaders});
	const data = await response.json() as Airport[] | {response?: Airport[]};
	const records = Array.isArray(data) ? data : data.response ?? [];
	if (records.length === 0) return jsonResponse({error: "Airport not found"}, 404);
	return jsonResponse(records[0], 200);
}

async function airlabsRequest(url: URL): Promise<Response> {
	try {
		const response = await fetch(url);
		return new Response(response.body, {status: response.status, headers: jsonHeaders});
	} catch {
		return jsonResponse({error: "Error interno de AirLabs"}, 502);
	}
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {status, headers: jsonHeaders});
}
