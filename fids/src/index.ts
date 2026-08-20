import {Airport} from "./interfaces/airport";
interface Env {AIRLABS_API_KEY: string; RAPIDAPI_KEY: string;}
const corsHeaders = {"Access-Control-Allow-Origin": "*","Access-Control-Allow-Methods": "GET, OPTIONS","Access-Control-Allow-Headers": "Content-Type"} satisfies Record<string, string>;
const jsonHeaders = {...corsHeaders,"Content-Type": "application/json","X-Content-Type-Options": "nosniff"} satisfies Record<string, string>;
const AIRLABS_API = "https://airlabs.co/api/v9";
const AERODATABOX_API = "https://aerodatabox.p.rapidapi.com";
const IATA_PATTERN = /^[A-Z]{3}$/;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: corsHeaders});
		if (request.method !== "GET") return jsonResponse({error: "Method Not Allowed"}, 405);
		if (!env.AIRLABS_API_KEY || !env.RAPIDAPI_KEY) return jsonResponse({error: "Server configuration error"}, 500);
		const url = new URL(request.url);

		try {
			if (url.pathname === "/docs") return docs();
			if (url.pathname === "/openapi.json") return openapi();
			if (url.pathname === "/schedules") return await schedules(url, env);
			if (url.pathname === "/airports") return await airports(env);
			if (url.pathname === "/airport") return await airport(url, env);
			return new Response("Not Found", {status: 404, headers: corsHeaders});
		} catch {
			return jsonResponse({error: "Internal Server Error"}, 500);
		}
	}
} satisfies ExportedHandler<Env>;

async function schedules(url: URL, env: Env): Promise<Response> {
	const depIata = normalizeIata(url.searchParams.get("dep_iata"));
	const arrIata = normalizeIata(url.searchParams.get("arr_iata"));
	if (!depIata && !arrIata) return jsonResponse({error: "Missing dep_iata or arr_iata parameter"}, 400);
	if (depIata && arrIata) return jsonResponse({error: "Use only dep_iata or arr_iata"}, 400);

	const airportIata = depIata ?? arrIata!;
	const now = new Date();
	const fromLocal = formatLocalDate(now);
	const toLocal = formatLocalDate(new Date(now.getTime() + 12 * 60 * 60 * 1000));

	const apiUrl = new URL(`${AERODATABOX_API}/flights/airports/iata/${airportIata}/${fromLocal}/${toLocal}`);
	apiUrl.searchParams.set("withLeg", "true");
	apiUrl.searchParams.set("direction", "Both");
	apiUrl.searchParams.set("withCancelled", "true");
	apiUrl.searchParams.set("withCodeshared", "true");
	apiUrl.searchParams.set("withCargo", "true");
	apiUrl.searchParams.set("withPrivate", "true");
	apiUrl.searchParams.set("withLocation", "false");

	const response = await fetchAeroDataBox(apiUrl, env);
	if (!response.ok) return aeroDataBoxError(response);
	const data = await response.json();
	return jsonResponse(data, 200);
}

async function airports(env: Env): Promise<Response> {
	const apiUrl = new URL(`${AIRLABS_API}/airports`);
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
	const response = await fetchAirLabs(apiUrl);
	if (!response.ok) return airLabsError(response);
	const data = await response.json() as Airport[] | {response?: Airport[]};
	const records = Array.isArray(data) ? data : data.response ?? [];
	return jsonResponse(records.filter(airport => airport.iata_code).map(airport => ({iata_code: airport.iata_code, name: airport.name})), 200);
}

async function airport(url: URL, env: Env): Promise<Response> {
	const iata = normalizeIata(url.searchParams.get("iata"));
	if (!iata) return jsonResponse({error: "Invalid or missing IATA code"}, 400);
	const apiUrl = new URL(`${AIRLABS_API}/airports`);
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
	apiUrl.searchParams.set("iata_code", iata);
	const response = await fetchAirLabs(apiUrl);
	if (!response.ok) return airLabsError(response);
	const data = await response.json() as Airport[] | {response?: Airport[]};
	const records = Array.isArray(data) ? data : data.response ?? [];
	if (records.length === 0) return jsonResponse({error: "Airport not found"}, 404);
	return jsonResponse(records[0], 200);
}

async function fetchAirLabs(url: URL): Promise<Response> {
	try {
		return await fetch(url, {signal: AbortSignal.timeout(10000)});
	} catch {
		return new Response(JSON.stringify({error: "AirLabs request failed"}), {status: 502, headers: jsonHeaders});
	}
}

async function fetchAeroDataBox(url: URL, env: Env): Promise<Response> {
	try {
		return await fetch(url, {
			headers: {
				"X-RapidAPI-Key": env.RAPIDAPI_KEY,
				"X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"
			},
			signal: AbortSignal.timeout(10000)
		});
	} catch {
		return new Response(JSON.stringify({error: "AeroDataBox request failed"}), {status: 502, headers: jsonHeaders});
	}
}

async function airLabsError(response: Response): Promise<Response> {
	let details: unknown = null;
	try {details = await response.json();} catch {}
	return jsonResponse({error: "AirLabs API error", status: response.status, details}, response.status);
}

async function aeroDataBoxError(response: Response): Promise<Response> {
	let details: unknown = null;
	try {details = await response.json();} catch {}
	return jsonResponse({error: "AeroDataBox API error", status: response.status, details}, response.status);
}

function normalizeIata(value: string | null): string | null {
	const iata = value?.trim().toUpperCase() ?? "";
	return IATA_PATTERN.test(iata) ? iata : null;
}

function formatLocalDate(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {status, headers: jsonHeaders});
}

function docs(): Response {
	return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <title>FIDS API Documentation</title>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        window.onload = () => {
            SwaggerUIBundle({
                url: "/openapi.json",
                dom_id: "#swagger-ui",
                deepLinking: true,
                presets: [SwaggerUIBundle.presets.apis],
                layout: "BaseLayout"
            });
        };
    </script>
</body>
</html>`, {status: 200, headers: {"Content-Type": "text/html; charset=utf-8","X-Content-Type-Options": "nosniff"}});
}

function openapi(): Response {
	return jsonResponse({
		openapi: "3.0.3",
		info: {
			title: "FIDS API",
			description: "API for the Flight Information Display System.",
			version: "1.0.0"
		},
		servers: [{url: "https://fids.carlostcdev.workers.dev"}],
		paths: {
			"/airports": {
				get: {
					summary: "Get airports",
					description: "Returns all airports with an IATA code.",
					operationId: "getAirports",
					responses: {
						"200": {
							description: "List of airports",
							content: {
								"application/json": {
									schema: {
										type: "array",
										items: {$ref: "#/components/schemas/Airport"}
									}
								}
							}
						}
					}
				}
			},
			"/airport": {
				get: {
					summary: "Get airport",
					description: "Returns information about a specific airport.",
					operationId: "getAirport",
					parameters: [{
						name: "iata",
						in: "query",
						required: true,
						description: "Three-letter IATA airport code.",
						schema: {type: "string",pattern: "^[A-Za-z]{3}$",example: "MAD"}
					}],
					responses: {
						"200": {description: "Airport information"},
						"400": {description: "Invalid or missing IATA code"},
						"404": {description: "Airport not found"}
					}
				}
			},
			"/schedules": {
				get: {
					summary: "Get flight schedules",
					description: "Returns departures and arrivals from AeroDataBox for a 12-hour time range starting from the current local time.",
					operationId: "getSchedules",
					parameters: [
						{name: "dep_iata",in: "query",required: false,description: "Departure airport IATA code.",schema: {type: "string",pattern: "^[A-Za-z]{3}$",example: "MAD"}},
						{name: "arr_iata",in: "query",required: false,description: "Arrival airport IATA code.",schema: {type: "string",pattern: "^[A-Za-z]{3}$",example: "MAD"}}
					],
					responses: {
						"200": {description: "AeroDataBox flight schedules"},
						"400": {description: "Invalid parameters"}
					}
				}
			}
		},
		components: {
			schemas: {
				Airport: {
					type: "object",
					properties: {
						iata_code: {type: "string",example: "MAD"},
						name: {type: "string",example: "Adolfo Suarez Madrid-Barajas Airport"}
					}
				}
			}
		}
	}, 200);
}
