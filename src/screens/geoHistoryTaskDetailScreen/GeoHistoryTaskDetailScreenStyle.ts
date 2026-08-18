import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
  isDark: boolean,
) => {
  const cardShadow = isDark
    ? {}
    : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
      };

  return StyleSheet.create({
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
    },
    headerButton: {
      width: isTablet ? 48 : 40,
      height: isTablet ? 48 : 40,
      borderRadius: 12,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1,
    },
    headerTitle: {
      flex: 1,
      marginLeft: isTablet ? 12 : 10,
      marginRight: 8,
      color: colors.textEnabled,
      fontSize: isTablet ? 22 : 18,
      fontWeight: '700',
      textAlign: 'left',
    },
    headerSpacer: {
      width: isTablet ? 48 : 40,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingBottom: isTablet ? 32 : 24,
      gap: isTablet ? 16 : 14,
    },
    card: {
      backgroundColor: colors.inputBox,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: isTablet ? 18 : 16,
      paddingVertical: isTablet ? 16 : 14,
      gap: isTablet ? 10 : 8,
      ...cardShadow,
    },
    sectionTitle: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '700',
    },
    title: {
      color: colors.textEnabled,
      fontSize: isTablet ? 20 : 18,
      fontWeight: '700',
    },
    subtitle: {
      color: colors.textDisabled,
      fontSize: isTablet ? 14 : 13,
      fontWeight: '500',
    },
    stateText: {
      color: colors.button,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '700',
      textTransform: 'capitalize',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isTablet ? 12 : 10,
    },
    metaItem: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
    },
    bodyText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '500',
      lineHeight: isTablet ? 22 : 20,
    },
    mutedText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 14 : 13,
      fontWeight: '500',
    },
    checklistRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
    },
    checklistText: {
      flex: 1,
      color: colors.textEnabled,
      fontSize: isTablet ? 14 : 13,
      fontWeight: '500',
      lineHeight: isTablet ? 20 : 18,
    },
    checklistDone: {
      textDecorationLine: 'line-through',
      color: colors.textDisabled,
    },
    imageRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isTablet ? 12 : 10,
    },
    imageThumb: {
      width: isTablet ? 112 : 96,
      height: isTablet ? 112 : 96,
      borderRadius: 12,
      backgroundColor: isDark ? '#0F1A2C' : '#F3F4F6',
    },
    selfieImage: {
      width: '100%',
      height: isTablet ? 220 : 180,
      borderRadius: 12,
      backgroundColor: isDark ? '#0F1A2C' : '#F3F4F6',
    },
    viewerModal: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.94)',
      justifyContent: 'center',
    },
    viewerClose: {
      position: 'absolute',
      top: isTablet ? 28 : 20,
      right: isTablet ? 28 : 20,
      zIndex: 2,
      width: isTablet ? 48 : 40,
      height: isTablet ? 48 : 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerNav: {
      position: 'absolute',
      top: '50%',
      marginTop: isTablet ? -24 : -20,
      zIndex: 2,
      width: isTablet ? 48 : 40,
      height: isTablet ? 48 : 40,
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerNavLeft: {
      left: isTablet ? 20 : 12,
    },
    viewerNavRight: {
      right: isTablet ? 20 : 12,
    },
    viewerImage: {
      width: '100%',
      height: '100%',
    },
    viewerCounter: {
      position: 'absolute',
      bottom: isTablet ? 36 : 28,
      alignSelf: 'center',
      color: '#FFFFFF',
      fontSize: isTablet ? 15 : 13,
      fontWeight: '600',
    },
    centerMessage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    errorText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '500',
      textAlign: 'center',
    },
  });
};
