import {Schedule} from "./interfaces/schedule";
import {Airport} from "./interfaces/airport";

interface Env {AIRLABS_API_KEY: string;}

const corsHeaders = {"Access-Control-Allow-Origin": "*","Access-Control-Allow-Methods": "GET, OPTIONS","Access-Control-Allow-Headers": "Content-Type"} satisfies Record<string, string>;
const jsonHeaders = {...corsHeaders,"Content-Type": "application/json","X-Content-Type-Options": "nosniff"} satisfies Record<string, string>;

const AIRLABS_API = "https://airlabs.co/api/v9";
const IATA_PATTERN = /^[A-Z]{3}$/;
const AIRLABS_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;
const MAX_PAGE = 20;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: corsHeaders});
		if (request.method !== "GET") return jsonResponse({error: "Method Not Allowed"}, 405);
		if (!env.AIRLABS_API_KEY) return jsonResponse({error: "Server configuration error"}, 500);

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
	const page = normalizeInteger(url.searchParams.get("page"), 1, 1, MAX_PAGE);
	const limit = normalizeInteger(url.searchParams.get("limit"), 20, 1, MAX_PAGE_SIZE);

	if (!depIata && !arrIata) return jsonResponse({error: "Missing dep_iata or arr_iata parameter"}, 400);
	if (depIata && arrIata) return jsonResponse({error: "Use only dep_iata or arr_iata"}, 400);

	const requiredItems = page * limit;
	const schedulesByKey = new Map<string, Schedule>();

	for (let currentPage = 0; currentPage < Math.ceil(requiredItems / AIRLABS_PAGE_SIZE); currentPage++) {
		const apiUrl = new URL(`${AIRLABS_API}/schedules`);
		apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);
		apiUrl.searchParams.set("limit", String(AIRLABS_PAGE_SIZE));
		apiUrl.searchParams.set("offset", String(currentPage * AIRLABS_PAGE_SIZE));

		if (depIata) apiUrl.searchParams.set("dep_iata", depIata);
		if (arrIata) apiUrl.searchParams.set("arr_iata", arrIata);

		const response = await fetchAirLabs(apiUrl);
		if (!response.ok) return airLabsError(response);

		const data = await response.json() as {response?: Schedule[];request?: {has_more?: boolean}};
		const records = data.response ?? [];

		for (const record of records) {
			const key = scheduleKey(record);
			const existing = schedulesByKey.get(key);

			if (!existing) {
				schedulesByKey.set(key, normalizeCodeshareRecord(record));
			} else {
				schedulesByKey.set(key, mergeCodeshares(existing, record));
			}
		}

		if (records.length < AIRLABS_PAGE_SIZE || data.request?.has_more === false) break;
	}

	const allSchedules = [...schedulesByKey.values()].sort(compareSchedules);
	const total = allSchedules.length;
	const start = (page - 1) * limit;
	const items = allSchedules.slice(start, start + limit);

	return jsonResponse({
		page,
		limit,
		total,
		has_more: start + items.length < total,
		results: items
	}, 200);
}

async function airports(env: Env): Promise<Response> {
	const apiUrl = new URL(`${AIRLABS_API}/airports`);
	apiUrl.searchParams.set("api_key", env.AIRLABS_API_KEY);

	const response = await fetchAirLabs(apiUrl);
	if (!response.ok) return airLabsError(response);

	const data = await response.json() as Airport[] | {response?: Airport[]};
	const records = Array.isArray(data) ? data : data.response ?? [];

	return jsonResponse(
		records
			.filter(airport => airport.iata_code)
			.map(airport => ({
				iata_code: airport.iata_code,
				name: airport.name
			})),
		200
	);
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

async function airLabsError(response: Response): Promise<Response> {
	let details: unknown = null;

	try {
		details = await response.json();
	} catch {}

	return jsonResponse({
		error: "AirLabs API error",
		status: response.status,
		details
	}, response.status);
}

function normalizeIata(value: string | null): string | null {
	const iata = value?.trim().toUpperCase() ?? "";
	return IATA_PATTERN.test(iata) ? iata : null;
}

function normalizeInteger(value: string | null, fallback: number, min: number, max: number): number {
	const parsed = Number.parseInt(value ?? "", 10);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.min(Math.max(parsed, min), max);
}

function scheduleKey(schedule: Schedule): string {
	const operatingFlight = schedule.cs_flight_iata || schedule.flight_iata || "";
	const dep = schedule.dep_iata || "";
	const arr = schedule.arr_iata || "";
	const time = schedule.dep_time_ts ?? schedule.dep_time ?? "";

	return `${dep}|${arr}|${time}|${operatingFlight}`;
}

function normalizeCodeshareRecord(schedule: Schedule): Schedule {
	const codeshares = new Set<string>();

	if (schedule.flight_iata) codeshares.add(schedule.flight_iata);
	if (schedule.cs_flight_iata) codeshares.add(schedule.cs_flight_iata);

	return {...schedule,codeshares: [...codeshares]};
}

function mergeCodeshares(existing: Schedule, incoming: Schedule): Schedule {
	const existingOperating = !existing.cs_flight_iata;
	const incomingOperating = !incoming.cs_flight_iata;
	const base = existingOperating ? existing : incomingOperating ? incoming : existing;
	const codeshares = new Set<string>(base.codeshares ?? []);

	if (existing.flight_iata) codeshares.add(existing.flight_iata);
	if (existing.cs_flight_iata) codeshares.add(existing.cs_flight_iata);
	if (incoming.flight_iata) codeshares.add(incoming.flight_iata);
	if (incoming.cs_flight_iata) codeshares.add(incoming.cs_flight_iata);

	return {...base,codeshares: [...codeshares]};
}

function compareSchedules(a: Schedule, b: Schedule): number {
	const aTime = a.dep_estimated_ts ?? a.dep_time_ts ?? Number.MAX_SAFE_INTEGER;
	const bTime = b.dep_estimated_ts ?? b.dep_time_ts ?? Number.MAX_SAFE_INTEGER;

	return aTime - bTime;
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
					description: "Returns paginated departures or arrivals ordered by departure time.",
					operationId: "getSchedules",
					parameters: [
						{name: "dep_iata",in: "query",required: false,description: "Departure airport IATA code.",schema: {type: "string",pattern: "^[A-Za-z]{3}$",example: "MAD"}},
						{name: "arr_iata",in: "query",required: false,description: "Arrival airport IATA code.",schema: {type: "string",pattern: "^[A-Za-z]{3}$",example: "MAD"}},
						{name: "page",in: "query",required: false,description: "Page number.",schema: {type: "integer",minimum: 1,default: 1}},
						{name: "limit",in: "query",required: false,description: "Number of results per page.",schema: {type: "integer",minimum: 1,maximum: 50,default: 20}}
					],
					responses: {
						"200": {description: "Paginated schedules"},
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
