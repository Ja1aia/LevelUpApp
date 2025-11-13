export interface Question {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number; // index of correct option (0-3)
  topic: string;
}

export interface QuizState {
  currentQuestionIndex: number;
  score: number;
  answers: Answer[];
  timeLeft: number;
  isFinished: boolean;
}

export interface Answer {
  questionId: number;
  selectedOption: number;
  isCorrect: boolean;
  timeSpent: number; // seconds
}

export interface PlayerData {
  username: string;
}
