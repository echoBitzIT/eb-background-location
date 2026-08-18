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
    headerAction: {
      minWidth: isTablet ? 64 : 56,
      paddingHorizontal: 8,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActionText: {
      color: colors.button,
      fontSize: isTablet ? 17 : 15,
      fontWeight: '700',
    },
    scrollContent: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 20 : 16,
      paddingBottom: isTablet ? 32 : 24,
      gap: isTablet ? 12 : 10,
    },
    profileCard: {
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 18 : 14,
      gap: isTablet ? 14 : 12,
    },
    avatarRow: {
      alignItems: 'center',
      gap: 8,
      marginBottom: 4,
    },
    avatarPressable: {
      position: 'relative',
    },
    avatar: {
      width: isTablet ? 96 : 80,
      height: isTablet ? 96 : 80,
      borderRadius: isTablet ? 48 : 40,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarPlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: isTablet ? 32 : 28,
      height: isTablet ? 32 : 28,
      borderRadius: isTablet ? 16 : 14,
      backgroundColor: colors.button,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.inputBox,
    },
    avatarHint: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
    },
    fieldRow: {
      gap: 4,
    },
    fieldLabel: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '600',
    },
    fieldValue: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '500',
    },
    fieldEmpty: {
      color: colors.placeholder,
      fontStyle: 'italic',
    },
    errorText: {
      color: '#E53935',
      fontSize: isTablet ? 14 : 13,
    },
    saveButton: {
      backgroundColor: colors.button,
      borderRadius: 12,
      paddingVertical: isTablet ? 16 : 14,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: isTablet ? 52 : 48,
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: colors.buttonText,
      fontSize: isTablet ? 17 : 15,
      fontWeight: '700',
    },
  });
