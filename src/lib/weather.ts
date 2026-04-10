export interface WeatherSummary {
  locationName: string;
  temperatureMax: number | null;
  temperatureMin: number | null;
  apparentTemperatureMax: number | null;
  precipitationProbabilityMax: number | null;
  weatherCode: number | null;
  conditionLabel: string;
  icon: "sun" | "cloud-sun" | "cloud" | "rain" | "storm" | "snow" | "fog";
}

export interface HubLocationSettings {
  weatherLocationMode?: "hub" | "user";
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
}

type GeocodeResponse = {
  results?: Array<{
    name?: string;
    admin1?: string;
    country?: string;
    timezone?: string;
  }>;
};

type OpenMeteoForecastResponse = {
  daily?: {
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    apparent_temperature_max?: number[];
    precipitation_probability_max?: number[];
  };
};

function getWeatherPresentation(weatherCode: number | null) {
  if (weatherCode === null) {
    return { conditionLabel: "Forecast unavailable", icon: "cloud" as const };
  }

  if (weatherCode === 0) return { conditionLabel: "Clear skies", icon: "sun" as const };
  if ([1, 2].includes(weatherCode)) return { conditionLabel: "Mostly sunny", icon: "cloud-sun" as const };
  if (weatherCode === 3) return { conditionLabel: "Overcast", icon: "cloud" as const };
  if ([45, 48].includes(weatherCode)) return { conditionLabel: "Foggy", icon: "fog" as const };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(weatherCode)) {
    return { conditionLabel: "Rain expected", icon: "rain" as const };
  }
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) {
    return { conditionLabel: "Snow expected", icon: "snow" as const };
  }
  if ([95, 96, 99].includes(weatherCode)) {
    return { conditionLabel: "Stormy", icon: "storm" as const };
  }

  return { conditionLabel: "Cloudy", icon: "cloud" as const };
}

function formatLocation(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(", ");
}

export async function reverseGeocodeLocation(latitude: number, longitude: number) {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/reverse");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;

    const geocode = (await res.json()) as GeocodeResponse;
    const match = geocode.results?.[0];
    if (!match) return null;

    return {
      locationName: formatLocation([match.name, match.admin1, match.country]) || "Current location",
      timezone: match.timezone ?? null,
    };
  } catch {
    return null;
  }
}

export async function getTodayWeather(
  settings: HubLocationSettings
): Promise<WeatherSummary | null> {
  if (
    !settings.locationName
    || settings.latitude === null
    || settings.longitude === null
  ) {
    return null;
  }

  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(settings.latitude));
    url.searchParams.set("longitude", String(settings.longitude));
    url.searchParams.set(
      "daily",
      [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "apparent_temperature_max",
        "precipitation_probability_max",
      ].join(",")
    );
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("precipitation_unit", "inch");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("timezone", settings.timezone ?? "auto");
    url.searchParams.set("forecast_days", "1");

    const res = await fetch(url.toString(), { next: { revalidate: 1800 } });
    if (!res.ok) return null;

    const data = (await res.json()) as OpenMeteoForecastResponse;
    const weatherCode = data.daily?.weather_code?.[0] ?? null;
    const presentation = getWeatherPresentation(weatherCode);

    return {
      locationName: settings.locationName,
      temperatureMax: data.daily?.temperature_2m_max?.[0] ?? null,
      temperatureMin: data.daily?.temperature_2m_min?.[0] ?? null,
      apparentTemperatureMax: data.daily?.apparent_temperature_max?.[0] ?? null,
      precipitationProbabilityMax: data.daily?.precipitation_probability_max?.[0] ?? null,
      weatherCode,
      conditionLabel: presentation.conditionLabel,
      icon: presentation.icon,
    };
  } catch {
    return null;
  }
}
