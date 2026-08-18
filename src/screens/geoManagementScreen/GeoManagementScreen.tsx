import React from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { createStyles } from './GeoManagementScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_MANAGEMENT
>;

const GeoManagementScreen = ({ navigation }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);

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
        <Text style={styles.headerTitle}>Geo Management</Text>
      </View>

      <View style={styles.content}>
        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate(ScreenNames.DEFAULT_ROUTE)}
          accessibilityRole="button"
          accessibilityLabel="Default Route"
        >
          <View style={styles.rowIconWrap}>
            <MaterialIcons
              name="how-to-reg"
              size={isTablet ? 24 : 22}
              color={colors.button}
            />
          </View>
          <Text style={styles.rowLabel}>Default Route</Text>
          <MaterialIcons
            name="chevron-right"
            size={isTablet ? 24 : 22}
            color={colors.textEnabled}
          />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          onPress={() => navigation.navigate(ScreenNames.TASK_ROUTING)}
          accessibilityRole="button"
          accessibilityLabel="Task Routing"
        >
          <View style={styles.rowIconWrap}>
            <MaterialIcons
              name="place"
              size={isTablet ? 24 : 22}
              color={colors.button}
            />
          </View>
          <Text style={styles.rowLabel}>Task Routing</Text>
          <MaterialIcons
            name="chevron-right"
            size={isTablet ? 24 : 22}
            color={colors.textEnabled}
          />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

export default GeoManagementScreen;
