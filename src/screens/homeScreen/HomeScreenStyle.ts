import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
) => {
  const avatarSize = isTablet ? 52 : 44;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 16 : 12,
      paddingBottom: isTablet ? 12 : 8,
    },
    navbarLeft: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: 12,
    },
    avatar: {
      width: avatarSize,
      height: avatarSize,
      borderRadius: avatarSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarInitials: {
      color: colors.buttonText,
      fontSize: isTablet ? 18 : 16,
      fontWeight: '700',
    },
    greetingWrap: {
      flex: 1,
      marginLeft: isTablet ? 14 : 12,
      justifyContent: 'center',
    },
    greeting: {
      color: colors.textDisabled,
      fontSize: isTablet ? 14 : 12,
      fontWeight: '400',
      marginBottom: 2,
    },
    name: {
      color: colors.textEnabled,
      fontSize: isTablet ? 22 : 18,
      fontWeight: '700',
    },
    checkInButton: {
      paddingHorizontal: isTablet ? 22 : 18,
      paddingVertical: isTablet ? 12 : 10,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkInText: {
      color: colors.buttonText,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '700',
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 24 : 20,
      paddingBottom: isTablet ? 32 : 24,
    },
    sectionTitle: {
      color: colors.textEnabled,
      fontSize: isTablet ? 28 : 24,
      fontWeight: '700',
      marginBottom: isTablet ? 16 : 14,
    },
    toolsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: isTablet ? 16 : 12,
    },
    toolCard: {
      width: '48%',
      backgroundColor: colors.inputBox,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: isTablet ? 28 : 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    toolIconWrap: {
      width: isTablet ? 64 : 56,
      height: isTablet ? 64 : 56,
      borderRadius: 14,
      backgroundColor: colors.button + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    toolLabel: {
      color: colors.textEnabled,
      fontSize: isTablet ? 18 : 16,
      fontWeight: '700',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: isTablet ? 28 : 24,
    },
    actionItem: {
      alignItems: 'center',
      width: isTablet ? 96 : 80,
    },
    actionIconWrap: {
      width: isTablet ? 64 : 56,
      height: isTablet ? 64 : 56,
      borderRadius: 14,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    actionLabel: {
      color: colors.textEnabled,
      fontSize: isTablet ? 15 : 13,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
};
