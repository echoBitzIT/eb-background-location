import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { showAlert } from '../../components/common/customAlert/alertService';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logoutAction } from '../../store/actions/authActions';
import { createStyles } from './SettingsScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.SETTINGS
>;

const SettingsScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);

  const dispatch = useAppDispatch();
  const logoutLoading = useAppSelector((state) => state.auth.logoutLoading);

  const handleLogout = async () => {
    await dispatch(logoutAction());
  };

  const handleLogoutPress = () => {
    if (logoutLoading) {
      return;
    }
    showAlert({
      title: 'Logout',
      message: 'Are you sure you want to log out?',
      cancelText: 'Cancel',
      confirmText: 'Logout',
      destructive: true,
      onConfirm: () => {
        void handleLogout();
      },
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={isTablet ? 26 : 22}
            color={colors.textEnabled}
          />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <View style={styles.content}>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate(ScreenNames.PROFILE)}
          accessibilityRole="button"
          accessibilityLabel="Profile"
        >
          <View style={styles.rowIconWrap}>
            <MaterialIcons
              name="person"
              size={isTablet ? 24 : 20}
              color={colors.textEnabled}
            />
          </View>
          <Text style={styles.rowLabel}>Profile</Text>
          <MaterialIcons
            name="chevron-right"
            size={isTablet ? 24 : 22}
            color={colors.textDisabled}
          />
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={handleLogoutPress}
          disabled={logoutLoading}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <View style={styles.rowIconWrap}>
            {logoutLoading ? (
              <ActivityIndicator size="small" color="#E53935" />
            ) : (
              <MaterialIcons
                name="logout"
                size={isTablet ? 24 : 20}
                color="#E53935"
              />
            )}
          </View>
          <Text style={[styles.rowLabel, styles.logoutLabel]}>Logout</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default SettingsScreen;
