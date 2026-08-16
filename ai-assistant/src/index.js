import systemPrompt from "./agents/AGENT.md";

export default {
	async fetch(request, env) {
		const corsHeaders = {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type"
		};

		if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
		if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });

		try {
			const { messages } = await request.json();

			if (!Array.isArray(messages) || messages.length === 0) {
				return new Response(JSON.stringify({ error: "El historial de mensajes es inválido" }),
					{ status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
				);
			}

			const geminiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:streamGenerateContent?alt=sse",
				{
					method: "POST",
					headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
					body: JSON.stringify({
						systemInstruction: { parts: [{ text: systemPrompt }] },
						contents: messages
					})
				}
			);

			if (!geminiResponse.ok) {
				const data = await geminiResponse.json();
				return new Response(
					JSON.stringify({ error: "Error de Gemini", details: data }),
					{
						status: geminiResponse.status,
						headers: { ...corsHeaders, "Content-Type": "application/json" }
					}
				);
			}

			return new Response(geminiResponse.body, {
				status: 200,
				headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" }
			});

		} catch (error) {
			return new Response(
				JSON.stringify({ error: "Error interno del servidor" }),
				{ status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
				}
			);
		}
	}
};
