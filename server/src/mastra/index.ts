import { Mastra } from '@mastra/core/mastra';
import { multiWeatherAgent } from './agents/multi-weather-agent';

export const mastra = new Mastra({
  agents: { multiWeatherAgent },
});
