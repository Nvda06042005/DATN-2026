export type UserRole = 'teacher' | 'student';

export interface StudentProfile {
  id: string;
  name: string;
  className: string;
  role: string;
  avatar: string;
  level: number;
  points: number;
  hearts: number;
  maxHearts: number;
  streakDays: number;
  badges: Array<{
    id: string;
    name: string;
    icon: string;
    desc: string;
  }>;
}

export interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  citation: string;
  unit_id?: string;
}

