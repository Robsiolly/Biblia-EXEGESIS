
export interface User {
  id: string;
  name: string;
}

export interface MapLocation {
  title: string;
  uri: string;
}

export interface ExegesisResult {
  verse: string;
  content: string; // Conteúdo principal em Markdown
  locations: MapLocation[];
  imagePrompt: string;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  result: ExegesisResult;
  imageUrl?: string;
}
