import type { SupabaseClient } from "@supabase/supabase-js";

type Match = {
  id: number;
  home_score: number;
  away_score: number;
};

type Prediction = {
  id: number;
  match_id: number;
  home_score: number;
  away_score: number;
  points: number;
};

function getOutcome(
  homeScore: number,
  awayScore: number
): "1" | "X" | "2" {
  if (homeScore > awayScore) {
    return "1";
  }

  if (homeScore < awayScore) {
    return "2";
  }

  return "X";
}

export function calculatePoints(
  predictionHome: number,
  predictionAway: number,
  actualHome: number,
  actualAway: number
): number {
  if (
    predictionHome === actualHome &&
    predictionAway === actualAway
  ) {
    return 3;
  }

  const predictedOutcome = getOutcome(
    predictionHome,
    predictionAway
  );

  const actualOutcome = getOutcome(
    actualHome,
    actualAway
  );

  if (predictedOutcome === actualOutcome) {
    return 1;
  }

  return 0;
}

export async function scoreRound(
  supabase: SupabaseClient,
  roundId: number
) {
  const { data: matches, error: matchesError } =
    await supabase
      .from("matches")
      .select("id, home_score, away_score")
      .eq("round_id", roundId)
      .eq("status", "FINISHED");

  if (matchesError) {
    throw matchesError;
  }

  const finishedMatches = (matches ?? []).filter(
    (
      match
    ): match is Match =>
      match.home_score !== null &&
      match.away_score !== null
  );

  if (finishedMatches.length === 0) {
    return {
      finished_matches: 0,
      evaluated_predictions: 0,
      updated_predictions: 0,
    };
  }

  const matchIds = finishedMatches.map(
    (match) => match.id
  );

  const {
    data: predictions,
    error: predictionsError,
  } = await supabase
    .from("predictions")
    .select(
      "id, match_id, home_score, away_score, points"
    )
    .in("match_id", matchIds);

  if (predictionsError) {
    throw predictionsError;
  }

  const matchesById = new Map(
    finishedMatches.map((match) => [
      match.id,
      match,
    ])
  );

  let evaluatedPredictions = 0;
  let updatedPredictions = 0;

  for (const prediction of
    (predictions ?? []) as Prediction[]) {
    const match = matchesById.get(
      prediction.match_id
    );

    if (!match) {
      continue;
    }

    evaluatedPredictions++;

    const points = calculatePoints(
      prediction.home_score,
      prediction.away_score,
      match.home_score,
      match.away_score
    );

    /*
     * Evita una scrittura inutile se il punteggio
     * è già corretto.
     */
    if (prediction.points === points) {
      continue;
    }

    const { error: updateError } =
      await supabase
        .from("predictions")
        .update({
          points,
          updated_at: new Date().toISOString(),
        })
        .eq("id", prediction.id);

    if (updateError) {
      throw updateError;
    }

    updatedPredictions++;
  }

  return {
    finished_matches: finishedMatches.length,
    evaluated_predictions: evaluatedPredictions,
    updated_predictions: updatedPredictions,
  };
}