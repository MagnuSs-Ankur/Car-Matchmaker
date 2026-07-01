import { NextResponse } from 'next/server';
import { scoreCars } from '../../../lib/scoring';
import { extractUserIntent, refineRecommendations } from '../../../lib/ai';
import fs from 'fs';
import path from 'path';

export async function POST(req) {
  try {
    const { prompt, useCase, budget, topPriority, history, previousPreferences } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // STAGE 1: Intent Extraction
    // Pass previousPreferences so the LLM can apply changes on top of the
    // existing structured baseline instead of re-inferring everything from text.
    let preferences;
    try {
      preferences = await extractUserIntent({ prompt, useCase, budget, topPriority, history, previousPreferences });
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // STAGE 2: Deterministic Scoring — always runs on the full dataset
    const dataPath = path.join(process.cwd(), 'data', 'cars.json');
    const carsData = fs.readFileSync(dataPath, 'utf8');
    const allCars = JSON.parse(carsData);
    
    const topCandidates = scoreCars(allCars, preferences);

    if (topCandidates.length === 0) {
      // Return the new preferences even on empty match, so the frontend can
      // use it as the base for the next refinement attempt.
      return NextResponse.json({ 
        matches: [], 
        preferences,
        message: "No cars matched your criteria. Try a higher budget, different body type, or fewer must-have features." 
      });
    }

    // STAGE 3: LLM Refinement & Explanation
    let finalPicks;
    try {
      finalPicks = await refineRecommendations(prompt, topCandidates, history);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const matches = finalPicks.map(pick => {
      const fullCar = topCandidates.find(c => c.make === pick.make && c.model === pick.model && c.variant === pick.variant);
      if (!fullCar) return null;
      return {
        ...fullCar,
        aiReasoning: pick.reasoning
      };
    }).filter(Boolean);

    // Return both matches AND the freshly extracted preferences.
    // The frontend stores preferences and sends them back on the next turn.
    return NextResponse.json({ matches, preferences });

  } catch (error) {
    console.error("Recommend API Error:", error);
    return NextResponse.json({ error: 'An unexpected error occurred' }, { status: 500 });
  }
}
