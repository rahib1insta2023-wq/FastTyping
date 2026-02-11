
export type GameStatus = 'idle' | 'playing' | 'finished';

export interface GameStats {
  wpm: number;
  accuracy: number;
  correctWords: number;
  incorrectWords: number;
  totalKeystrokes: number;
  timeSpent: number;
}

export interface ScoreEntry extends GameStats {
  id: string;
  timestamp: number;
  topic: string;
}

export interface WordObject {
  text: string;
  status: 'pending' | 'correct' | 'incorrect' | 'active';
}
