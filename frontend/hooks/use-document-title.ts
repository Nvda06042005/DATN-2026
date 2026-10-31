import { useEffect } from 'react';
import { Platform } from 'react-native';

/** Cập nhật tiêu đề tab của các trang công khai trên web. */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.title = title;
  }, [title]);
}
