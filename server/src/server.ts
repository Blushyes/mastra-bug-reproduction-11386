import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context as HonoContext } from 'hono';
import { MastraServer, redactStreamChunk } from '@mastra/server/server-adapter';
import type { ServerRoute } from '@mastra/server/server-adapter';
import { mastra } from './mastra/index';

class MastraHonoServer extends MastraServer<Hono, HonoContext, HonoContext> {
  registerContextMiddleware(): void {
    // No-op: we pass mastra/requestContext directly to route handlers.
  }

  registerAuthMiddleware(): void {
    // No-op: local dev server without auth.
  }

  async getParams(_route: ServerRoute<any, any, any>, request: HonoContext) {
    const urlParams = request.req.param() as Record<string, string>;
    const queryParams = request.req.query() as Record<string, string>;

    let body: unknown = undefined;
    const method = request.req.method.toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      const contentType = request.req.header('content-type') ?? '';
      if (contentType.includes('application/json')) {
        body = await request.req.json().catch(() => undefined);
      }
    }

    return { urlParams, queryParams, body };
  }

  async sendResponse(
    route: ServerRoute<any, any, any>,
    response: HonoContext,
    result: unknown,
  ) {
    if (result instanceof Response) return result;
    if (route.responseType === 'json') return response.json(result);
    return response.json(result);
  }

  async stream(
    route: ServerRoute<any, any, any>,
    _response: HonoContext,
    result: unknown,
  ) {
    const stream =
      result instanceof ReadableStream
        ? result
        : (result as any)?.fullStream instanceof ReadableStream
          ? (result as any).fullStream
          : undefined;

    if (!stream) {
      return new Response('Invalid stream response', { status: 500 });
    }

    const headers: Record<string, string> = {};
    if (route.streamFormat === 'sse') {
      headers['content-type'] = 'text/event-stream; charset=utf-8';
      headers['cache-control'] = 'no-cache, no-transform';
      headers['connection'] = 'keep-alive';
    } else {
      headers['content-type'] = 'application/octet-stream';
    }

    // NOTE: Mastra stream routes return a ReadableStream of chunk objects.
    // Node HTTP servers can only write bytes/strings, so we encode to SSE lines.
    if (route.streamFormat === 'sse') {
      const encoder = new TextEncoder();
      const reader = (stream as ReadableStream<any>).getReader();
      const shouldRedact = this.streamOptions?.redact !== false;

      const sseStream = new ReadableStream<Uint8Array>({
        start(controller) {
          void (async () => {
            try {
              while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                if (value instanceof Uint8Array) {
                  controller.enqueue(value);
                  continue;
                }

                const chunk = shouldRedact ? redactStreamChunk(value) : value;
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              }

              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            } catch (err) {
              controller.error(err);
            } finally {
              reader.releaseLock();
            }
          })();
        },
      });

      return new Response(sseStream, { status: 200, headers });
    }

    return new Response(stream as ReadableStream<any>, { status: 200, headers });
  }

  async registerRoute(
    app: Hono,
    route: ServerRoute<any, any, any>,
    { prefix }: { prefix?: string },
  ) {
    const method = route.method.toLowerCase() as 'get' | 'post' | 'put' | 'patch' | 'delete';
    const path = `${prefix ?? ''}${route.path}`;

    (app as any)[method](path, async (c: HonoContext) => {
      const { urlParams, queryParams, body } = await this.getParams(route, c);

      const parsedPathParams = await this.parsePathParams(route, urlParams);
      const parsedQueryParams = await this.parseQueryParams(route, queryParams);
      const parsedBody = await this.parseBody(route, body);

      const paramsRequestContext =
        (parsedQueryParams as any)?.requestContext &&
        typeof (parsedQueryParams as any).requestContext === 'object'
          ? (parsedQueryParams as any).requestContext
          : undefined;
      const bodyRequestContext =
        (parsedBody as any)?.requestContext && typeof (parsedBody as any).requestContext === 'object'
          ? (parsedBody as any).requestContext
          : undefined;

      const requestContext = this.mergeRequestContext({
        paramsRequestContext,
        bodyRequestContext,
      });

      const abortSignal = c.req.raw.signal;

      const result = await route.handler({
        ...(parsedPathParams ?? {}),
        ...(parsedQueryParams ?? {}),
        ...(parsedBody && typeof parsedBody === 'object' ? parsedBody : {}),
        mastra: this.mastra,
        requestContext,
        tools: this.tools,
        taskStore: this.taskStore,
        abortSignal,
      });

      if (route.responseType === 'stream') {
        return await this.stream(route, c, result);
      }

      return await this.sendResponse(route, c, result);
    });
  }
}

const app = new Hono();
app.use('*', cors());
app.get('/', (c) =>
  c.json({
    ok: true,
    hint: 'Mastra API is mounted under /api. Try GET /api/agents',
  }),
);

const server = new MastraHonoServer({
  app,
  mastra,
  // Note: @mastra/server routes already include "/api/*" paths.
  // Setting a prefix here would double-prefix them (e.g. "/api/api/agents").
  prefix: '',
  openapiPath: '/openapi.json',
});

await server.init();

const port = Number(process.env.PORT ?? 4111);
serve({ fetch: app.fetch, port });
console.log(`Mastra server listening on http://localhost:${port}`);
