/**
 * Màn tổng quan các Phần (Sections Overview) khi bấm nút quay lại (←) trên băng tiêu đề lộ trình:
 *  - Phần đã xong: nhãn "ĐÃ HOÀN THÀNH!" kèm nút "Ôn tập".
 *  - Phần đang học: thanh tiến độ % + cúp chiến thắng, nút "Tiếp tục", bong bóng thoại mô tả cùng linh vật Rồng Con.
 *  - Phần kế tiếp: số lượng Cửa, bong bóng giới thiệu + nút "Nhảy tới Phần X" chuyển thẳng vào bản đồ Cửa của Phần đó.
 */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ArrowLeft, CheckCircle2, Compass, Trophy } from 'lucide-react-native';
import { Mascot } from '@/components/art';
import { Bar, Chip, Txt } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import {
  classifySection,
  sectionAccessory,
  sectionPercent,
  sectionSummary,
  unitTheme,
} from '@/lib/learning-path';
import type { PathPart } from '@/types/learning';

interface LearningSectionsProps {
  parts: PathPart[];
  focusPartNo: number | null;
  viewingPartNo: number | null;
  onBack: () => void;
  onSelectPart: (partNo: number) => void;
}

const SpeechBubble: React.FC<{ text: string; bg: string; border: string; textColor: string }> = ({
  text,
  bg,
  border,
  textColor,
}) => (
  <View style={{ width: '100%', alignItems: 'center' }}>
    <View
      style={{
        width: '100%',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: bg,
        borderWidth: 2,
        borderColor: border,
      }}
    >
      <Txt size={13} color={textColor} numberOfLines={3} style={{ lineHeight: 19 }}>
        {text}
      </Txt>
    </View>
    {/* Mũi nhọn chỉ xuống linh vật */}
    <View
      style={{
        width: 12,
        height: 12,
        marginTop: -7,
        backgroundColor: bg,
        borderRightWidth: 2,
        borderBottomWidth: 2,
        borderColor: border,
        transform: [{ rotate: '45deg' }],
      }}
    />
  </View>
);

export const LearningSections: React.FC<LearningSectionsProps> = ({
  parts,
  focusPartNo,
  viewingPartNo,
  onBack,
  onSelectPart,
}) => {
  const { c, dark } = useTheme();

  return (
    <View style={{ flex: 1 }} testID="sections-overview">
      {/* Thanh đầu trang ← Quay lại giống Duolingo */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingHorizontal: 18,
          height: 56,
          borderBottomWidth: 2,
          borderBottomColor: c.vien,
          backgroundColor: c.the,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại lộ trình học"
          onPress={onBack}
          testID="sections-back"
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 12,
            backgroundColor: pressed ? c.giay2 : 'transparent',
          })}
        >
          <ArrowLeft size={20} color={c.muc2} />
          <Txt f="bold" size={16} color={c.muc2}>
            Quay lại
          </Txt>
        </Pressable>
        <Txt f="display" size={16} color={c.muc3} style={{ marginLeft: 'auto' }}>
          Các phần học Đông A
        </Txt>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingVertical: 20,
          paddingBottom: 56,
          gap: 16,
          maxWidth: 640,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        {parts.map((part, idx) => {
          const status = classifySection(part, focusPartNo);
          const theme = unitTheme(idx * 2);
          const pct = sectionPercent(part);
          const summary = sectionSummary(part);
          const isViewing = viewingPartNo === part.no;
          const accentFg = dark ? theme.textDark : theme.textLight;

          if (status === 'completed') {
            return (
              <View
                key={part.no}
                testID={`section-card-${part.no}`}
                style={{
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: isViewing ? theme.bg : c.vien,
                  backgroundColor: c.the,
                  padding: 20,
                  overflow: 'hidden',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                }}
              >
                {/* Dải bóng chéo trang trí nhẹ cho Phần đã hoàn thành */}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    top: -40,
                    right: 80,
                    width: 64,
                    height: 220,
                    backgroundColor: dark ? 'rgba(255,255,255,0.03)' : 'rgba(220,199,151,0.16)',
                    transform: [{ rotate: '18deg' }],
                  }}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Txt f="bold" size={12} color={accentFg} upper>
                    Phần {part.no} · {part.campaign.year_label}
                  </Txt>
                  <Txt f="displayHeavy" size={20}>
                    {part.campaign.title}
                  </Txt>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <CheckCircle2 size={18} color={c.ngoc} />
                    <Txt f="bold" size={13} color={c.ngocChu} upper>
                      Đã hoàn thành!
                    </Txt>
                    <Txt size={13} color={c.muc3}>
                      · {part.totals.done}/{part.totals.nodes} bài
                    </Txt>
                  </View>
                </View>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Ôn tập Phần ${part.no}: ${part.campaign.title}`}
                  onPress={() => onSelectPart(part.no)}
                  testID={`section-review-${part.no}`}
                  style={({ pressed }) => ({
                    paddingHorizontal: 18,
                    minHeight: 42,
                    borderRadius: 14,
                    backgroundColor: c.the,
                    borderWidth: 2,
                    borderColor: c.vien2,
                    borderBottomWidth: pressed ? 2 : 4,
                    borderBottomColor: c.vien2,
                    alignItems: 'center',
                    justifyContent: 'center',
                  })}
                >
                  <Txt f="bold" size={13} color={c.thuyChu} upper>
                    Ôn tập
                  </Txt>
                </Pressable>
              </View>
            );
          }

          if (status === 'active') {
            return (
              <View
                key={part.no}
                testID={`section-card-${part.no}`}
                style={{
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: isViewing ? theme.bg : c.vien2,
                  backgroundColor: c.the,
                  padding: 20,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'stretch',
                  gap: 18,
                }}
              >
                <View style={{ flex: 1, minWidth: 250, justifyContent: 'space-between', gap: 14 }}>
                  <View style={{ gap: 6 }}>
                    <Txt f="bold" size={12} color={accentFg} upper>
                      Phần {part.no} · {part.campaign.year_label}
                    </Txt>
                    <Txt f="displayHeavy" size={22}>
                      {part.campaign.title}
                    </Txt>
                    {/* Thanh tiến độ + cúp */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <View style={{ flex: 1, justifyContent: 'center' }}>
                        <Bar
                          value={part.totals.done}
                          max={Math.max(1, part.totals.nodes)}
                          height={16}
                          fill={theme.bg}
                          label={`Phần ${part.no}: ${pct}%`}
                        />
                        <View
                          pointerEvents="none"
                          style={{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }}
                        >
                          <Txt f="bold" size={11} color={pct > 52 ? '#ffffff' : c.muc2}>
                            {pct}%
                          </Txt>
                        </View>
                      </View>
                      <View
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 17,
                          backgroundColor: dark ? theme.darkBg : theme.lightBg,
                          borderWidth: 2,
                          borderColor: theme.bg,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Trophy size={16} color={accentFg} />
                      </View>
                    </View>
                    <Txt size={13} color={c.muc3}>
                      {part.gates.length} Cửa · {part.totals.done}/{part.totals.nodes} bài hoàn thành
                    </Txt>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Tiếp tục Phần ${part.no}: ${part.campaign.title}`}
                    onPress={() => onSelectPart(part.no)}
                    testID={`section-continue-${part.no}`}
                    style={({ pressed }) => ({
                      minHeight: 46,
                      borderRadius: 14,
                      backgroundColor: theme.bg,
                      borderBottomWidth: pressed ? 2 : 4,
                      borderBottomColor: theme.edge,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 18,
                    })}
                  >
                    <Txt f="bold" size={14} color="#ffffff" upper>
                      Tiếp tục
                    </Txt>
                  </Pressable>
                </View>

                <View style={{ width: 200, alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginLeft: 'auto', marginRight: 'auto' }}>
                  <SpeechBubble
                    text={summary}
                    bg={dark ? c.the2 : c.giay}
                    border={c.vien}
                    textColor={c.muc}
                  />
                  <Mascot size={92} mood="excited" accessory={sectionAccessory(part.no)} bob title={`Rồng Con Phần ${part.no}`} />
                </View>
              </View>
            );
          }

          if (status === 'upcoming') {
            return (
              <View
                key={part.no}
                testID={`section-card-${part.no}`}
                style={{
                  borderRadius: 20,
                  borderWidth: 2,
                  borderColor: isViewing ? theme.bg : c.vien,
                  backgroundColor: dark ? c.the : c.the2,
                  padding: 20,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'stretch',
                  gap: 18,
                }}
              >
                <View style={{ flex: 1, minWidth: 250, justifyContent: 'space-between', gap: 14 }}>
                  <View style={{ gap: 6 }}>
                    <Txt f="bold" size={12} color={accentFg} upper>
                      Phần {part.no} · {part.campaign.year_label}
                    </Txt>
                    <Txt f="displayHeavy" size={21} color={c.muc}>
                      {part.campaign.title}
                    </Txt>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                      <Compass size={15} color={c.muc3} />
                      <Txt f="bold" size={12} color={c.muc3} upper>
                        {part.gates.length} Cửa · {part.totals.nodes} bài học
                      </Txt>
                    </View>
                  </View>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Nhảy tới Phần ${part.no}: ${part.campaign.title}`}
                    onPress={() => onSelectPart(part.no)}
                    testID={`section-jump-${part.no}`}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      borderRadius: 14,
                      backgroundColor: c.the,
                      borderWidth: 2,
                      borderColor: c.vien2,
                      borderBottomWidth: pressed ? 2 : 4,
                      borderBottomColor: c.vien2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 16,
                    })}
                  >
                    <Txt f="bold" size={13} color={accentFg} upper>
                      Nhảy tới Phần {part.no}
                    </Txt>
                  </Pressable>
                </View>

                <View style={{ width: 200, alignItems: 'center', justifyContent: 'flex-end', gap: 8, marginLeft: 'auto', marginRight: 'auto' }}>
                  <SpeechBubble
                    text={summary}
                    bg={c.the}
                    border={c.vien}
                    textColor={c.muc2}
                  />
                  <Mascot size={92} mood="happy" accessory={sectionAccessory(part.no)} title={`Rồng Con Phần ${part.no}`} />
                </View>
              </View>
            );
          }

          return (
            <View
              key={part.no}
              testID={`section-card-${part.no}`}
              style={{
                borderRadius: 20,
                borderWidth: 2,
                borderColor: c.vien,
                backgroundColor: c.giay2,
                padding: 20,
                gap: 6,
              }}
            >
              <Txt f="bold" size={12} color={c.muc3} upper>
                Phần {part.no} · {part.campaign.year_label}
              </Txt>
              <Txt f="displayHeavy" size={19} color={c.muc2}>
                {part.campaign.title}
              </Txt>
              <Chip text="Lộ trình đang được chuẩn bị" bg={c.dichNhat} fg={c.dich} />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};
