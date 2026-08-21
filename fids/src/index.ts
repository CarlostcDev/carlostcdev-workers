import {Airport} from "./interfaces/airport";
import {Flight} from "./interfaces/flight";
import {AeroDataBoxAirportSearchResponse} from "./interfaces/aerodatabox-airport-search-response";
import {Env} from "./interfaces/env";
import {swaggerHtml} from "./docs/swagger";
import {getOpenApiSpec} from "./docs/openapi";

const corsHeaders = {"Access-Control-Allow-Origin": "*","Access-Control-Allow-Methods": "GET, OPTIONS","Access-Control-Allow-Headers": "Content-Type"} satisfies Record<string, string>;
const jsonHeaders = {...corsHeaders,"Content-Type": "application/json","X-Content-Type-Options": "nosniff"} satisfies Record<string, string>;
const AIRLABS_API = "https://airlabs.co/api/v9";
const AERODATABOX_API = "https://aerodatabox.p.rapidapi.com";
const IATA_PATTERN = /^[A-Z]{3}$/;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") return new Response(null, {status: 204, headers: corsHeaders});
		if (request.method !== "GET") return jsonResponse({error: "Method Not Allowed"}, 405);
		const url = new URL(request.url);
		try {
			if (url.pathname === "/docs") return docs();
			if (url.pathname === "/openapi.json") return openapi(url);
			if (url.pathname === "/schedules") {
				if (!env.RAPIDAPI_KEY) return jsonResponse({error: "Server configuration error"}, 500);
				return await schedules(url, env);
			}
			if (url.pathname === "/nearby-airports") {
				if (!env.RAPIDAPI_KEY) return jsonResponse({error: "Server configuration error"}, 500);
				return await nearbyAirports(request, env);
			}
			if (url.pathname === "/airports") {
				if (!env.AIRLABS_API_KEY) return jsonResponse({error: "Server configuration error"}, 500);
				return await airports(env);
			}
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
	const apiUrl = new URL(`${AERODATABOX_API}/flights/airports/iata/${airportIata}`);
	apiUrl.searchParams.set("offsetMinutes", "0");
	apiUrl.searchParams.set("durationMinutes", "720");
	apiUrl.searchParams.set("withLeg", "true");
	apiUrl.searchParams.set("direction", depIata ? "Departure" : "Arrival");
	apiUrl.searchParams.set("withCancelled", "true");
	apiUrl.searchParams.set("withCodeshared", "true");
	apiUrl.searchParams.set("withCargo", "true");
	apiUrl.searchParams.set("withPrivate", "true");
	apiUrl.searchParams.set("withLocation", "false");
	const response = await fetchAeroDataBox(apiUrl, env);
	if (!response.ok) return aeroDataBoxError(response);
	const data = await response.json() as {departures?: Flight[]; arrivals?: Flight[]};
	if (depIata) data.departures = filterCodeshares(data.departures ?? []);
	if (arrIata) data.arrivals = filterCodeshares(data.arrivals ?? []);
	return jsonResponse(data, 200);
}

async function nearbyAirports(request: Request, env: Env): Promise<Response> {
	const ip = request.headers.get("CF-Connecting-IP");
	if (!ip) return jsonResponse({error: "Unable to determine client IP address"}, 400);
	const apiUrl = new URL(`${AERODATABOX_API}/airports/search/ip`);
	apiUrl.searchParams.set("q", ip);
	apiUrl.searchParams.set("radiusKm", "200");
	apiUrl.searchParams.set("limit", "50");
	apiUrl.searchParams.set("withFlightInfoOnly", "true");
	const response = await fetchAeroDataBox(apiUrl, env);
	if (!response.ok) return aeroDataBoxError(response);
	const data = await response.json() as AeroDataBoxAirportSearchResponse;
	const records = data.items ?? [];
	return jsonResponse(records.filter(airport => airport.iata).map(airport => ({
		iata_code: airport.iata, name: airport.name, city: airport.municipalityName ?? ""
	})), 200);
}

function filterCodeshares(flights: Flight[]): Flight[] {
	const seen = new Set<string>();
	return flights.filter(flight => {
		const key = [
			flight.departure?.scheduledTime?.utc ?? flight.departure?.revisedTime?.utc ?? "",
			flight.arrival?.scheduledTime?.utc ?? flight.arrival?.revisedTime?.utc ?? ""
		].join("|");
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
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
			headers: {"X-RapidAPI-Key": env.RAPIDAPI_KEY, "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com"},
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

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), {status, headers: jsonHeaders});
}

function docs(): Response {
	return new Response(swaggerHtml, {status: 200, headers: {"Content-Type": "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff"}});
}

function openapi(url: URL): Response {
	return jsonResponse(getOpenApiSpec(url), 200);
}
