/** /ai-hub – Trung tâm AI Hub độc lập */
import { View } from 'react-native';
import { AiHubDashboard } from '@/components/ai/AiHubDashboard';
import { useDocumentTitle } from '@/hooks/use-document-title';

export default function AiHubRoute() {
  useDocumentTitle('Trung tâm AI – Đông A');
  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AiHubDashboard />
    </View>
  );
}
