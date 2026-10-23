import type { GeneratedStory } from '@/types/libraryType';
import { API_BASE_URL } from '@/utils/http';

/** Nhờ AI soạn một màn truyện lịch sử (lời kể, tư liệu, thử thách) */
export const generateStory = async (campaignName: string, stageTitle: string, keyEvent: string): Promise<GeneratedStory> => {
  const response = await fetch(`${API_BASE_URL}/api/story/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ campaign_name: campaignName, stage_title: stageTitle, key_event: keyEvent }),
  });
  if (!response.ok) throw new Error(`Lỗi phản hồi máy chủ: ${response.status}`);
  return response.json();
};
