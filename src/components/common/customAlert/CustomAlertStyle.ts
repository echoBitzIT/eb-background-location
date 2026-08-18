import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../constants/Colors';

export const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      paddingHorizontal: 24,
    },
    card: {
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 16,
    },
    title: {
      color: colors.textEnabled,
      fontSize: 18,
      fontWeight: '700',
      marginBottom: 8,
    },
    message: {
      color: colors.textDisabled,
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 20,
    },
    actions: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'stretch',
      gap: 12,
    },
    buttonSlot: {
      flex: 1,
    },
    cancelButton: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    cancelText: {
      color: colors.textEnabled,
      fontSize: 15,
      fontWeight: '600',
    },
    confirmButton: {
      borderRadius: 8,
      overflow: 'hidden',
      minHeight: 52,
      justifyContent: 'center',
    },
    confirmGradient: {
      ...StyleSheet.absoluteFill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    confirmText: {
      color: colors.buttonText,
      fontSize: 15,
      fontWeight: '600',
    },
    destructiveButton: {
      backgroundColor: '#E53935',
      borderRadius: 8,
      paddingVertical: 16,
      paddingHorizontal: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
    },
    destructiveText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '600',
    },
    singleConfirm: {
      width: '100%',
    },
  });
