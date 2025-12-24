import { createDeepSeek } from '@ai-sdk/deepseek';

export function buildDeepSeekModelFrom(config: {
  model: string;
  apiKey: string;
  baseURL?: string;
}) {
  const { model, apiKey, baseURL } = config;

  const ds = baseURL
    ? createDeepSeek({ apiKey, baseURL })
    : createDeepSeek({ apiKey });

  return ds.chat(model);
}

export function deepseekModelFromEnv() {
  const envModel = process.env.MODEL;
  const envApiKey = process.env.API_KEY;
  if (!envModel) throw new Error('Missing MODEL env var.');
  if (!envApiKey) throw new Error('Missing API_KEY env var.');

  const model = envModel;
  const apiKey = envApiKey;
  const baseURL = process.env.BASE_URL;

  return buildDeepSeekModelFrom({ model, apiKey, baseURL });
}
