import Toast from 'react-native-toast-message';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import { AlertProvider } from './src/components/common/customAlert/AlertProvider';
import { toastConfig } from './src/components/common/customToast/toastConfig';
import { ThemeProvider } from './src/theme/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { resetOdooBaseUrl } from './src/services/apiClient';
import { registerAuthSessionBridge } from './src/services/authSessionBridge';
import { updateLocationTrackingToken } from './src/services/locationTrackingService';
import {
  unregisterPushForSession,
} from './src/services/pushNotificationService';
import { clearSession, saveSession } from './src/services/sessionStorage';
import { store } from './src/store';
import { logout, setAuthTokens } from './src/store/reducers/authSlice';

registerAuthSessionBridge({
  getAccessToken: () => store.getState().auth.accessToken,
  getRefreshToken: () => store.getState().auth.refreshToken,
  applyRefreshedTokens: async (tokens) => {
    const auth = store.getState().auth;
    store.dispatch(
      setAuthTokens({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      }),
    );
    updateLocationTrackingToken(tokens.accessToken);
    if (auth.employee) {
      await saveSession({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        employee: auth.employee,
        website: auth.website,
        companyName: auth.companyName,
        companyLogo: auth.companyLogo,
        locationTrackingIntervalSeconds: auth.locationTrackingIntervalSeconds,
      });
    }
  },
  onAuthFailure: async () => {
    const token = store.getState().auth.accessToken;
    await unregisterPushForSession(token);
    updateLocationTrackingToken(null);
    await clearSession();
    resetOdooBaseUrl();
    store.dispatch(logout());
  },
});

const AppToast = () => {
  const insets = useSafeAreaInsets();
  return (
    <Toast
      config={toastConfig}
      position="bottom"
      bottomOffset={Math.max(insets.bottom, 16) + 12}
    />
  );
};

const App = () => {
  return (
    <SafeAreaProvider>
      <Provider store={store}>
        <ThemeProvider>
          <AlertProvider>
            <AppNavigator />
            <AppToast />
          </AlertProvider>
        </ThemeProvider>
      </Provider>
    </SafeAreaProvider>
  );
};

export default App;
