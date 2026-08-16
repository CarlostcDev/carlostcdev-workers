import {
	env,
	createExecutionContext,
	waitOnExecutionContext
} from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";

const testEnv = { ...env, GEMINI_API_KEY: "test-key" };

describe("AI assistant worker", () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("handles CORS preflight", async () => {
		const request = new Request("http://example.com", { method: "OPTIONS" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
	});

	it("rejects non-POST requests", async () => {
		const request = new Request("http://example.com", { method: "GET" });
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(405);
		expect(await response.text()).toBe("Method Not Allowed");
	});

	it("rejects invalid message input", async () => {
		const request = new Request("http://example.com", {
			method: "POST",
			body: JSON.stringify({ messages: [] }),
			headers: { "Content-Type": "application/json" }
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "El historial de mensajes es inválido" });
	});

	it("streams Gemini output from a simple message", async () => {
		const stream = new ReadableStream({
			start(controller) {
				controller.enqueue(new TextEncoder().encode("data: ok\n\n"));
				controller.close();
			}
		});
		const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(stream, {
				status: 200,
				headers: { "Content-Type": "text/event-stream" }
			})
		);
		const request = new Request("http://example.com", {
			method: "POST",
			body: JSON.stringify({ message: "Tell me about Carlos" }),
			headers: { "Content-Type": "application/json" }
		});
		const ctx = createExecutionContext();
		const response = await worker.fetch(request, testEnv, ctx);
		await waitOnExecutionContext(ctx);
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/event-stream");
		expect(await response.text()).toBe("data: ok\n\n");
		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0];
		expect(String(url)).toContain("streamGenerateContent");
		expect(init?.method).toBe("POST");
		expect(init?.headers).toMatchObject({ "x-goog-api-key": "test-key" });
		const payload = JSON.parse(String(init?.body));
		expect(payload.contents).toEqual([
			{ role: "user", parts: [{ text: "Tell me about Carlos" }] }
		]);
		expect(payload.systemInstruction.parts[0].text).toContain("Carlos Tormo");
	});
});
