import { GoogleGenerativeAI } from '@google/generative-ai';

function getModel(responseType = "text/plain") {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_api_key_here') {
    throw new Error('GEMINI_API_KEY is not configured in .env.local');
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);
  const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-pro';
  
  return genAI.getGenerativeModel({ 
    model: modelName,
    generationConfig: { responseMimeType: responseType }
  });
}

/**
 * Formats recent conversation turns into a concise context string.
 */
function formatHistory(history = []) {
  if (!history || history.length === 0) return '';
  return history.slice(-6)
    .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n');
}

/**
 * Extracts structured preferences from the user's message.
 *
 * If previousPreferences are provided (mid-conversation), the LLM treats them
 * as the baseline and only applies the delta the user described. This prevents
 * losing constraints like body type or seating when the user changes just the budget.
 */
export async function extractUserIntent({ prompt, useCase, budget, topPriority, history, previousPreferences }) {
  const model = getModel("application/json");

  const historyContext = formatHistory(history);
  const prevPrefsContext = previousPreferences
    ? `\nThe user's PREVIOUSLY EXTRACTED structured preferences were:\n${JSON.stringify(previousPreferences, null, 2)}\n
IMPORTANT: Start from these previous preferences and ONLY update the fields that the user's new message explicitly changes. Keep all other fields the same as before.`
    : '';

  const extractionPrompt = `
    You are an expert car matchmaker. Extract the user's CURRENT intent into a JSON object.
    ${historyContext ? `\nConversation context:\n${historyContext}\n` : ''}
    ${prevPrefsContext}

    Latest User Message: "${prompt}"
    Optional Use Case: "${useCase || 'None'}"
    Optional Budget: "${budget || 'None'}"
    Optional Top Priority: "${topPriority || 'None'}"

    Output EXACTLY this JSON structure, and nothing else:
    {
      "budgetMax": <number or 999999 if unspecified>,
      "bodyTypes": <array of strings, e.g., ["SUV", "Minivan", "Sedan", "Coupe", "Truck"] or [] if unspecified>,
      "minSeating": <number, default to 1>,
      "mustHaveFeatures": <array of strings, e.g. ["AWD", "Sunroof"] or []>,
      "priorityWeights": {
        "safety": <float 0 to 1>,
        "fuelEfficiency": <float 0 to 1>,
        "performance": <float 0 to 1>,
        "userSatisfaction": <float 0 to 1>
      }
    }

    Adjust the priorityWeights based on the user's focus. For example, if they mention family, safety should be high (0.9). If they mention fast/fun, performance should be high (0.9).
  `;

  const extractionResult = await model.generateContent(extractionPrompt);
  const extractionText = extractionResult.response.text();
  
  try {
    return JSON.parse(extractionText);
  } catch(e) {
    console.error("Failed to parse Gemini output:", extractionText);
    throw new Error('Failed to extract intent (invalid JSON)');
  }
}

/**
 * Selects the final top 3 candidates and generates a personalized summary.
 */
export async function refineRecommendations(prompt, topCandidates, history) {
  const model = getModel("application/json");

  const candidatesStr = topCandidates.map((c, index) => 
    `[${index + 1}] ${c.make} ${c.model} (${c.variant}) - $${c.price} - Body: ${c.specs.bodyType}, MPG: ${c.mileage}, HP: ${c.specs.horsepower}, Safety: ${c.safetyRating}, Reviews: ${c.userReviews.averageScore}/5. Features: ${c.specs.features.join(', ')}`
  ).join('\n');

  const historyContext = formatHistory(history);

  const refinementPrompt = `
    You are an expert car matchmaker having a conversation with a buyer.
    ${historyContext ? `\nConversation history:\n${historyContext}\n` : ''}
    Latest user request: "${prompt}"

    Here are the top candidates that passed our strict filters, ranked by our algorithm:
    ${candidatesStr}

    Pick exactly the TOP 3 best matches for this specific user. (If there are fewer than 3 candidates, pick all of them).
    For each of the final picks, write a 2-sentence explanation referencing the user's own words and needs.
    If this is a follow-up (e.g., they said "cheaper" or "sportier"), acknowledge the refinement naturally in the reasoning.

    Return ONLY a JSON array of objects with the exact structure:
    [
      {
        "make": "Make of car",
        "model": "Model of car",
        "variant": "Variant of car",
        "reasoning": "Your 2-sentence explanation."
      }
    ]
  `;

  const refinementResult = await model.generateContent(refinementPrompt);
  const refinementText = refinementResult.response.text();
  
  try {
    return JSON.parse(refinementText);
  } catch(e) {
    console.error("Failed to parse refinement output:", refinementText);
    throw new Error('Failed to generate recommendations (invalid JSON)');
  }
}
