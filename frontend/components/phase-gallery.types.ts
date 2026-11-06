import type { ReactNode } from 'react';
export type PhaseGalleryItem = { id: string; title: string; content: ReactNode };
export type PhaseGalleryProps = { items: PhaseGalleryItem[]; wide: boolean; paused: boolean; onSelect: (id: string) => void };
