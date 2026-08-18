import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Use when SafeAreaView omits the bottom edge (FAB / overlays). */
export function useBottomContentPadding(extra = 0): number {
  const { bottom } = useSafeAreaInsets();
  // If inset is still 0 on some Android OEMs, keep a nav-bar floor.
  const safeBottom =
    Platform.OS === 'android' ? Math.max(bottom, 48) : bottom;
  return safeBottom + extra;
}
