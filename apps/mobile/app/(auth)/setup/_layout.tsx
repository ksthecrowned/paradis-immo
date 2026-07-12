import { SeekerSetupProvider } from '@/context/SeekerSetupContext';
import { Stack } from 'expo-router';

export default function SetupLayout(): React.JSX.Element {
  return (
    <SeekerSetupProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </SeekerSetupProvider>
  );
}
