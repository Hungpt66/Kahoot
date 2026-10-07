export type QuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'fill_blank'
  | 'match_pairs'
  | 'external_embed';

export interface OptionItem {
  id: string;
  text: string;
  isCorrect: boolean;
}

export interface PairItem {
  id: string;
  left: string;
  right: string;
}

export interface ExternalGameConfig {
  sourceType: 'ai_studio_html' | 'url';
  embedHtml?: string;
  embedUrl?: string;
  title: string;
  instruction: string;
  maxScore: number;
  timeLimitSeconds: number;
}

export interface Question {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  mediaUrl?: string;
  timeLimit: number; // in seconds (e.g. 10, 20, 30, 60)
  points: number; // default 1000
  options?: OptionItem[];
  correctText?: string; // for fill_blank (comma-separated if multiple acceptable)
  pairs?: PairItem[]; // for match_pairs
  externalGameConfig?: ExternalGameConfig;
}

export interface Quiz {
  id: string;
  title: string;
  description: string;
  coverImage?: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  questions: Question[];
  isPreset?: boolean;
}

export interface Player {
  id: string;
  nickname: string;
  avatar: string;
  score: number;
  streak: number;
  lastAnswerCorrect?: boolean;
  lastPointsEarned?: number;
  rank?: number;
  joinedAt: number;
  isBot?: boolean;
}

export interface CurrentQuestionOptionMeta {
  id: string;
  text: string;
}

export interface CurrentQuestionMeta {
  type: QuestionType;
  title?: string;
  description?: string;
  mediaUrl?: string;
  optionsCount: number;
  correctCount: number;
  allowMultiSelect: boolean;
  timeLimit?: number;
  options?: CurrentQuestionOptionMeta[];
  externalGameConfig?: ExternalGameConfig;
}

export interface PlayerAnswerRecord {
  playerId: string;
  nickname: string;
  questionId: string;
  questionIndex: number;
  selectedOptionId?: string;
  selectedOptionIds?: string[];
  answeredText?: string;
  matchedPairs?: Record<string, string>;
  isCorrect: boolean;
  timeMs: number;
  pointsEarned: number;
  timestamp: number;
}

export type RoomStatus =
  | 'lobby'
  | 'question_intro'
  | 'question'
  | 'question_result'
  | 'leaderboard'
  | 'external_round'
  | 'finished';

export interface GameRoom {
  pin: string;
  quizId: string;
  quizTitle: string;
  hostId: string;
  status: RoomStatus;
  currentQuestionIndex: number;
  questionStartedAt: number;
  timeRemaining: number;
  currentQuestionMeta?: CurrentQuestionMeta;
  players: Record<string, Player>;
  answers: PlayerAnswerRecord[];
  createdAt: number;
}

export interface LMSReport {
  id: string;
  roomPin: string;
  quizTitle: string;
  completedAt: string;
  totalPlayers: number;
  averageScore: number;
  topPlayers: { rank: number; nickname: string; score: number; avatar: string }[];
  questionStats: {
    questionIndex: number;
    title: string;
    correctCount: number;
    totalAnswers: number;
    accuracyPercent: number;
  }[];
  detailedPlayerResults: {
    nickname: string;
    score: number;
    correctAnswersCount: number;
    totalQuestions: number;
    averageResponseTimeMs: number;
  }[];
}
