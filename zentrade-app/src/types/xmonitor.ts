export type StrategyType = 'silent_period' | 'tail_sweep' | 'settlement_no' | 'panic_fade';

export interface StrategyInstance {
  id: string;
  strategyType: StrategyType;
  name: string;
  enabled: boolean;
  params: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorAlert {
  id: string;
  strategyInstanceId: string;
  strategyType: StrategyType;
  trackingId: string;
  bracket: string | null;
  triggerData: Record<string, unknown>;
  message: string;
  polymarketUrl: string;
  feedback: 'yes' | 'no' | null;
  feedbackNote: string | null;
  createdAt: string;
  feedbackAt: string | null;
  pushSent: boolean;
}

export interface ApiHealthStatus {
  xtracker: 'ok' | 'error' | 'unknown';
  polymarket: 'ok' | 'error' | 'unknown';
  xtrackerError: string | null;
  polymarketError: string | null;
  xtrackerLastSuccess: string | null;
  polymarketLastSuccess: string | null;
}

export interface TrackingPeriod {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  marketLink: string | null;
  isActive: boolean;
  totalPosts: number;
  pace: number;
  dailyAverage: number;
}

export interface MonitorStatus {
  userHandle: string;
  apiHealth: ApiHealthStatus;
  activeTrackings: TrackingPeriod[];
  currentPostCount: number;
  lastPostAt: string | null;
  secondsSinceLastPost: number | null;
  lastPolledAt: string | null;
}

export interface MarketBracket {
  question: string;
  bracketRange: string;
  lowerBound: number;
  upperBound: number | null;
  yesPrice: number;
  noPrice: number;
  volume: number;
  polymarketUrl: string;
}

export interface MarketEvent {
  title: string;
  slug: string;
  startDate: string | null;
  endDate: string | null;
  polymarketUrl: string;
  brackets: MarketBracket[];
}

export interface WsMessage {
  type: 'status_update' | 'new_post' | 'new_alert' | 'api_health_change' | 'market_update';
  data: Record<string, unknown>;
}

export interface StrategyNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const STRATEGY_TYPE_LABELS: Record<StrategyType, string> = {
  silent_period: 'Silent Period',
  tail_sweep: 'Tail Sweep',
  settlement_no: 'Settlement No',
  panic_fade: 'Panic Fade',
};

export const STRATEGY_TYPE_ICONS: Record<StrategyType, string> = {
  silent_period: 'clock',
  tail_sweep: 'check-circle',
  settlement_no: 'alert-triangle',
  panic_fade: 'zap',
};
