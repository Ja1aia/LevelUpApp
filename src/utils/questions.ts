import { Question } from '../types';

export const QUESTIONS: Question[] = [
  {
    id: 1,
    question: 'Berapa hasil dari 15 × 8?',
    options: ['110', '120', '125', '130'],
    correctAnswer: 1, // 120
    topic: 'Perkalian',
  },
  {
    id: 2,
    question: 'Jika x + 12 = 27, berapa nilai x?',
    options: ['12', '15', '18', '21'],
    correctAnswer: 1, // 15
    topic: 'Aljabar',
  },
  {
    id: 3,
    question: 'Berapa luas persegi dengan sisi 9 cm?',
    options: ['72 cm²', '81 cm²', '90 cm²', '99 cm²'],
    correctAnswer: 1, // 81 cm²
    topic: 'Geometri',
  },
  {
    id: 4,
    question: 'Hasil dari 144 ÷ 12 adalah?',
    options: ['10', '11', '12', '13'],
    correctAnswer: 2, // 12
    topic: 'Pembagian',
  },
  {
    id: 5,
    question: 'Berapa 25% dari 80?',
    options: ['15', '20', '25', '30'],
    correctAnswer: 1, // 20
    topic: 'Persentase',
  },
];

// Timer duration per question (in seconds)
export const TIMER_DURATION = 10;

// Total questions in quiz
export const TOTAL_QUESTIONS = QUESTIONS.length;
