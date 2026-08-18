import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
) => {
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
    mapWrap: {
      flex: 1,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      overflow: 'hidden',
    },
    map: {
      flex: 1,
      backgroundColor: colors.inputBox,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: isTablet ? 24 : 18,
      paddingVertical: isTablet ? 14 : 12,
      paddingHorizontal: isTablet ? 32 : 20,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendSwatch: {
      width: isTablet ? 18 : 14,
      height: isTablet ? 6 : 5,
      borderRadius: 3,
    },
    legendLabel: {
      color: colors.textDisabled,
      fontSize: isTablet ? 14 : 12,
      fontWeight: '600',
    },
    centerMessage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isTablet ? 40 : 28,
    },
    messageText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: isTablet ? 24 : 20,
    },
    errorText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '500',
      textAlign: 'center',
      lineHeight: isTablet ? 24 : 20,
    },
  });
};
