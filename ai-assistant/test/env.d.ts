declare module "cloudflare:test" {
	interface ProvidedEnv extends Env {
		GEMINI_API_KEY: string;
	}
}
