export type ContentStatus = 'draft' | 'ready' | 'favorite' | 'published';

export interface FolderItem {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  description?: string;
}

export type QuestionType = 'quiz' | 'true_false';
export type PointsType = 'standard' | 'double' | 'no_points';
export type AnswerMode = 'single' | 'multiple';

export interface QuizQuestionOption {
  text: string;
  isCorrect: boolean;
  imageUrl?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  mediaUrl?: string;
  type: QuestionType;
  timeLimit: number; // in seconds: 5, 10, 20, 30, 60, etc.
  points: PointsType;
  answerMode: AnswerMode;
  options: QuizQuestionOption[];
}

export interface QuizTheme {
  id: string;
  name: string;
  category: 'free' | 'pro';
  bgGradient: string;
  cardBg: string;
  previewUrl?: string;
}

export interface QuizItem {
  id: string;
  title: string;
  questionCount: number;
  status: 'draft' | 'ready' | 'favorite';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  plays?: number;
  description?: string;
  themeId?: string;
  questions?: QuizQuestion[];
}

export type StoryBlockType = 'text' | 'image' | 'video' | 'audio' | 'embed';

export interface StoryBlock {
  id: string;
  type: StoryBlockType;
  content?: string;
  mediaUrl?: string;
  caption?: string;
  embedUrl?: string;
  width?: 'normal' | 'wide' | 'full';
}

export interface StoryItem {
  id: string;
  title: string;
  readingTime: string; // e.g. "1 phút đọc"
  status: 'draft' | 'published';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  summary: string;
  content: string;
  blocks?: StoryBlock[];
  tags?: string[];
}

export interface CourseItem {
  id: string;
  title: string;
  chapterCount: number;
  duration: string;
  status: 'draft' | 'published';
  folderId?: string | null;
  thumbnail: string;
  author: string;
  updatedAt: string;
  description?: string;
}

export type LibraryCategory = 'quiz' | 'story' | 'course' | 'folders' | 'trash';
