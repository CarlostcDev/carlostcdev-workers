import systemPrompt from "./agents/AGENT.md";

interface Env {
	GEMINI_API_KEY?: string;
	GEMINI_MODEL?: string;
}

type GeminiRole = "user" | "model";

interface GeminiPart {
	text: string;
}

interface GeminiContent {
	role?: GeminiRole;
	parts: GeminiPart[];
}

interface RequestBody {
	message?: unknown;
	messages?: unknown;
}

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "POST, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type"
} satisfies Record<string, string>;

const jsonHeaders = {
	...corsHeaders,
	"Content-Type": "application/json"
} satisfies Record<string, string>;

const streamHeaders = {
	...corsHeaders,
	"Content-Type": "text/event-stream; charset=utf-8",
	"Cache-Control": "no-cache"
} satisfies Record<string, string>;

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		if (request.method === "OPTIONS") {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		if (request.method !== "POST") {
			return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
		}

		if (!env.GEMINI_API_KEY) {
			return jsonResponse({ error: "Falta GEMINI_API_KEY" }, 500);
		}

		const body = await readBody(request);

		if (!body) {
			return jsonResponse({ error: "JSON inválido" }, 400);
		}

		const contents = normalizeContents(body);

		if (contents.length === 0) {
			return jsonResponse({ error: "El historial de mensajes es inválido" }, 400);
		}

		try {
			const geminiResponse = await fetch(geminiUrl(env), {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-goog-api-key": env.GEMINI_API_KEY
				},
				body: JSON.stringify({
					systemInstruction: { parts: [{ text: systemPrompt }] },
					contents
				})
			});

			if (!geminiResponse.ok) {
				return jsonResponse(
					{ error: "Error de Gemini", details: await geminiError(geminiResponse) },
					geminiResponse.status
				);
			}

			return new Response(geminiResponse.body, {
				status: 200,
				headers: streamHeaders
			});
		} catch {
			return jsonResponse({ error: "Error interno del servidor" }, 500);
		}
	}
} satisfies ExportedHandler<Env>;

async function readBody(request: Request): Promise<RequestBody | null> {
	try {
		return await request.json() as RequestBody;
	} catch {
		return null;
	}
}

function normalizeContents(body: RequestBody): GeminiContent[] {
	if (Array.isArray(body.messages)) {
		const contents = body.messages.flatMap(normalizeMessage);

		if (contents.length > 0) {
			return contents;
		}
	}

	if (typeof body.message === "string" && body.message.trim().length > 0) {
		return [{ role: "user", parts: [{ text: body.message.trim() }] }];
	}

	return [];
}

function normalizeMessage(value: unknown): GeminiContent[] {
	if (!isRecord(value)) {
		return [];
	}

	if (value.role === "system" || value.role === "developer") {
		return [];
	}

	const role = normalizeRole(value.role);

	if (Array.isArray(value.parts)) {
		const parts = value.parts.flatMap(normalizePart);

		if (parts.length > 0) {
			return [{ role, parts }];
		}
	}

	const parts = normalizeContent(value.content);

	if (parts.length === 0) {
		return [];
	}

	return [{ role, parts }];
}

function normalizeRole(role: unknown): GeminiRole | undefined {
	if (role === "assistant" || role === "model") {
		return "model";
	}

	if (role === "user") {
		return "user";
	}

	return undefined;
}

function normalizePart(value: unknown): GeminiPart[] {
	if (isRecord(value) && typeof value.text === "string" && value.text.trim().length > 0) {
		return [{ text: value.text.trim() }];
	}

	return [];
}

function normalizeContent(value: unknown): GeminiPart[] {
	if (typeof value === "string" && value.trim().length > 0) {
		return [{ text: value.trim() }];
	}

	if (Array.isArray(value)) {
		return value.flatMap((item) => {
			if (typeof item === "string") {
				return normalizeContent(item);
			}

			return normalizePart(item);
		});
	}

	return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function jsonResponse(body: unknown, status: number): Response {
	return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function geminiUrl(env: Env): string {
	const model = env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
	return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
}

async function geminiError(response: Response): Promise<unknown> {
	const contentType = response.headers.get("Content-Type");

	if (contentType?.includes("application/json")) {
		return await response.json();
	}

	return await response.text();
}
