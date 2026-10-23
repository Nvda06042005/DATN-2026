export interface CircularCarouselItem {
  id: string;
  title: string;
  subtitle: string;
  period: string;
  badge: string;
  description: string;
  quote?: string;
  citation: string;
  image: string;
  accentColor?: 'amber' | 'emerald' | 'purple' | 'rose' | 'sky';
  stats?: Array<{ label: string; value: string }>;
  promptSuggestion?: string;
}
