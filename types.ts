
export interface User {
  id: string;
  username: string;
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
  // Sources are mandatory to list when using Google Search grounding
  sources?: { uri: string; title: string }[];
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  result: ExegesisResult;
  imageUrl?: string;
}
