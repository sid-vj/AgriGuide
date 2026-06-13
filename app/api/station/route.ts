import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Haversine formula to calculate distance between two coordinates in kilometers
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Global cache for the parsed CSV
let stationDataCache: any[] | null = null;

function loadCSV() {
  if (stationDataCache) return stationDataCache;

  const candidates = [
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../datas/agritech_station_database.csv'),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'datas/agritech_station_database.csv'),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), '../Downloads/datas/agritech_station_database.csv'),
    path.resolve(/*turbopackIgnore: true*/ process.cwd(), 'Downloads/datas/agritech_station_database.csv'),
    '/Users/sanjeev/Downloads/datas/agritech_station_database.csv'
  ];

  let csvPath = '';
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      csvPath = candidate;
      break;
    }
  }

  if (!csvPath) {
    console.error('Failed to locate agritech_station_database.csv in candidates:', candidates);
    return [];
  }

  try {
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim() !== '');
    const headers = lines[0].split(',');

    const parsed = lines.slice(1).map(line => {
      const values = line.split(',');
      const record: any = {};
      headers.forEach((header, i) => {
        const val = values[i];
        // Parse numeric values where applicable
        if (header === 'latitude' || header === 'longitude' || header === 'mean_rainfall' ||
          header === 'soil_ph' || header === 'soil_phaq' || header === 'soil_orgc' || header.includes('pct') || header.includes('depth') || header.includes('t2m')) {
          record[header] = parseFloat(val);
        } else {
          record[header] = val;
        }
      });
      return record;
    });

    stationDataCache = parsed;
    return parsed;
  } catch (error) {
    console.error('Failed to load CSV:', error);
    return [];
  }
}

function safeFloat(val: any) {
  if (val === undefined || val === null) return undefined;
  const num = parseFloat(val);
  return isNaN(num) ? undefined : num;
}

async function fetchGovtSoilData(lat: number, lon: number) {
  try {
    const delta = 0.01;
    const minLon = lon - delta;
    const minLat = lat - delta;
    const maxLon = lon + delta;
    const maxLat = lat + delta;
    const bbox = `${minLon},${minLat},${maxLon},${maxLat}`;

    const baseUrl = "https://soilhealth.dac.gov.in/jW8X3zM5Y7pQvLr4K2Tn6HqPbD0tZmN9R6JfO1wCiG8xV5eTk2CdMoF9YsQr0Z7LmN1YxU4pTb2K5LvHqX7F3aCmGzR4Pw0D8UtYnJ9oZ2SvNlQ7Tz1PjR5LcX0Qf8HkV9OrG4V7YxU3pJk6TnMm5CdX8B9tRi1Lw2Qn7F4ZzJk8WvP1GrZ6Sx0JoH5C3oV7fNi2/shc/wms/wms";
    const layer = "33_730_shc_2024-25";

    const url = new URL(baseUrl);
    url.searchParams.append("service", "WMS");
    url.searchParams.append("version", "1.1.1");
    url.searchParams.append("request", "GetFeatureInfo");
    url.searchParams.append("layers", layer);
    url.searchParams.append("query_layers", layer);
    url.searchParams.append("bbox", bbox);
    url.searchParams.append("width", "101");
    url.searchParams.append("height", "101");
    url.searchParams.append("X", "50");
    url.searchParams.append("Y", "50");
    url.searchParams.append("info_format", "application/json");
    url.searchParams.append("HIDE_GEOMETRY", "true");

    const response = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;

    const data = await response.json();
    const features = data.features || [];
    if (features.length === 0) return null;

    const props = features[0].properties;
    if (!props) return null;

    return {
      n_avail: safeFloat(props.N_AVAIL || props.n_avail),
      p_avail: safeFloat(props.P_AVAIL || props.p_avail),
      k_avail: safeFloat(props.K_AVAIL || props.k_avail),
      ph_govt: safeFloat(props.PH || props.ph),
      oc_govt: safeFloat(props.OC || props.oc),
      ec_govt: safeFloat(props.EC || props.ec)
    };
  } catch (error) {
    console.warn("WMS fetch failed:", error);
    return null;
  }
}

async function fetchRealtimeWeather(lat: number, lon: number) {
  try {
    const API_KEY = process.env.WEATHER_API_KEY;
    if (!API_KEY) {
      console.warn("WEATHER_API_KEY is not defined in environment variables");
      return null;
    }

    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${lat},${lon}`,
      { next: { revalidate: 300 } }
    );

    if (!res.ok) return null;
    const data = await res.json();
    if (!data.current) return null;

    return {
      current_temp: data.current.temp_c,
      current_humidity: data.current.humidity,
      current_precip: data.current.precip_mm,
      current_wind: data.current.wind_kph
    };
  } catch (error) {
    console.warn("Weather fetch failed:", error);
    return null;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const latStr = searchParams.get('lat');
  const lonStr = searchParams.get('lon');

  if (!latStr || !lonStr) {
    return NextResponse.json({ error: 'Latitude and Longitude are required' }, { status: 400 });
  }

  const userLat = parseFloat(latStr);
  const userLon = parseFloat(lonStr);

  const stations = loadCSV();
  if (!stations.length) {
    return NextResponse.json({ error: 'Internal database error' }, { status: 500 });
  }

  let nearestStation = null;
  let minDistance = Infinity;

  for (const station of stations) {
    // Basic bounding box check to optimize if needed, but array is small (around 1.4MB text, maybe 10k rows)
    const dist = getDistanceFromLatLonInKm(userLat, userLon, station.latitude, station.longitude);
    if (dist < minDistance) {
      minDistance = dist;
      nearestStation = station;
    }
  }

  // Use a reasonable threshold, e.g. 100km max.
  const MAX_DISTANCE_KM = 100;

  if (minDistance > MAX_DISTANCE_KM) {
    return NextResponse.json({
      available: false,
      message: `No environmental data available within ${MAX_DISTANCE_KM}km. Closest is ${Math.round(minDistance)}km away.`,
      nearestDistance: minDistance
    });
  }

  // Attempt to augment with live Government WMS data
  const govtData = await fetchGovtSoilData(userLat, userLon);
  if (govtData) {
    nearestStation = { ...nearestStation, ...govtData };
  }

  // Attempt to augment with real-time weather data
  const weatherData = await fetchRealtimeWeather(userLat, userLon);
  if (weatherData) {
    nearestStation = { ...nearestStation, ...weatherData };
  }

  return NextResponse.json({
    available: true,
    distanceKm: Math.round(minDistance * 10) / 10,
    data: nearestStation
  });
}
