// --- React Methods
import React, { createContext, useCallback, useEffect, useState } from "react";

// --- Axios
import axios, { AxiosError } from "axios";

import { CERAMIC_CACHE_ENDPOINT } from "../config/stamp_config";
import { PROVIDER_ID } from "@gitcoin/passport-types";
import { PLATFORMS } from "../config/platforms";
import { PlatformSpec } from "@gitcoin/passport-platforms";
import { getStampProviderIds } from "../components/CardList";

const scorerApiGetScore = CERAMIC_CACHE_ENDPOINT + "/score";
const scorerApiGetWeights = CERAMIC_CACHE_ENDPOINT + "/weights";

export type PassportSubmissionStateType =
  | "APP_INITIAL"
  | "APP_REQUEST_PENDING"
  | "APP_REQUEST_ERROR"
  | "APP_REQUEST_SUCCESS";
export type ScoreStateType = "APP_INITIAL" | "BULK_PROCESSING" | "PROCESSING" | "ERROR" | "DONE";

export type Weights = {
  [key in PROVIDER_ID]: string;
};

export type StampScores = {
  [key in PROVIDER_ID]: string;
};

export type PlatformScoreSpec = PlatformSpec & {
  possiblePoints: number;
  earnedPoints: number;
};

export interface ScorerContextState {
  score: number;
  rawScore: number;
  threshold: number;
  scoreDescription: string;
  passportSubmissionState: PassportSubmissionStateType;
  scoreState: ScoreStateType;
  scoredPlatforms: PlatformScoreSpec[];
  refreshScore: (address: string | undefined, dbAccessToken: string) => Promise<void>;
  fetchStampWeights: () => Promise<void>;
  stampWeights: Partial<Weights>;
  // submitPassport: (address: string | undefined) => Promise<void>;
}

const startingState: ScorerContextState = {
  score: 0,
  rawScore: 0,
  threshold: 0,
  scoreDescription: "",
  passportSubmissionState: "APP_INITIAL",
  scoreState: "APP_INITIAL",
  scoredPlatforms: [],
  refreshScore: async (address: string | undefined, dbAccessToken: string): Promise<void> => {},
  fetchStampWeights: async (): Promise<void> => {},
  stampWeights: {},
  // submitPassport: async (address: string | undefined): Promise<void> => {},
};

// create our app context
export const ScorerContext = createContext(startingState);

export const ScorerContextProvider = ({ children }: { children: any }) => {
  const [score, setScore] = useState(0);
  const [rawScore, setRawScore] = useState(0);
  const [threshold, setThreshold] = useState(0);
  const [scoreDescription, setScoreDescription] = useState("");
  const [passportSubmissionState, setPassportSubmissionState] = useState<PassportSubmissionStateType>("APP_INITIAL");
  const [scoreState, setScoreState] = useState<ScoreStateType>("APP_INITIAL");
  const [stampScores, setStampScores] = useState<StampScores>();
  const [stampWeights, setStampWeights] = useState<Partial<Weights>>({});
  const [scoredPlatforms, setScoredPlatforms] = useState<PlatformScoreSpec[]>([]);

  const loadScore = async (
    address: string | undefined,
    dbAccessToken: string,
    rescore: boolean = false
  ): Promise<string> => {
    try {
      setScoreState("APP_INITIAL");
      let response;
      try {
        response = await axios({
          url: `${scorerApiGetScore}/${address}`,
          method: rescore ? "post" : "get",
          headers: {
            Authorization: `Bearer ${dbAccessToken}`,
          },
        });
      } catch (e) {
        // Rethrow if this is already rescoring, to avoid loop
        if (rescore) throw e;
        else return loadScore(address, dbAccessToken, true);
      }
      setScoreState(response.data.status);
      if (response.data.status === "DONE") {
        const numRawScore = Number.parseFloat(response.data.evidence.rawScore);
        const numThreshold = Number.parseFloat(response.data.evidence.threshold);
        const numScore = Number.parseFloat(response.data.score);

        if (needsRescore(rescore, numRawScore, response.data.stamp_scores))
          return loadScore(address, dbAccessToken, true);

        setRawScore(numRawScore);
        setThreshold(numThreshold);
        setScore(numScore);
        setStampScores(response.data.stamp_scores);

        if (numRawScore > numThreshold) {
          setScoreDescription("Passing Score");
        } else {
          setScoreDescription("Low Score");
        }
      }

      return response.data.status;
    } catch (error) {
      throw error;
    }
  };

  const needsRescore = (currentlyRescoring: boolean, rawScore: number, stamp_scores: any): boolean => {
    let needsRescore = rawScore > 0;
    if (!currentlyRescoring && needsRescore) {
      try {
        if (Object.keys(stamp_scores).length > 0) needsRescore = false;
      } catch {}
    }
    return needsRescore;
  };

  const fetchStampWeights = async () => {
    try {
      const response = await axios.get(`${scorerApiGetWeights}`);
      setStampWeights(response.data);
    } catch (error) {
      setPassportSubmissionState("APP_REQUEST_ERROR");
    }
  };

  const refreshScore = async (
    address: string | undefined,
    dbAccessToken: string
    // submitPassportOnFailure: boolean = true
  ) => {
    if (address) {
      const maxRequests = 30;
      let sleepTime = 1000;
      setPassportSubmissionState("APP_REQUEST_PENDING");
      try {
        let requestCount = 1;
        let scoreStatus = await loadScore(address, dbAccessToken);
        while ((scoreStatus === "PROCESSING" || scoreStatus === "BULK_PROCESSING") && requestCount < maxRequests) {
          requestCount++;
          await new Promise((resolve) => setTimeout(resolve, sleepTime));
          if (sleepTime < 10000) {
            sleepTime += 500;
          }
          scoreStatus = await loadScore(address, dbAccessToken);
        }
        setPassportSubmissionState("APP_REQUEST_SUCCESS");
      } catch (error: AxiosError | any) {
        setPassportSubmissionState("APP_REQUEST_ERROR");
        // Commenting this, as we don't want to submit passport on failure any more - this will be handled in the BE
        // if (submitPassportOnFailure && error.response?.data?.detail === "Unable to get score for provided scorer.") {
        //   submitPassport(address);
        // }
      }
    }
  };

  const calculatePlatformScore = useCallback(() => {
    if (stampScores && stampWeights) {
      const scoredPlatforms = PLATFORMS.map((platform) => {
        const providerIds = getStampProviderIds(platform.platform);
        const possiblePoints = providerIds.reduce((acc, key) => acc + (parseFloat(stampWeights[key] || "0") || 0), 0);
        const earnedPoints = providerIds.reduce((acc, key) => acc + (parseFloat(stampScores[key]) || 0), 0);
        return {
          ...platform,
          possiblePoints,
          earnedPoints,
        };
      });
      setScoredPlatforms(scoredPlatforms);
    }
  }, [stampScores, stampWeights]);

  useEffect(() => {
    if (!stampScores || !stampWeights) {
      setScoredPlatforms(PLATFORMS.map((platform) => ({ ...platform, possiblePoints: 0, earnedPoints: 0 })));
      return;
    }
    calculatePlatformScore();
  }, [stampScores, stampWeights]);

  // use props as a way to pass configuration values
  const providerProps = {
    score,
    rawScore,
    threshold,
    scoreDescription,
    passportSubmissionState,
    scoreState,
    stampWeights,
    stampScores,
    scoredPlatforms,
    refreshScore,
    fetchStampWeights,
    // submitPassport,
  };

  return <ScorerContext.Provider value={providerProps}>{children}</ScorerContext.Provider>;
};
