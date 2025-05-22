function calculateGenreScore(movieGenres, userGenrePrefs, maxScore = 10) {
  if (!Array.isArray(movieGenres) || movieGenres.length === 0) {
    console.log("🟠 [GENRE] No genres provided, returning 0.");
    return 0;
  }

  const matchedPrefs = movieGenres
    .map(genre => userGenrePrefs[genre])
    .filter(pref => pref !== undefined);

  if (matchedPrefs.length === 0) {
    console.log("🟠 [GENRE] No matching user prefs, returning neutral fallback.");
    return 5 / maxScore;
  }

  const baseAverage = matchedPrefs.reduce((sum, pref) => sum + pref, 0) / matchedPrefs.length;

  let bonusMultiplier = 1;
  let bonusReason = "";
  if (matchedPrefs.length >= 2 && baseAverage > 7) {
    bonusMultiplier = 1.1;
    bonusReason = "Strong multi-genre match bonus (1.1x)";
  } else if (matchedPrefs.length >= 2) {
    bonusMultiplier = 1.03;
    bonusReason = "Multi-genre match bonus (1.03x)";
  }

  const hasDisliked = matchedPrefs.some(pref => pref <= 3);
  let penaltyMultiplier = 1;
  let penaltyReason = "";
  if (hasDisliked) {
    penaltyMultiplier = 0.85;
    penaltyReason = "Penalty for disliked genre (0.85x)";
  }

  const boostedScore = Math.min(baseAverage * bonusMultiplier * penaltyMultiplier, maxScore);

  // Logging details
  console.log("🟢 [GENRE] Matched prefs:", matchedPrefs);
  console.log("🟢 [GENRE] Base average:", baseAverage.toFixed(2));
  if (bonusReason) console.log("🟢 [GENRE] Bonus applied:", bonusReason);
  if (penaltyReason) console.log("🟢 [GENRE] Penalty applied:", penaltyReason);
  console.log("🟢 [GENRE] Final genre score (0-1):", (boostedScore / maxScore).toFixed(3));

  return boostedScore / maxScore;
}

module.exports = { calculateGenreScore };
