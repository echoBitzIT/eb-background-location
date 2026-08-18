import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
) => {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      backgroundColor: colors.background,
      borderTopLeftRadius: isTablet ? 28 : 24,
      borderTopRightRadius: isTablet ? 28 : 24,
      paddingHorizontal: isTablet ? 28 : 20,
      paddingTop: isTablet ? 28 : 24,
      paddingBottom: isTablet ? 28 : 24,
    },
    title: {
      color: colors.textEnabled,
      fontSize: isTablet ? 24 : 20,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: isTablet ? 8 : 6,
    },
    subtitle: {
      color: colors.textDisabled,
      fontSize: isTablet ? 15 : 13,
      fontWeight: '400',
      textAlign: 'center',
      marginBottom: isTablet ? 24 : 20,
    },
    input: {
      minHeight: isTablet ? 180 : 140,
      maxHeight: isTablet ? 260 : 220,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: isTablet ? 16 : 14,
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 16 : 14,
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 14,
      lineHeight: isTablet ? 24 : 20,
      textAlignVertical: 'top',
      marginBottom: isTablet ? 24 : 20,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isTablet ? 16 : 12,
    },
    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: isTablet ? 14 : 12,
      paddingVertical: isTablet ? 16 : 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    cancelText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      borderRadius: isTablet ? 14 : 12,
      overflow: 'hidden',
    },
    saveGradient: {
      paddingVertical: isTablet ? 16 : 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: {
      color: colors.buttonText,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '700',
    },
  });
};
