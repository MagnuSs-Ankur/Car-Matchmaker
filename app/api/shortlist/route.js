import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import path from 'path';
import fs from 'fs';

const SHORTLIST_COOKIE = 'car_shortlist';
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Reads the shortlisted car IDs from the request cookie.
 */
async function getShortlistedIds() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SHORTLIST_COOKIE)?.value;
  if (!raw) return [];
  try {
    return JSON.parse(decodeURIComponent(raw));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const ids = await getShortlistedIds();

    // Hydrate car objects from the dataset
    const dataPath = path.join(process.cwd(), 'data', 'cars.json');
    const allCars = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    const cars = allCars.filter(c => ids.includes(c._id));

    return NextResponse.json({ cars });
  } catch (error) {
    console.error('Shortlist GET Error:', error);
    return NextResponse.json({ error: 'Failed to fetch shortlist' }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { carId } = await req.json();
    if (!carId) {
      return NextResponse.json({ error: 'carId is required' }, { status: 400 });
    }

    const ids = await getShortlistedIds();
    if (!ids.includes(carId)) {
      ids.push(carId);
    }

    const res = NextResponse.json({ success: true });
    res.cookies.set(SHORTLIST_COOKIE, encodeURIComponent(JSON.stringify(ids)), {
      maxAge: MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return res;
  } catch (error) {
    console.error('Shortlist POST Error:', error);
    return NextResponse.json({ error: 'Failed to save to shortlist' }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const carId = searchParams.get('carId');
    if (!carId) {
      return NextResponse.json({ error: 'carId is required' }, { status: 400 });
    }

    const ids = await getShortlistedIds();
    const updated = ids.filter(id => id !== carId);

    const res = NextResponse.json({ success: true });
    res.cookies.set(SHORTLIST_COOKIE, encodeURIComponent(JSON.stringify(updated)), {
      maxAge: MAX_AGE,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return res;
  } catch (error) {
    console.error('Shortlist DELETE Error:', error);
    return NextResponse.json({ error: 'Failed to remove from shortlist' }, { status: 500 });
  }
}
