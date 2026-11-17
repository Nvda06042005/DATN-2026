/**
 * Khung Trợ lý AI đầy đủ cho cổng Học sinh:
 * - Mặc định mở "Trung tâm AI" (AiHubDashboard: AI Tutor, Lộ trình Cá nhân hóa 4 bước, Flash Cards & Chẩn đoán Năng lực BKT).
 * - Chuyển nhanh sang "Tiểu Tướng & Lịch sử chat" (TieuTuongTab với cột lịch sử trò chuyện, Hỏi đáp & Nhập vai danh tướng; chẩn đoán năng lực BKT chỉ còn ở Trung tâm AI).
 */
import React, { useState } from 'react';
import { View } from 'react-native';
import { AiHubDashboard } from '@/components/ai/AiHubDashboard';
import type { Session } from '@/components/auth';
import { TieuTuongTab, type OpenSource } from '@/components/portal/TieuTuong';
import { Segmented } from '@/components/ui';

export type StudentAiMode = 'hub' | 'tieu-tuong';

export interface StudentAiHubProps {
  session: Session;
  onOpen: OpenSource;
  onPractice?: () => void;
  onLearn?: () => void;
  onChanged?: () => void;
  initialMode?: StudentAiMode;
}

export const StudentAiHub: React.FC<StudentAiHubProps> = ({
  session,
  onOpen,
  onPractice,
  onLearn,
  onChanged,
  initialMode = 'hub',
}) => {
  const [mode, setMode] = useState<StudentAiMode>(initialMode);

  return (
    <View style={{ gap: 16, width: '100%' }} testID="student-ai-hub">
      <Segmented<StudentAiMode>
        label="Chế độ Trợ lý AI"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'hub', label: 'Trung tâm AI (Lộ trình & Flash Cards)' },
          { value: 'tieu-tuong', label: 'Tiểu Tướng & Lịch sử chat' },
        ]}
      />
      {mode === 'hub' ? (
        <AiHubDashboard
          session={session}
          embedded
          onOpenSource={onOpen}
          onStartPractice={() => onPractice?.()}
          onGoLearn={() => onLearn?.()}
        />
      ) : (
        <TieuTuongTab session={session} onOpen={onOpen} onChanged={onChanged} />
      )}
    </View>
  );
};
