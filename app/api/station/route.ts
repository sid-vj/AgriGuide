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

  // Since web is inside agritech, the datas directory is at ../datas
  const csvPath = path.resolve(process.cwd(), '../datas/agritech_station_database.csv');
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

  return NextResponse.json({
    available: true,
    distanceKm: Math.round(minDistance * 10) / 10,
    data: nearestStation
  });
}
