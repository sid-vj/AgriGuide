import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), '../datas/farmers.json');

// Ensure DB file exists
function ensureDB() {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
  }
}

export async function GET() {
  ensureDB();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const farmers = JSON.parse(data);
    return NextResponse.json(farmers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  ensureDB();
  try {
    const body = await request.json();
    
    if (!body.name || !body.phone || !body.lat || !body.lon) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const data = fs.readFileSync(DB_PATH, 'utf-8');
    const farmers = JSON.parse(data);
    
    // Check if farmer with this phone already exists, if so update them
    const existingIndex = farmers.findIndex((f: any) => f.phone === body.phone);
    
    const farmerRecord = {
      id: Date.now().toString(),
      name: body.name,
      phone: body.phone,
      lat: body.lat,
      lon: body.lon,
      landSize: body.landSize,
      landUnit: body.landUnit,
      irrigation: body.irrigation,
      budget: body.budget,
      goal: body.goal,
      market: body.market,
      equipment: body.equipment,
      lastUpdated: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      farmerRecord.id = farmers[existingIndex].id; // preserve ID
      farmers[existingIndex] = farmerRecord;
    } else {
      farmers.push(farmerRecord);
    }

    fs.writeFileSync(DB_PATH, JSON.stringify(farmers, null, 2));

    return NextResponse.json({ success: true, farmer: farmerRecord });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to save farmer' }, { status: 500 });
  }
}
