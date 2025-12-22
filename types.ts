
export interface User {
  id: string;
  name: string;
}

export interface ExegesisResult {
  verse: string;
  context: string;
  historicalAnalysis: string;
  theologicalInsights: string;
  originalLanguages: {
    term: string;
    transliteration: string;
    meaning: string;
  }[];
  imagePrompt: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  result: ExegesisResult;
  imageUrl?: string;
}
