export type WeatherToolInput = {
  location: string;
};

export type WeatherToolOutput = {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  windGust: number;
  conditions: string;
  location: string;
};

type GeocodingResponse = {
  results?: Array<{
    latitude: number;
    longitude: number;
    name: string;
  }>;
};

type WeatherResponse = {
  current: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    wind_speed_10m: number;
    wind_gusts_10m: number;
    weather_code: number;
  };
};

function getWeatherCondition(code: number): string {
  const conditions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Depositing rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    56: 'Light freezing drizzle',
    57: 'Dense freezing drizzle',
    61: 'Slight rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Heavy freezing rain',
    71: 'Slight snowfall',
    73: 'Moderate snowfall',
    75: 'Heavy snowfall',
    77: 'Snow grains',
    80: 'Slight rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Slight snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return conditions[code] ?? 'Unknown';
}

export const weatherTool = {
  id: 'get-weather',
  description: 'Get current weather for a location',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      location: { type: 'string', description: 'City name' },
    },
    required: ['location'],
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      temperature: { type: 'number' },
      feelsLike: { type: 'number' },
      humidity: { type: 'number' },
      windSpeed: { type: 'number' },
      windGust: { type: 'number' },
      conditions: { type: 'string' },
      location: { type: 'string' },
    },
    required: [
      'temperature',
      'feelsLike',
      'humidity',
      'windSpeed',
      'windGust',
      'conditions',
      'location',
    ],
  },
  execute: async (args: WeatherToolInput): Promise<WeatherToolOutput> => {
    const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(args.location)}&count=1`;
    const geoRes = await fetch(geocodingUrl);
    const geo = (await geoRes.json()) as GeocodingResponse;

    const best = geo.results?.[0];
    if (!best) {
      throw new Error(`Location not found: ${args.location}`);
    }

    const weatherUrl =
      `https://api.open-meteo.com/v1/forecast?latitude=${best.latitude}&longitude=${best.longitude}` +
      `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,wind_gusts_10m,weather_code`;
    const wxRes = await fetch(weatherUrl);
    const wx = (await wxRes.json()) as WeatherResponse;

    return {
      temperature: wx.current.temperature_2m,
      feelsLike: wx.current.apparent_temperature,
      humidity: wx.current.relative_humidity_2m,
      windSpeed: wx.current.wind_speed_10m,
      windGust: wx.current.wind_gusts_10m,
      conditions: getWeatherCondition(wx.current.weather_code),
      location: best.name,
    };
  },
};

