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
    content: {
      flex: 1,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 12 : 8,
    },
    summaryCard: {
      backgroundColor: colors.inputBox,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: isTablet ? 18 : 16,
      paddingVertical: isTablet ? 16 : 14,
      marginBottom: isTablet ? 16 : 12,
      gap: isTablet ? 10 : 8,
      ...cardShadow,
    },
    summaryMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isTablet ? 12 : 10,
    },
    summaryMetaItem: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
    },
    summaryState: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
      textTransform: 'capitalize',
    },
    taskList: {
      flex: 1,
    },
    taskListContent: {
      paddingBottom: isTablet ? 24 : 16,
      gap: isTablet ? 12 : 10,
    },
    taskCard: {
      backgroundColor: colors.inputBox,
      borderRadius: 16,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      paddingHorizontal: isTablet ? 18 : 16,
      paddingVertical: isTablet ? 16 : 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      ...cardShadow,
    },
    taskCardBody: {
      flex: 1,
      gap: 4,
    },
    taskName: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '700',
    },
    taskAddress: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
    },
    taskMeta: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
      textTransform: 'capitalize',
      marginTop: 2,
    },
    routeChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: isTablet ? 12 : 10,
      paddingVertical: isTablet ? 8 : 6,
      borderRadius: 10,
      backgroundColor: isDark ? '#0F1A2C' : '#F3F4F6',
      borderWidth: 1,
      borderColor: colors.border,
    },
    routeChipText: {
      color: colors.button,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '600',
    },
    emptyListText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '500',
      textAlign: 'center',
      marginTop: isTablet ? 40 : 32,
    },
  });
};
