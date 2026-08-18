import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
) =>
  StyleSheet.create({
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
    titleOnlySpacing: {
      marginBottom: isTablet ? 24 : 20,
    },
    optionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: isTablet ? 16 : 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
      gap: 12,
    },
    optionRowLast: {
      borderBottomWidth: 0,
    },
    optionLabelWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isTablet ? 14 : 12,
    },
    optionText: {
      flex: 1,
      color: colors.textEnabled,
      fontSize: isTablet ? 17 : 16,
      fontWeight: '500',
    },
    childrenWrap: {
      marginTop: isTablet ? 8 : 4,
    },
  });
