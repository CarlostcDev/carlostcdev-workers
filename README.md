<img src="docs/logo.png" width="100%" alt="AI Assistant">

# AI Assistant Backend

Backend for the AI chatbot used in Carlos Tormo Castaño's portfolio.

The project runs on **Cloudflare Workers** and uses **Google Gemini** to generate the assistant's responses.

<img src="docs/gemini-3.gif" width="100%" alt="Gif Gemini 3.5">

<img src="docs/cloudfare-workers.webp" width="100%" alt="Logo Cloudflare Workers">

## What does this project provide?

Once deployed, you get a public API that can be called from a frontend application.

Production endpoint:

```text
https://ai-assistant.carlostcdev.workers.dev
```

The backend receives a JSON message, sends it to Gemini using the configured professional context, and streams the generated response back to the frontend.

---

# Requirements

Install the following before starting:

- [Node.js](https://nodejs.org/)
- Git
- A Cloudflare account
- A Google Gemini API key

Check Node.js:

```bash
node --version
npm --version
```

---

# 1. Clone the repository

This is the actual repository for the project:

```text
https://github.com/CarlostcDev/ai-assistant.git
```

Clone it:

```bash
git clone https://github.com/CarlostcDev/ai-assistant.git
```

Enter the project:

```bash
cd ai-assistant
```

Install the dependencies:

```bash
npm install
```

The repository already contains Wrangler and the commands required to run and deploy the Worker.

---

# 2. Log in to Cloudflare

Run:

```bash
npx wrangler login
```

A browser window will open.

Log in to the Cloudflare account where you want to deploy the Worker and authorize Wrangler.

Verify the account:

```bash
npx wrangler whoami
```

---

# 3. Configure the Worker name

The repository already contains the Wrangler configuration.

The current Worker is named:

```text
ai-assistant
```

and its entry point is:

```text
src/index.ts
```

This is configured in `wrangler.jsonc`.

The relevant configuration is:

```jsonc
{
  "name": "ai-assistant",
  "main": "src/index.ts"
}
```

You normally do not need to change this.

---

# 4. Configure the custom API subdomain

The public API used by the portfolio is:

```text
https://ai-assistant.carlostcdev.workers.dev
```

The important part is:

```text
ai-assistant.carlostcdev-chatbot
```

The Worker itself is named:

```text
ai-assistant
```

If you want to deploy this project under your own Cloudflare Worker URL, the URL will normally follow the form:

```text
https://<worker-name>.<your-workers-subdomain>.workers.dev
```

For this project, the Worker name is configured as `ai-assistant`.

## Enable the workers.dev route

In Cloudflare:

1. Open **Workers & Pages**.
2. Open the Worker named **ai-assistant**.
3. Open **Settings**.
4. Open **Domains & Routes**.
5. Add or enable the `workers.dev` domain for the Worker.

Your Cloudflare account must have a workers.dev subdomain configured.

For this project the resulting public endpoint is:

```text
https://ai-assistant.carlostcdev.workers.dev
```

If you use a custom domain instead, add the domain or route from **Workers & Pages → ai-assistant → Settings → Domains & Routes**.

---

# 5. Configure the Gemini API key

The Worker expects the API key in the environment variable:

```text
GEMINI_API_KEY
```

The code reads it from:

```text
env.GEMINI_API_KEY
```

instead of putting the key directly into the source code.

Create the production secret:

```bash
npx wrangler secret put GEMINI_API_KEY
```

Paste your Google Gemini API key when prompted.

Do not put the API key directly into `src/index.ts`.

---

# 6. Test the project locally

Run:

```bash
npm run dev
```

This executes:

```bash
wrangler dev
```

as defined by the repository.

Wrangler will provide a local URL, normally similar to:

```text
http://localhost:8787
```

The Worker only accepts `POST` requests and handles `OPTIONS` requests for CORS.

Example request:

```json
{
  "message": "What technologies does Carlos know?"
}
```

---

# 7. Edit the assistant

The assistant's professional context is inside:

```text
src/agents/AGENT.md
```

The Worker loads that file into `systemInstruction`.

This is the section you should edit when adapting the project to another portfolio.

You can change:

- Personal information.
- Education.
- Skills.
- Technologies.
- Work experience.
- Internships.
- Projects.
- Assistant behavior.
- Language rules.
- Professional presentation.

For this portfolio, the context contains information about Carlos Tormo Castaño and his professional profile.

After editing:

```bash
npm run dev
```

Test the changes locally.

---

# 8. Deploy the Worker

When the local version works:

```bash
npm run deploy
```

This runs:

```bash
wrangler deploy
```

as configured in `package.json`.

Cloudflare will deploy the Worker using the configuration in:

```text
wrangler.jsonc
```

The current Worker configuration uses:

```text
name: ai-assistant
entry point: src/index.ts
```

and the Worker is therefore deployed as the `ai-assistant` Worker.

---

# 9. Connect the portfolio frontend

Once deployed, point the frontend to:

```text
https://ai-assistant.carlostcdev.workers.dev
```

The request body should contain the user's message:

```json
{
  "message": "Tell me about Carlos's experience with Angular."
}
```

The complete flow is:

```text
Portfolio
    │
    │ POST
    ▼
https://ai-assistant.carlostcdev.workers.dev
    │
    ▼
Cloudflare Worker
    │
    ▼
Google Gemini
    │
    ▼
Streaming response
    │
    ▼
Portfolio
```

---

# 10. Change the Worker name or URL

The Worker name is controlled by:

```text
wrangler.jsonc
```

Current value:

```jsonc
"name": "ai-assistant"
```

For example:

```jsonc
"name": "my-chatbot"
```

After changing it, deploy again:

```bash
npm run deploy
```

The Worker URL will then use the new Worker name:

```text
https://my-chatbot.<your-workers-subdomain>.workers.dev
```

If you need a specific custom hostname such as:

```text
https://api.example.com
```

configure it in:

**Cloudflare Dashboard → Workers & Pages → ai-assistant → Settings → Domains & Routes**

The Worker name and the public hostname are related, but they are not the same configuration.

---

# 11. Update an existing deployment

After changing `src/index.ts` or `wrangler.jsonc`:

```bash
npm run dev
```

Test locally.

Then:

```bash
npm run deploy
```

Cloudflare will update the existing Worker.

If only the API key changes:

```bash
npx wrangler secret put GEMINI_API_KEY
```

There is no need to modify the source code.

---

# 12. Complete setup from zero

For an existing copy of this repository:

```bash
git clone https://github.com/CarlostcDev/ai-assistant.git
cd ai-assistant

npm install

npx wrangler login

npx wrangler secret put GEMINI_API_KEY

npm run dev
```

After testing:

```bash
npm run deploy
```

Then configure the Worker URL in the frontend.

---

# 13. Repository structure

```text
ai-assistant/
├── docs/
│   ├── logo.png
│   ├── gemini-3.gif
│   └── cloudfare-workers.webp
├── src/
│   ├── agents/
│   │   └── AGENT.md
│   └── index.ts
├── package.json
└── wrangler.jsonc
```

The repository's Wrangler configuration uses `src/index.ts` as the Worker entry point and names the Worker `ai-assistant`.

---

# Result

After completing the setup, you have:

```text
A GitHub repository
        ↓
A Cloudflare Worker
        ↓
A public API endpoint
        ↓
Google Gemini
        ↓
Streaming AI responses
```

For the current project:

```text
GitHub
https://github.com/CarlostcDev/ai-assistant.git

Worker
ai-assistant

Production API
https://ai-assistant.carlostcdev.workers.dev
```

The result is a deployable backend that can be connected directly to the portfolio chatbot.
