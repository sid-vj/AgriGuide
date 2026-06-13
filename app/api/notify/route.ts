import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), '../datas/farmers.json');
const SMS_LOG_PATH = path.resolve(process.cwd(), '../datas/sms_logs.json');

function ensureFiles() {
  if (!fs.existsSync(DB_PATH)) fs.writeFileSync(DB_PATH, JSON.stringify([]));
  if (!fs.existsSync(SMS_LOG_PATH)) fs.writeFileSync(SMS_LOG_PATH, JSON.stringify([]));
}

async function fetchRealtimeWeather(lat: number, lon: number) {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.current;
  } catch (error) {
    return null;
  }
}

export async function GET() {
  ensureFiles();
  try {
    const data = fs.readFileSync(SMS_LOG_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read logs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  ensureFiles();
  try {
    const body = await request.json();
    const isManualAlert = body.type === 'manual';
    const manualMessage = body.message || '';

    const farmersData = fs.readFileSync(DB_PATH, 'utf-8');
    const farmers = JSON.parse(farmersData);
    
    const logsData = fs.readFileSync(SMS_LOG_PATH, 'utf-8');
    const smsLogs = JSON.parse(logsData);

    let messagesSent = 0;

    for (const farmer of farmers) {
      let messageToSend = null;

      if (isManualAlert) {
        messageToSend = `AGRIGUIDE GOVT ALERT: ${manualMessage}`;
      } else {
        // Automated Weather Check
        const weather = await fetchRealtimeWeather(farmer.lat, farmer.lon);
        if (weather) {
          if (weather.precipitation > 5) {
            messageToSend = `AGRIGUIDE WEATHER: Heavy rain (${weather.precipitation}mm) detected near your farm. Ensure proper drainage.`;
          } else if (weather.wind_speed_10m > 30) {
            messageToSend = `AGRIGUIDE WEATHER: High winds (${weather.wind_speed_10m}km/h) detected. Secure loose equipment.`;
          } else if (weather.temperature_2m > 40) {
            messageToSend = `AGRIGUIDE WEATHER: Heatwave conditions (${weather.temperature_2m}°C). Increase irrigation frequency today.`;
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
        smsLogs.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          farmerId: farmer.id,
          farmerName: farmer.name,
          phone: farmer.phone,
          message: messageToSend,
          timestamp: new Date().toISOString()
        });
        messagesSent++;
      }
    }

    fs.writeFileSync(SMS_LOG_PATH, JSON.stringify(smsLogs, null, 2));

    return NextResponse.json({ success: true, messagesSent });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to run notification job' }, { status: 500 });
  }
}
