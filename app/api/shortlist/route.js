import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';

async function getSessionId() {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get('sessionId')?.value;
  if (!sessionId) {
    sessionId = Math.random().toString(36).substring(2, 15); 
  }
  return sessionId;
}

const dataPath = path.join(process.cwd(), 'data', 'shortlists.json');
const carsDataPath = path.join(process.cwd(), 'data', 'cars.json');

function getShortlists() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {
    console.error(e);
  }
  return {};
}

function saveShortlists(data) {
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function GET(req) {
  try {
    const sessionId = await getSessionId();
    const shortlists = getShortlists();
    const userCarIds = shortlists[sessionId] || [];

    // Hydrate cars
    const allCars = JSON.parse(fs.readFileSync(carsDataPath, 'utf8'));
    const cars = allCars.filter(c => userCarIds.includes(c._id));

    return NextResponse.json({ cars, sessionId });
  } catch (error) {
    console.error("Shortlist GET Error:", error);
    return NextResponse.json({ error: 'Failed to fetch shortlist' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { carId, sessionId: reqSessionId } = await req.json();
    const sessionId = reqSessionId || await getSessionId();

    if (!carId) {
      return NextResponse.json({ error: 'carId is required' }, { status: 400 });
    }

    const shortlists = getShortlists();
    if (!shortlists[sessionId]) {
      shortlists[sessionId] = [];
    }

    if (!shortlists[sessionId].includes(carId)) {
      shortlists[sessionId].push(carId);
      saveShortlists(shortlists);
    }

    return NextResponse.json({ success: true, sessionId });
  } catch (error) {
    console.error("Shortlist POST Error:", error);
    return NextResponse.json({ error: 'Failed to save to shortlist' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const carId = searchParams.get('carId');
    const sessionId = searchParams.get('sessionId') || await getSessionId();

    if (!carId) {
      return NextResponse.json({ error: 'carId is required' }, { status: 400 });
    }

    const shortlists = getShortlists();
    if (shortlists[sessionId]) {
      shortlists[sessionId] = shortlists[sessionId].filter(id => id !== carId);
      saveShortlists(shortlists);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shortlist DELETE Error:", error);
    return NextResponse.json({ error: 'Failed to remove from shortlist' }, { status: 500 });
  }
}
