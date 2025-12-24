# Mastra Issue #11386 — Minimal Reproduction

This repo is a minimal `server/` + `client/` demo for:

[#11386](https://github.com/mastra-ai/mastra/issues/11386)

It streams an agent response using `@mastra/client-js` and executes a **client-side tool** (`get-weather`) to fetch weather for **at least 3 locations** and summarize the comparison.

## Requirements

- Node.js `>= 20.19.0`
- pnpm `10.x`

## Setup

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create server env file:

   ```bash
   cp server/.env.example server/.env
   ```

3. Edit `server/.env`:

   - `MODEL` (e.g. `deepseek-chat`)
   - `API_KEY` (your provider key)
   - `BASE_URL` (optional, only if you use a custom endpoint)

## Run

Start both server and client:

```bash
pnpm dev
```

- Client: `http://localhost:7171`
- Server: `http://localhost:4111`

## How to Test (Repro Steps)

1. Open `http://localhost:7171`
2. Confirm the default location tags are:
   - `Beijing`
   - `Shanghai`
   - `Guangzhou`
3. Click **Compare (stream)**.
4. Observe the result area streaming tokens as the agent responds.

### Verify the request goes to port 4111

In browser DevTools → Network, you should see:

- `POST http://localhost:4111/api/agents/multiWeatherAgent/stream`

### Verify the tool runs on the client

Still in DevTools → Network, you should see requests to Open-Meteo (from the browser), for example:

- `https://geocoding-api.open-meteo.com/...`
- `https://api.open-meteo.com/...`

Those requests confirm `get-weather` is executed client-side via `clientTools` while the agent response is streamed.

## Troubleshooting

- If the UI says “Please add at least 3 locations.”, add more tags (type a city and press Enter).
- If you see `EADDRINUSE` for port `4111`, stop the existing process using that port and rerun `pnpm dev`.

