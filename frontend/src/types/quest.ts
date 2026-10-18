export type SubmissionStatus = 'early' | 'on_time' | 'late' | 'not_submitted';
export type OutcomeStatus = 'passed' | 'failed' | 'pending';
export type ObjectiveType = 'start' | 'checkpoint' | 'quiz' | 'story' | 'boss';

export interface StudentProgress {
  studentId: string;
  studentName: string;
  avatar?: string;
  status: SubmissionStatus;
  feedback?: string;
  outcome: OutcomeStatus;
  submittedAt?: string;
}

export interface QuestObjective {
  id: string;
  title: string;
  shortDescription?: string;
  type: ObjectiveType;
  coords: { x: number; y: number }; // Percentage 0 - 100
  connections: string[]; // IDs of next connected objectives
  rewards: { xp: number; gp: number };
  earlyRewards?: { xp: number; gp: number };
  nextObjectiveId?: string;
  failObjectiveId?: string;
  dueDate: string;
  earlyDueDate?: string;
  storyContent: string;
  taskContent: string;
  enableAssignments: boolean;
  enableEarlyReward: boolean;
  allowDiscussion: boolean;
  selfPaced: boolean;
  studentsProgress: StudentProgress[];
}

export interface Quest {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  coords: { x: number; y: number }; // Coords on world map (0 - 100%)
  status: 'active' | 'completed' | 'locked';
  totalStudents: number;
  objectives: QuestObjective[];
}
