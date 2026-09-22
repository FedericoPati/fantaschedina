"use client";

import { useEffect, useMemo, useState } from "react";


type Match = {
  id: number;
  round_id: number;
  home_team: string;
  away_team: string;
  kickoff: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

type Round = {
  id: number;
  round_number: number;
  first_match_start: string;
  locked: boolean;
};

type Player = {
  id: string;
  name: string;
};

type MeResponse = {
  success: boolean;
  player: Player;
  error?: string;
};

type PredictionInput = {
  home_score: string;
  away_score: string;
};

type SavedPrediction = {
  id: number;
  player_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  points: number;
  created_at: string;
  updated_at: string;
};

type RoundDetailResponse = {
  success?: boolean;
  round: Round | null;
  matches: Match[];
  error?: string;
};

type RoundsResponse = {
  success: boolean;
  rounds: Round[];
  error?: string;
};

type PlayersResponse = {
  success: boolean;
  locked: boolean;
  players: Player[];
  error?: string;
};

type RecentRound = {
  id: number;
  round_number: number;
};

type RecentRoundPoints = {
  round_id: number;
  round_number: number;
  points: number;
};

type Standing = {
  position: number;
  player_id: string;
  name: string;
  total_points: number;
  exact_scores: number;
  correct_outcomes: number;
  recent_round_points: RecentRoundPoints[];
};

type StandingsResponse = {
  success: boolean;
  recent_rounds: RecentRound[];
  standings: Standing[];
  error?: string;
};

type ActiveTab = "predictions" | "standings";

export default function Home() {
  const [currentPlayer, setCurrentPlayer] =
    useState<Player | null>(null);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("predictions");

  const [rounds, setRounds] = useState<Round[]>([]);

  const [selectedRoundId, setSelectedRoundId] =
    useState<number | null>(null);

  const [data, setData] =
    useState<RoundDetailResponse | null>(null);

  const [players, setPlayers] = useState<Player[]>([]);

  const [selectedPlayerId, setSelectedPlayerId] =
    useState("");

  const [predictions, setPredictions] = useState<
    Record<number, PredictionInput>
  >({});

  const [savedPredictions, setSavedPredictions] =
    useState<Record<number, SavedPrediction>>({});

  const [standings, setStandings] =
    useState<StandingsResponse | null>(null);

  const [loading, setLoading] = useState(true);

  const [roundLoading, setRoundLoading] =
    useState(false);

  const [standingsLoading, setStandingsLoading] =
    useState(false);

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  const [message, setMessage] =
    useState<string | null>(null);

  /*
   * Carica l'elenco delle giornate.
   */
  useEffect(() => {
    async function initialize() {
      try {
        const [meResponse, roundsResponse] =
          await Promise.all([
            fetch("/api/me", {
              cache: "no-store",
            }),
            fetch("/api/rounds"),
          ]);

        /*
        * Se non c'è una sessione valida,
        * mandiamo l'utente al login.
        */
        if (meResponse.status === 401) {
          window.location.href = "/login";
          return;
        }

        if (!meResponse.ok) {
          throw new Error(
            "Errore nel caricamento dell'utente."
          );
        }

        if (!roundsResponse.ok) {
          throw new Error(
            "Errore nel caricamento delle giornate."
          );
        }

        const meResult: MeResponse =
          await meResponse.json();

        const roundsResult: RoundsResponse =
          await roundsResponse.json();

        setCurrentPlayer(meResult.player);
        setSelectedPlayerId(meResult.player.id);

        const loadedRounds =
          roundsResult.rounds ?? [];

        setRounds(loadedRounds);

        const nextOpenRound = [...loadedRounds]
          .filter((round) => !round.locked)
          .sort(
            (a, b) =>
              a.round_number - b.round_number
          )[0];

        const latestLockedRound = [
          ...loadedRounds,
        ]
          .filter((round) => round.locked)
          .sort(
            (a, b) =>
              b.round_number - a.round_number
          )[0];

        const defaultRound =
          nextOpenRound ?? latestLockedRound;

        if (defaultRound) {
          setSelectedRoundId(defaultRound.id);
        }
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore nel caricamento."
        );
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  /*
   * Carica giornata + giocatori disponibili.
   */
  useEffect(() => {
    if (!selectedRoundId || !currentPlayer) {
      return;
    }

    const currentPlayerId = currentPlayer.id;

    async function loadRound() {
      setRoundLoading(true);
      setMessage(null);

      setSelectedPlayerId(currentPlayerId);

      try {
        const [roundResponse, playersResponse] =
          await Promise.all([
            fetch(`/api/rounds/${selectedRoundId}`),

            fetch(
              `/api/players?round_id=${selectedRoundId}`
            ),
          ]);

        if (!roundResponse.ok) {
          throw new Error(
            "Errore nel caricamento della giornata."
          );
        }

        if (!playersResponse.ok) {
          throw new Error(
            "Errore nel caricamento dei giocatori."
          );
        }

        const roundResult: RoundDetailResponse =
          await roundResponse.json();

        const playersResult: PlayersResponse =
          await playersResponse.json();

        setData(roundResult);

        setPlayers(playersResult.players ?? []);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore nel caricamento."
        );
      } finally {
        setRoundLoading(false);
      }
    }

    loadRound();
  }, [selectedRoundId, currentPlayer]);

  /*
   * Carica i pronostici del giocatore selezionato.
   */
  useEffect(() => {
    if (
      !selectedRoundId ||
      !selectedPlayerId ||
      !currentPlayer
    ) {
      return;
    }

    const currentPlayerId = currentPlayer.id;

    async function loadPredictions() {
      try {
        const response = await fetch(
         `/api/predictions?player_id=${selectedPlayerId}&round_id=${selectedRoundId}`
        );

        if (!response.ok) {
          const result = await response.json();

          throw new Error(
            result.error ||
              "Errore nel caricamento dei pronostici."
          );
        }

        const result = await response.json();

        const loaded: SavedPrediction[] =
          result.predictions ?? [];

        const predictionInputs: Record<
          number,
          PredictionInput
        > = {};

        const predictionMap: Record<
          number,
          SavedPrediction
        > = {};

        for (const prediction of loaded) {
          predictionInputs[prediction.match_id] = {
            home_score: String(
              prediction.home_score
            ),
            away_score: String(
              prediction.away_score
            ),
          };

          predictionMap[prediction.match_id] =
            prediction;
        }

        setPredictions(predictionInputs);
        setSavedPredictions(predictionMap);
      } catch (error) {
        setPredictions({});
        setSavedPredictions({});

        setMessage(
          error instanceof Error
            ? error.message
            : "Errore nel caricamento dei pronostici."
        );
      }
    }

    loadPredictions();
  }, [
    selectedRoundId,
    selectedPlayerId,
    currentPlayer,
  ]);
  /*
  * Aggiornamento live della giornata.
  *
  * NON chiama football-data.org.
  * Rilegge soltanto round + pronostici dal nostro DB.
  */
  useEffect(() => {
    if (
      activeTab !== "predictions" ||
      !selectedRoundId ||
      !selectedPlayerId ||
      !data?.round?.locked
    ) {
      return;
    }

    const hasUnfinishedMatches =
      data.matches.some(
        (match) => match.status !== "FINISHED"
      );

    if (!hasUnfinishedMatches) {
      return;
    }

    let cancelled = false;

    async function refreshLiveData() {
      /*
      * Se l'utente ha cambiato scheda/app,
      * evitiamo richieste inutili.
      */
      if (
        document.visibilityState !== "visible"
      ) {
        return;
      }

      try {
        const [
          roundResponse,
          predictionsResponse,
        ] = await Promise.all([
          fetch(
            `/api/rounds/${selectedRoundId}`,
            {
              cache: "no-store",
            }
          ),

          fetch(
            `/api/predictions?player_id=${selectedPlayerId}&round_id=${selectedRoundId}`,
            {
              cache: "no-store",
            }
          ),
        ]);

        if (
          !roundResponse.ok ||
          !predictionsResponse.ok
        ) {
          return;
        }

        const roundResult: RoundDetailResponse =
          await roundResponse.json();

        const predictionsResult =
          await predictionsResponse.json();

        if (cancelled) {
          return;
        }

        /*
        * Aggiorna risultati e status partite.
        */
        setData(roundResult);

        /*
        * Aggiorna punti del player selezionato.
        */
        const loaded: SavedPrediction[] =
          predictionsResult.predictions ?? [];

        const predictionInputs: Record<
          number,
          PredictionInput
        > = {};

        const predictionMap: Record<
          number,
          SavedPrediction
        > = {};

        for (const prediction of loaded) {
          predictionInputs[
            prediction.match_id
          ] = {
            home_score: String(
              prediction.home_score
            ),

            away_score: String(
              prediction.away_score
            ),
          };

          predictionMap[
            prediction.match_id
          ] = prediction;
        }

        setPredictions(predictionInputs);
        setSavedPredictions(predictionMap);
      } catch (error) {
        /*
        * Un errore temporaneo del polling
        * non deve rovinare la pagina.
        */
        console.error(
          "Live refresh failed:",
          error
        );
      }
    }

    /*
    * Ogni minuto.
    */
    const intervalId =
      window.setInterval(
        refreshLiveData,
        60_000
      );

    /*
    * Se l'utente torna sulla scheda
    * dopo averla lasciata in background,
    * aggiorniamo immediatamente.
    */
    function handleVisibilityChange() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        refreshLiveData();
      }
    }

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      cancelled = true;

      window.clearInterval(intervalId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    activeTab,
    selectedRoundId,
    selectedPlayerId,
    data?.round?.locked,
    data?.matches,
  ]);
  /*
   * Carica la classifica quando viene aperta
   * la relativa scheda.
   */
  useEffect(() => {
    if (activeTab !== "standings") {
      return;
    }

    async function loadStandings() {
      setStandingsLoading(true);
      setMessage(null);

      try {
        const response = await fetch(
          "/api/standings",
          {
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error(
            "Errore nel caricamento della classifica."
          );
        }

        const result: StandingsResponse =
          await response.json();

        setStandings(result);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Errore nel caricamento della classifica."
        );
      } finally {
        setStandingsLoading(false);
      }
    }

    loadStandings();
  }, [activeTab]);

  /*
   * Giornate passate:
   * ultima per prima.
   */
  const historicalRounds = useMemo(
    () =>
      [...rounds]
        .filter((round) => round.locked)
        .sort(
          (a, b) =>
            b.round_number - a.round_number
        ),
    [rounds]
  );

  /*
   * Mostra solamente la prossima
   * giornata aperta.
   */
  const nextOpenRound = useMemo(
    () =>
      [...rounds]
        .filter((round) => !round.locked)
        .sort(
          (a, b) =>
            a.round_number - b.round_number
        )[0] ?? null,
    [rounds]
  );

  const isOwnPredictions =
    selectedPlayerId === currentPlayer?.id;

  const hasSavedPredictions =
    Object.keys(savedPredictions).length > 0;

  const selectedPlayer =
    players.find(
      (player) =>
        player.id === selectedPlayerId
    );

  const showNoPredictionsMessage =
    Boolean(
      data?.round?.locked &&
        selectedPlayerId &&
        !hasSavedPredictions
    );


  const canEdit =
    Boolean(data?.round) &&
    !data?.round?.locked &&
    isOwnPredictions;

  const allPredictionsComplete = Boolean(
    data?.matches.length === 10 &&
      data.matches.every((match) => {
        const prediction = predictions[match.id];

        return (
          prediction &&
          prediction.home_score !== "" &&
          prediction.away_score !== ""
        );
      })
  );

  const totalPoints = Object.values(
    savedPredictions
  ).reduce(
    (total, prediction) =>
      total + (prediction.points ?? 0),
    0
  );

  const selectedPlayerName =
    players.find(
      (player) =>
        player.id === selectedPlayerId
    )?.name ?? "Giocatore";

  function updatePrediction(
    matchId: number,
    field: "home_score" | "away_score",
    value: string
  ) {
    if (!canEdit) {
      return;
    }

    setSaved(false);
    setMessage(null);

    if (!/^\d*$/.test(value)) {
      return;
    }

    if (value !== "" && Number(value) > 20) {
      return;
    }

    setPredictions((current) => ({
      ...current,

      [matchId]: {
        home_score:
          current[matchId]?.home_score ?? "",

        away_score:
          current[matchId]?.away_score ?? "",

        [field]: value,
      },
    }));
  }

  async function savePredictions() {
    if (
      !data?.matches ||
      !data.round ||
      !currentPlayer ||
      !allPredictionsComplete ||
      !canEdit
    ) {
      return;
    }

    setSaving(true);
    setSaved(false);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/predictions",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({

            predictions: data.matches.map(
              (match) => ({
                match_id: match.id,

                home_score: Number(
                  predictions[match.id]
                    .home_score
                ),

                away_score: Number(
                  predictions[match.id]
                    .away_score
                ),
              })
            ),
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Errore nel salvataggio."
        );
      }

      setSaved(true);

      setTimeout(() => {
        setSaved(false);
      }, 1500);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Errore nel salvataggio."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f6f6f4] px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-sm text-gray-500">
            Caricamento...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f6f4] px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-4xl">
        {/* HEADER */}
        <header className="mb-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                Serie A
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-gray-950 sm:text-4xl">
                Fantaschedina
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Pronostica. Segui. Scala la classifica.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2">
              {currentPlayer && (
                <span className="text-sm font-medium text-gray-600">
                  {currentPlayer.name}
                </span>
              )}

              <form
                action="/auth/signout"
                method="post"
              >
                <button
                  type="submit"
                  className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-gray-300 hover:text-gray-950"
                >
                  Esci
                </button>
              </form>
            </div>
          </div>
        </header>

        {/* NAVIGAZIONE */}
        <nav className="mb-7 rounded-2xl border border-black/5 bg-white p-1.5 shadow-sm">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() =>
                setActiveTab("predictions")
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "predictions"
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Pronostici
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("standings")
              }
              className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                activeTab === "standings"
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              Classifica
            </button>
          </div>
        </nav>

        {message && (
          <div className="mb-5 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {message}
          </div>
        )}

        {/* ===================================== */}
        {/* PRONOSTICI */}
        {/* ===================================== */}

        {activeTab === "predictions" && (
          <>
            {/* SELETTORE GIORNATA */}
            <section className="mb-6 rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Giornata
                  </p>

                  {data?.round && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold text-gray-950">
                        Giornata{" "}
                        {data.round.round_number}
                      </span>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          data.round.locked
                            ? "bg-gray-100 text-gray-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {data.round.locked
                          ? "Pronostici chiusi"
                          : "Pronostici aperti"}
                      </span>
                    </div>
                  )}
                </div>

                <select
                  value={selectedRoundId ?? ""}
                  onChange={(event) =>
                    setSelectedRoundId(
                      Number(event.target.value)
                    )
                  }
                  className="min-w-48 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                >
                  {nextOpenRound && (
                    <optgroup label="Da pronosticare">
                      <option
                        value={nextOpenRound.id}
                      >
                        Giornata{" "}
                        {
                          nextOpenRound.round_number
                        }{" "}
                        · Aperta
                      </option>
                    </optgroup>
                  )}

                  {historicalRounds.length >
                    0 && (
                    <optgroup label="Giornate precedenti">
                      {historicalRounds.map(
                        (round) => (
                          <option
                            key={round.id}
                            value={round.id}
                          >
                            Giornata{" "}
                            {
                              round.round_number
                            }
                          </option>
                        )
                      )}
                    </optgroup>
                  )}
                </select>
              </div>

              {/* GIOCATORE */}
        {data?.round?.locked &&
          players.length > 0 && (
            <div className="mt-4 border-t border-gray-100 pt-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm text-gray-500">
                  Pronostici di
                </span>

                <select
                  value={selectedPlayerId}
                  onChange={(event) => {
                    setSelectedPlayerId(
                      event.target.value
                    );

                    setMessage(null);
                  }}
                  className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white"
                >
                  {players.map((player) => (
                    <option
                      key={player.id}
                      value={player.id}
                    >
                      {player.id ===
                      currentPlayer?.id
                        ? `${player.name} · Tu`
                        : player.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {roundLoading || !data?.round ? (
          <div className="rounded-2xl bg-white p-6 text-sm text-gray-500 shadow-sm">
            Caricamento giornata...
          </div>
        ) : (
          <>
            {showNoPredictionsMessage ? (
              <div className="rounded-2xl border border-gray-200 bg-white px-5 py-8 text-center shadow-sm">
                <p className="text-sm font-semibold text-gray-900">
                  Nessun pronostico inserito
                </p>

                <p className="mt-1 text-sm text-gray-500">
                  {selectedPlayer?.id ===
                  currentPlayer?.id
                    ? "Non avevi inserito pronostici per questa giornata."
                    : `${
                        selectedPlayer?.name ??
                        "Questo giocatore"
                      } non aveva inserito pronostici per questa giornata.`}
                </p>
              </div>
            ) : (
              <>
                {/* PARTITE */}
                <div className="space-y-3">
                  {data.matches.map((match) => {
                    const kickoff = new Date(
                      match.kickoff
                    );

                    const prediction =
                      predictions[match.id] ?? {
                        home_score: "",
                        away_score: "",
                      };

                    const savedPrediction =
                      savedPredictions[match.id];

                    const hasPrediction =
                      prediction.home_score !==
                        "" &&
                      prediction.away_score !== "";

                    const isFinished =
                      match.status ===
                      "FINISHED";

                    return (
                      <article
                        key={match.id}
                        className="overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm transition hover:shadow-md"
                      >
                        <div className="px-4 py-5 sm:px-6">
                          {/* DATA */}
                          <div className="mb-5 text-center text-xs font-medium uppercase tracking-wide text-gray-400">
                            {kickoff.toLocaleDateString(
                              "it-IT",
                              {
                                weekday:
                                  "short",
                                day: "2-digit",
                                month:
                                  "short",
                              }
                            )}{" "}
                            ·{" "}
                            {kickoff.toLocaleTimeString(
                              "it-IT",
                              {
                                hour: "2-digit",
                                minute:
                                  "2-digit",
                              }
                            )}
                          </div>

                          {/* SQUADRE */}
                          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
                            <div className="text-right text-sm font-semibold leading-snug text-gray-950 sm:text-base">
                              {match.home_team}
                            </div>

                            <div className="text-xs font-medium uppercase text-gray-300">
                              vs
                            </div>

                            <div className="text-sm font-semibold leading-snug text-gray-950 sm:text-base">
                              {match.away_team}
                            </div>
                          </div>

                          {/* INPUT */}
                          {canEdit ? (
                            <div className="mt-5 flex items-center justify-center gap-3">
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="-"
                                value={
                                  prediction.home_score
                                }
                                onChange={(
                                  event
                                ) =>
                                  updatePrediction(
                                    match.id,
                                    "home_score",
                                    event.target
                                      .value
                                  )
                                }
                                className="h-12 w-14 rounded-xl border border-gray-200 bg-gray-50 text-center text-lg font-semibold text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white sm:w-16"
                              />

                              <span className="font-medium text-gray-300">
                                —
                              </span>

                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                placeholder="-"
                                value={
                                  prediction.away_score
                                }
                                onChange={(
                                  event
                                ) =>
                                  updatePrediction(
                                    match.id,
                                    "away_score",
                                    event.target
                                      .value
                                  )
                                }
                                className="h-12 w-14 rounded-xl border border-gray-200 bg-gray-50 text-center text-lg font-semibold text-gray-950 outline-none transition placeholder:text-gray-300 focus:border-gray-400 focus:bg-white sm:w-16"
                              />
                            </div>
                          ) : (
                            <div className="mt-5 text-center">
                              {hasPrediction ? (
                                <>
                                  <div className="text-2xl font-bold tracking-tight text-gray-950">
                                    {
                                      prediction.home_score
                                    }

                                    <span className="mx-2 text-gray-300">
                                      —
                                    </span>

                                    {
                                      prediction.away_score
                                    }
                                  </div>

                                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                                    Pronostico
                                  </p>
                                </>
                              ) : (
                                <p className="text-sm text-gray-400">
                                  Nessun
                                  pronostico
                                </p>
                              )}
                            </div>
                          )}

                          {/* RISULTATO */}
                          {data.round
                            ?.locked && (
                            <div className="mt-5 border-t border-gray-100 pt-4">
                              {isFinished ? (
                                <div className="flex items-center justify-between gap-4">
                                  <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                      Risultato
                                    </p>

                                    <p className="mt-1 font-semibold text-gray-900">
                                      {
                                        match.home_score
                                      }{" "}
                                      —{" "}
                                      {
                                        match.away_score
                                      }
                                    </p>
                                  </div>

                                  {hasPrediction &&
                                    savedPrediction && (
                                      <div className="text-right">
                                        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">
                                          Punti
                                        </p>

                                        <p
                                          className={`mt-1 text-lg font-bold ${
                                            savedPrediction.points ===
                                            3
                                              ? "text-emerald-600"
                                              : "text-gray-950"
                                          }`}
                                        >
                                          +
                                          {
                                            savedPrediction.points
                                          }
                                        </p>
                                      </div>
                                    )}
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <span className="h-2 w-2 rounded-full bg-amber-400" />

                                  In attesa del
                                  risultato
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {/* SALVATAGGIO */}
                {canEdit && (
                  <div className="sticky bottom-4 mt-6">
                    <div className="rounded-2xl border border-black/5 bg-white/95 p-3 shadow-lg backdrop-blur">
                      <button
                        onClick={
                          savePredictions
                        }
                        disabled={
                          !allPredictionsComplete ||
                          saving ||
                          saved
                        }
                        className={`w-full rounded-xl px-6 py-3.5 text-sm font-semibold transition ${
                          saved
                            ? "bg-emerald-600 text-white"
                            : allPredictionsComplete &&
                              !saving
                            ? "bg-gray-950 text-white hover:bg-gray-800"
                            : "cursor-not-allowed bg-gray-100 text-gray-400"
                        }`}
                      >
                        {saved
                          ? "Pronostico inviato"
                          : saving
                          ? "Salvataggio..."
                          : allPredictionsComplete
                          ? "Salva pronostici"
                          : "Completa tutti i pronostici"}
                      </button>
                    </div>
                  </div>
                )}

                {/* TOTALE */}
                {data.round.locked && (
                  <section className="mt-6 rounded-2xl bg-gray-950 px-6 py-7 text-white shadow-sm">
                    <div className="flex items-end justify-between gap-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                          Totale giornata
                        </p>

                        <p className="mt-2 text-sm text-gray-400">
                          {selectedPlayerName} ·
                          Giornata{" "}
                          {
                            data.round
                              .round_number
                          }
                        </p>
                      </div>

                      <div className="text-right">
                        <span className="text-4xl font-bold tracking-tight">
                          {totalPoints}
                        </span>

                        <span className="ml-2 text-sm text-gray-400">
                          pt
                        </span>
                      </div>
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
          </>
        )}
        {/* ===================================== */}
        {/* CLASSIFICA */}
        {/* ===================================== */}

        {activeTab === "standings" && (
          <>
            <section className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
                Classifica generale
              </p>

              <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
                Campionato
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                Punti accumulati nelle giornate
                già chiuse.
              </p>
            </section>

            {standingsLoading ? (
              <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-gray-500 shadow-sm">
                Caricamento classifica...
              </div>
            ) : !standings ||
              standings.standings.length === 0 ? (
              <div className="rounded-2xl border border-black/5 bg-white p-6 text-sm text-gray-500 shadow-sm">
                Nessun dato disponibile.
              </div>
            ) : (
              <>
                {/* MOBILE */}
                <div className="space-y-3 md:hidden">
                  {standings.standings.map(
                    (standing) => {
                      const isMe =
                        standing.player_id ===
                        currentPlayer?.id;

                      return (
                        <article
                          key={
                            standing.player_id
                          }
                          className={`rounded-2xl border p-5 shadow-sm ${
                            isMe
                              ? "border-gray-300 bg-white"
                              : "border-black/5 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                                {
                                  standing.position
                                }
                              </div>

                              <div>
                                <p className="font-semibold text-gray-950">
                                  {
                                    standing.name
                                  }

                                  {isMe && (
                                    <span className="ml-2 text-xs font-medium text-gray-400">
                                      Tu
                                    </span>
                                  )}
                                </p>

                                <p className="mt-0.5 text-xs text-gray-400">
                                  {
                                    standing.exact_scores
                                  }{" "}
                                  esatti ·{" "}
                                  {
                                    standing.correct_outcomes
                                  }{" "}
                                  esiti
                                </p>
                              </div>
                            </div>

                            <div className="text-right">
                              <p className="text-2xl font-bold tracking-tight text-gray-950">
                                {
                                  standing.total_points
                                }
                              </p>

                              <p className="text-xs text-gray-400">
                                punti
                              </p>
                            </div>
                          </div>

                          {standing
                            .recent_round_points
                            .length > 0 && (
                            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-gray-100 pt-4">
                              {standing.recent_round_points.map(
                                (
                                  recent
                                ) => (
                                  <div
                                    key={
                                      recent.round_id
                                    }
                                    className="rounded-xl bg-gray-50 p-3 text-center"
                                  >
                                    <p className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
                                      G
                                      {
                                        recent.round_number
                                      }
                                    </p>

                                    <p className="mt-1 font-bold text-gray-900">
                                      {
                                        recent.points
                                      }
                                    </p>
                                  </div>
                                )
                              )}
                            </div>
                          )}
                        </article>
                      );
                    }
                  )}
                </div>

                {/* DESKTOP */}
                <div className="hidden overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm md:block">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50/70 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                          <th className="px-5 py-4">
                            Pos.
                          </th>

                          <th className="px-5 py-4">
                            Giocatore
                          </th>

                          <th className="px-4 py-4 text-center">
                            Punti
                          </th>

                          <th className="px-4 py-4 text-center">
                            Esatti
                          </th>

                          <th className="px-4 py-4 text-center">
                            Esiti
                          </th>

                          {standings.recent_rounds.map(
                            (round) => (
                              <th
                                key={round.id}
                                className="px-4 py-4 text-center"
                              >
                                G
                                {
                                  round.round_number
                                }
                              </th>
                            )
                          )}
                        </tr>
                      </thead>

                      <tbody>
                        {standings.standings.map(
                          (standing) => {
                            const isMe =
                              standing.player_id ===
                              currentPlayer?.id;

                            return (
                              <tr
                                key={
                                  standing.player_id
                                }
                                className={`border-b border-gray-100 last:border-b-0 ${
                                  isMe
                                    ? "bg-gray-50/80"
                                    : "bg-white"
                                }`}
                              >
                                <td className="px-5 py-5">
                                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-700">
                                    {
                                      standing.position
                                    }
                                  </span>
                                </td>

                                <td className="px-5 py-5 font-semibold text-gray-950">
                                  {
                                    standing.name
                                  }

                                  {isMe && (
                                    <span className="ml-2 text-xs font-medium text-gray-400">
                                      Tu
                                    </span>
                                  )}
                                </td>

                                <td className="px-4 py-5 text-center text-lg font-bold text-gray-950">
                                  {
                                    standing.total_points
                                  }
                                </td>

                                <td className="px-4 py-5 text-center text-sm text-gray-600">
                                  {
                                    standing.exact_scores
                                  }
                                </td>

                                <td className="px-4 py-5 text-center text-sm text-gray-600">
                                  {
                                    standing.correct_outcomes
                                  }
                                </td>

                                {standing.recent_round_points.map(
                                  (
                                    recent
                                  ) => (
                                    <td
                                      key={
                                        recent.round_id
                                      }
                                      className="px-4 py-5 text-center text-sm font-medium text-gray-700"
                                    >
                                      {
                                        recent.points
                                      }
                                    </td>
                                  )
                                )}
                              </tr>
                            );
                          }
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <p className="mt-4 text-center text-xs text-gray-400">
                  Esatti = risultato esatto ·
                  Esiti = segno 1/X/2 corretto non
                  esatto
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}