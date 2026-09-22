type FootballDataMatch = {
  id: number;
  utcDate: string;
  status: string;
  matchday: number | null;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
  };
  score: {
    winner: string | null;
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
      home: number | null;
      away: number | null;
    };
  };
};

type FootballDataResponse = {
  matches: FootballDataMatch[];
};

export async function getSerieAMatches() {
  const apiKey =
    process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    throw new Error(
      "FOOTBALL_DATA_API_KEY non configurata"
    );
  }

  const response = await fetch(
    "https://api.football-data.org/v4/competitions/SA/matches",
    {
      headers: {
        "X-Auth-Token": apiKey,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      `Football-data.org error: ${response.status} ${response.statusText}`
    );
  }

  const data: FootballDataResponse =
    await response.json();

  return data.matches;
}