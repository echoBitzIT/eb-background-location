import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 16 : 12,
      paddingBottom: isTablet ? 12 : 8,
      gap: 8,
    },
    backButton: {
      width: isTablet ? 48 : 40,
      height: isTablet ? 48 : 40,
      borderRadius: 12,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: {
      flex: 1,
      color: colors.textEnabled,
      fontSize: isTablet ? 22 : 18,
      fontWeight: '700',
    },
    content: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 20 : 16,
      gap: isTablet ? 12 : 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 18 : 14,
      gap: 12,
    },
    rowIconWrap: {
      width: isTablet ? 40 : 36,
      height: isTablet ? 40 : 36,
      borderRadius: 10,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: {
      flex: 1,
      color: colors.textEnabled,
      fontSize: isTablet ? 17 : 15,
      fontWeight: '600',
    },
    logoutLabel: {
      color: '#E53935',
    },
  });
