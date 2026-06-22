export interface PredictionObservation {
  matchId: string;
  predictedProbability: number;
  actualOutcome: 0 | 1;
}

export interface CalibrationMetrics {
  brierScore: number;
  logLoss: number;
  sampleSize: number;
}

export interface DivisorEvaluation {
  divisor: number;
  metrics: CalibrationMetrics;
}
