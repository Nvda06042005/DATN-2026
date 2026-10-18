export type StudentRole = 'Quân sư' | 'Thủy binh' | 'Tiên phong';

export interface Student {
  id: string;
  name: string;
  level: number;
  role: StudentRole;
  roleTitle: string;
  avatar: string;
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  xp: number;
  maxXp: number;
  powerName: string;
  powerDesc: string;
  isCritical?: boolean;
  alertText?: string;
}

export type NodeStatus = 'completed' | 'in_progress' | 'active' | 'locked';

export interface BattleNode {
  id: string;
  number: number;
  name: string;
  stars?: number;
  statusText: string;
  status: NodeStatus;
  percentage?: number;
}

export interface ClassStats {
  classCode: string;
  className: string;
  campaignTitle: string;
  campaignPasscode: string;
  totalStudents: number;
  activeStudents: number;
  averageMorale: number;
  topStudent: {
    name: string;
    title: string;
    xp: number;
    streak: number;
    rank: number;
  };
}

export interface AiDiagnosticAlert {
  id: string;
  title: string;
  description: string;
  misconceptionRate: number;
  citationDoc: string;
  citationPage: number;
  suggestedPrompt: string;
}
