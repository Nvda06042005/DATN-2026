/** /hoc-sinh – game học sinh; đường link thầy cô gửi có thể kèm ?pin=123456 để vào thẳng phòng thi đấu */
import { useLocalSearchParams } from 'expo-router';
import { PortalApp } from '@/components/auth';
import { GameShell } from '@/components/game/GameShell';

export default function StudentRoute() {
  const { pin } = useLocalSearchParams<{ pin?: string }>();
  const initialPin = typeof pin === 'string' && /^\d{6}$/.test(pin) ? pin : null;
  return <PortalApp portal="student">{(session) => <GameShell session={session} initialPin={initialPin} />}</PortalApp>;
}
