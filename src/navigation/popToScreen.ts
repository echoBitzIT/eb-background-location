import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './AppNavigator';

type RootNavigation = NativeStackNavigationProp<RootStackParamList>;

export function popToScreen<Name extends keyof RootStackParamList>(
  navigation: RootNavigation,
  name: Name,
  params?: RootStackParamList[Name],
): void {
  const routes = navigation.getState()?.routes ?? [];
  if (routes.some((route) => route.name === name)) {
    if (params !== undefined) {
      navigation.popTo(name, params);
    } else {
      navigation.popTo(name);
    }
    return;
  }
  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }
  if (params !== undefined) {
    navigation.navigate(name, params);
  } else {
    navigation.navigate(name as Name);
  }
}
