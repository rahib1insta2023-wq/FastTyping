
export function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function calculateWPM(correctWords: number, timeInSeconds: number): number {
  if (timeInSeconds <= 0) return 0;
  return Math.round((correctWords / timeInSeconds) * 60);
}

export function calculateAccuracy(correct: number, incorrect: number): number {
  const total = correct + incorrect;
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function saveScore(score: any) {
  const history = JSON.parse(localStorage.getItem('typing_scores') || '[]');
  history.push(score);
  localStorage.setItem('typing_scores', JSON.stringify(history.slice(-100))); // Keep last 100
}

export function getScoreHistory() {
  return JSON.parse(localStorage.getItem('typing_scores') || '[]');
}
