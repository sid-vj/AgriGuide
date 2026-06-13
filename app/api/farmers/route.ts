import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('agritech');
    
    const farmers = await db.collection('farmers').find({}).toArray();
    
    // Map _id back to id for frontend compatibility if needed, though they also have 'id'
    return NextResponse.json(farmers);
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: 'Failed to read database' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    if (!body.name || !body.phone || !body.lat || !body.lon) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db('agritech');
    
    const farmerRecord = {
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

    // Upsert based on phone number
    const result = await db.collection('farmers').findOneAndUpdate(
      { phone: body.phone },
      { 
        $set: farmerRecord,
        $setOnInsert: { id: Date.now().toString() }
      },
      { upsert: true, returnDocument: 'after' }
    );

    return NextResponse.json({ success: true, farmer: result });
  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ error: 'Failed to save farmer' }, { status: 500 });
  }
}
