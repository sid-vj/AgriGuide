import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

async function fetchRealtimeWeather(lat: number, lon: number) {
  try {
    const API_KEY = process.env.WEATHER_API_KEY;
    if (!API_KEY) return null;

    const res = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${API_KEY}&q=${lat},${lon}`,
      { cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.current;
  } catch (error) {
    return null;
  }
}

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('agritech');

    // Fetch logs sorted by timestamp descending, limit to last 100 for performance
    const logs = await db.collection('sms_logs').find({}).sort({ timestamp: -1 }).limit(100).toArray();

    return NextResponse.json(logs.reverse()); // Reverse back so frontend slice().reverse() works as before, or frontend can just map it.
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const isManualAlert = body.type === 'manual';
    const manualMessage = body.message || '';

    const client = await clientPromise;
    const db = client.db('agritech');

    const farmers = await db.collection('farmers').find({}).toArray();
    const newLogs = [];

    for (const farmer of farmers) {
      let messageToSend = null;

      if (isManualAlert) {
        messageToSend = `AGRIGUIDE GOVT ALERT: ${manualMessage}`;
      } else {
        // Automated Weather Check
        const weather = await fetchRealtimeWeather(farmer.lat, farmer.lon);
        if (weather) {
          if (weather.precip_mm > 5) {
            messageToSend = `AGRIGUIDE WEATHER: Heavy rain (${weather.precip_mm}mm) detected near your farm. Ensure proper drainage.`;
          } else if (weather.wind_kph > 30) {
            messageToSend = `AGRIGUIDE WEATHER: High winds (${weather.wind_kph}km/h) detected. Secure loose equipment.`;
          } else if (weather.temp_c > 40) {
            messageToSend = `AGRIGUIDE WEATHER: Heatwave conditions (${weather.temp_c}°C). Increase irrigation frequency today.`;
          }
        }

        // If no urgent weather alert, match against relevant policies/aids based on farmer's profile
        if (!messageToSend) {
          const irrigationStr = Array.isArray(farmer.irrigation) ? farmer.irrigation.join(',') : (farmer.irrigation || '');
          if (irrigationStr.includes('Rain-fed') || irrigationStr.includes('Canal')) {
            messageToSend = `GOVT AID: 80% PM-KUSUM subsidy available for Solar Water Pumps in your district. Apply at nearest CSC to secure irrigation.`;
          } else if (farmer.budget?.includes('Low')) {
            messageToSend = `GOVT SCHEME: New PM-Kisan Samman Nidhi installment has been released for small/marginal farmers. Check your linked bank account.`;
          } else if (farmer.goal?.includes('Soil Restoration')) {
            messageToSend = `GOVT AID: Paramparagat Krishi Vikas Yojana (PKVY) funding available for transitioning to Organic Farming. Contact block agriculture officer.`;
          } else if (farmer.equipment?.includes('Manual') || farmer.equipment?.includes('Bullocks')) {
            messageToSend = `GOVT SCHEME: Sub-Mission on Agricultural Mechanization (SMAM) offers up to 40% subsidy on tractor/rotavator purchases.`;
          }
        }
      }

      if (messageToSend) {
        newLogs.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          farmerId: farmer._id.toString(),
          farmerName: farmer.name,
          phone: farmer.phone,
          message: messageToSend,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (newLogs.length > 0) {
      await db.collection('sms_logs').insertMany(newLogs);
    }

    return NextResponse.json({ success: true, messagesSent: newLogs.length });
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: 'Failed to run notification job' }, { status: 500 });
  }
}
