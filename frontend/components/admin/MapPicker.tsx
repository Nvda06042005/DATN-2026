/** Bản dành cho điện thoại: chưa có bản đồ chọn điểm, nhập vĩ độ và kinh độ bằng tay (bản web có bản đồ trong MapPicker.web.tsx). */
import React from 'react';
import { Txt } from '@/components/ui';

export const MapPicker: React.FC<{ lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void }> = () => (
  <Txt size={13}>Bản đồ chọn điểm chỉ có trên bản web; hãy nhập vĩ độ và kinh độ ở hai ô trên.</Txt>
);
