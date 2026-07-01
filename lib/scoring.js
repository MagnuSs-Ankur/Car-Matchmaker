/**
 * Scores a dataset of cars based on structured preferences
 * 
 * @param {Array} cars - Array of car objects from MongoDB
 * @param {Object} preferences - The structured JSON intent extracted by LLM
 * @returns {Array} - Top 5 to 7 cars, ranked and scored
 */
export function scoreCars(cars, preferences) {
  if (!cars || cars.length === 0) return [];

  // Default preferences if LLM output is missing some fields
  const p = {
    budgetMax: preferences.budgetMax || Infinity,
    bodyTypes: preferences.bodyTypes || [],
    minSeating: preferences.minSeating || 1,
    mustHaveFeatures: preferences.mustHaveFeatures || [],
    priorityWeights: {
      safety: preferences.priorityWeights?.safety ?? 0.5,
      fuelEfficiency: preferences.priorityWeights?.fuelEfficiency ?? 0.5,
      performance: preferences.priorityWeights?.performance ?? 0.5,
      userSatisfaction: preferences.priorityWeights?.userSatisfaction ?? 0.5
    }
  };

  // Step 1: Hard Filters
  let filtered = cars.filter(car => {
    // Check Budget
    if (car.price > p.budgetMax) return false;

    // Check Body Type (if specified)
    if (p.bodyTypes.length > 0) {
      // Normalize body types to lowercase for matching
      const allowedBodies = p.bodyTypes.map(b => b.toLowerCase());
      if (!allowedBodies.includes(car.specs.bodyType.toLowerCase())) {
        return false;
      }
    }

    // Check minimum seating
    if (car.specs.seating < p.minSeating) return false;

    // Check must-have features
    if (p.mustHaveFeatures.length > 0) {
      const carFeatures = car.specs.features.map(f => f.toLowerCase());
      const hasAll = p.mustHaveFeatures.every(mf => carFeatures.includes(mf.toLowerCase()));
      if (!hasAll) return false;
    }

    return true;
  });

  if (filtered.length === 0) return [];

  // Step 2: Calculate Min/Max for Normalization
  let minMax = {
    safety: { min: Infinity, max: -Infinity },
    fuel: { min: Infinity, max: -Infinity },
    perf: { min: Infinity, max: -Infinity },
    sat: { min: Infinity, max: -Infinity },
  };

  filtered.forEach(car => {
    // Safety
    if (car.safetyRating < minMax.safety.min) minMax.safety.min = car.safetyRating;
    if (car.safetyRating > minMax.safety.max) minMax.safety.max = car.safetyRating;

    // Fuel Efficiency (MPG)
    if (car.mileage < minMax.fuel.min) minMax.fuel.min = car.mileage;
    if (car.mileage > minMax.fuel.max) minMax.fuel.max = car.mileage;

    // Performance (HP)
    if (car.specs.horsepower < minMax.perf.min) minMax.perf.min = car.specs.horsepower;
    if (car.specs.horsepower > minMax.perf.max) minMax.perf.max = car.specs.horsepower;

    // User Satisfaction
    const sat = car.userReviews.averageScore;
    if (sat < minMax.sat.min) minMax.sat.min = sat;
    if (sat > minMax.sat.max) minMax.sat.max = sat;
  });

  // Helper to normalize 0 to 1
  const normalize = (val, min, max) => {
    if (max === min) return 1; // if all cars have the same value, give full score for that dimension
    return (val - min) / (max - min);
  };

  const weightsSum = p.priorityWeights.safety + 
                     p.priorityWeights.fuelEfficiency + 
                     p.priorityWeights.performance + 
                     p.priorityWeights.userSatisfaction;

  // Step 3: Compute Score
  let scoredCars = filtered.map(car => {
    const normSafety = normalize(car.safetyRating, minMax.safety.min, minMax.safety.max);
    const normFuel = normalize(car.mileage, minMax.fuel.min, minMax.fuel.max);
    const normPerf = normalize(car.specs.horsepower, minMax.perf.min, minMax.perf.max);
    const normSat = normalize(car.userReviews.averageScore, minMax.sat.min, minMax.sat.max);

    let baseScore = 0;
    if (weightsSum > 0) {
      baseScore = (
        (normSafety * p.priorityWeights.safety) +
        (normFuel * p.priorityWeights.fuelEfficiency) +
        (normPerf * p.priorityWeights.performance) +
        (normSat * p.priorityWeights.userSatisfaction)
      ) / weightsSum;
    } else {
      // Fallback if weights are all 0
      baseScore = (normSafety + normFuel + normPerf + normSat) / 4;
    }

    let finalScore = baseScore * 100;

    return {
      ...car.toObject ? car.toObject() : car, // handle mongoose document
      matchScore: finalScore
    };
  });

  // Step 4: Sort Descending
  scoredCars.sort((a, b) => b.matchScore - a.matchScore);

  // Return Top 5 to 7. 
  // We'll just return top 5, but if the 6th and 7th have scores very close to the 5th (within 2 points), include them.
  let topCandidates = scoredCars.slice(0, 5);
  
  if (scoredCars.length > 5) {
    const fifthScore = topCandidates[4].matchScore;
    for (let i = 5; i < Math.min(scoredCars.length, 7); i++) {
      if (Math.abs(fifthScore - scoredCars[i].matchScore) <= 2) {
        topCandidates.push(scoredCars[i]);
      } else {
        break;
      }
    }
  }

  return topCandidates;
}
