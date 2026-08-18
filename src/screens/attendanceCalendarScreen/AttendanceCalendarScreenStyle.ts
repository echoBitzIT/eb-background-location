import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
  isDark: boolean,
) => {
  const selectedDayBg = isDark ? '#0B1422' : '#1F2937';
  const dateStripBg = isDark ? '#0F1A2C' : '#F3F4F6';
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
    headerActions: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      zIndex: 1,
    },
    yearChip: {
      flexDirection: 'row',
      alignItems: 'center',
      height: isTablet ? 48 : 40,
      paddingHorizontal: isTablet ? 14 : 12,
      borderRadius: 12,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    yearChipText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '600',
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
      paddingHorizontal: isTablet ? 32 : 20,
      paddingTop: isTablet ? 20 : 16,
      paddingBottom: isTablet ? 32 : 24,
      gap: isTablet ? 20 : 16,
    },
    listModeContent: {
      paddingBottom: 0,
    },
    calendarCard: {
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: isTablet ? 20 : 16,
      paddingTop: isTablet ? 20 : 16,
      paddingBottom: isTablet ? 16 : 12,
    },
    calendarHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: isTablet ? 20 : 16,
    },
    dateBlock: {
      flexShrink: 1,
      paddingRight: 12,
    },
    selectedDateText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 28 : 24,
      fontWeight: '700',
    },
    selectedWeekdayText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '500',
      marginTop: 2,
    },
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    monthNavButton: {
      width: isTablet ? 36 : 32,
      height: isTablet ? 36 : 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: isTablet ? 10 : 8,
    },
    weekdayCell: {
      flex: 1,
      alignItems: 'center',
    },
    weekdayText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 14 : 12,
      fontWeight: '600',
    },
    daysGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    dayCell: {
      width: '14.2857%',
      alignItems: 'center',
      paddingVertical: isTablet ? 8 : 6,
      minHeight: isTablet ? 52 : 44,
    },
    dayNumberWrap: {
      width: isTablet ? 36 : 32,
      height: isTablet ? 36 : 32,
      borderRadius: isTablet ? 18 : 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumberWrapSelected: {
      backgroundColor: selectedDayBg,
    },
    dayNumber: {
      color: colors.textEnabled,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '600',
    },
    dayNumberOutside: {
      color: colors.textDisabled,
    },
    dayNumberSelected: {
      color: '#FFFFFF',
    },
    statusDot: {
      width: isTablet ? 7 : 6,
      height: isTablet ? 7 : 6,
      borderRadius: 4,
      marginTop: 4,
    },
    statusDotPlaceholder: {
      width: isTablet ? 7 : 6,
      height: isTablet ? 7 : 6,
      marginTop: 4,
    },
    legendGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      rowGap: isTablet ? 12 : 10,
    },
    legendItem: {
      width: '48%',
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: isTablet ? 14 : 12,
      paddingVertical: isTablet ? 14 : 12,
      gap: 10,
    },
    legendDot: {
      width: isTablet ? 14 : 12,
      height: isTablet ? 14 : 12,
      borderRadius: 7,
    },
    legendLabel: {
      flex: 1,
      color: colors.textEnabled,
      fontSize: isTablet ? 14 : 13,
      fontWeight: '600',
    },

    // List view
    monthPillsScroll: {
      flexGrow: 0,
    },
    monthPillsContent: {
      paddingRight: isTablet ? 8 : 4,
      gap: isTablet ? 10 : 8,
    },
    monthPill: {
      minWidth: isTablet ? 64 : 56,
      height: isTablet ? 40 : 36,
      borderRadius: isTablet ? 20 : 18,
      paddingHorizontal: isTablet ? 18 : 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
    },
    monthPillActive: {
      borderWidth: 0,
      paddingHorizontal: 0,
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    monthPillGradient: {
      minWidth: isTablet ? 64 : 56,
      height: '100%',
      paddingHorizontal: isTablet ? 18 : 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthPillText: {
      color: colors.textDisabled,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '600',
    },
    monthPillTextActive: {
      color: '#FFFFFF',
      fontSize: isTablet ? 15 : 14,
      fontWeight: '700',
    },
    dayList: {
      flex: 1,
    },
    dayListContent: {
      paddingBottom: isTablet ? 24 : 16,
      gap: isTablet ? 14 : 12,
    },
    dayCard: {
      flexDirection: 'row',
      backgroundColor: colors.inputBox,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.border,
      minHeight: isTablet ? 88 : 76,
      ...cardShadow,
    },
    dateStrip: {
      width: isTablet ? 72 : 64,
      backgroundColor: dateStripBg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: isTablet ? 14 : 12,
    },
    dateStripMonth: {
      color: colors.textDisabled,
      fontSize: isTablet ? 12 : 11,
      fontWeight: '600',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    dateStripDay: {
      color: colors.textEnabled,
      fontSize: isTablet ? 26 : 22,
      fontWeight: '700',
      marginTop: 2,
    },
    dayCardBody: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? 16 : 14,
      paddingVertical: isTablet ? 14 : 12,
    },
    punchList: {
      flex: 1,
      gap: isTablet ? 10 : 8,
    },
    punchRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    punchDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: isTablet ? 2 : 1,
    },
    timeColumn: {
      flex: 1,
    },
    timeLabel: {
      color: colors.textDisabled,
      fontSize: isTablet ? 12 : 11,
      fontWeight: '500',
      marginBottom: 4,
    },
    timeValue: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '700',
    },
    timeDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: colors.border,
      marginHorizontal: isTablet ? 14 : 12,
    },
    offDayWrap: {
      flex: 1,
      justifyContent: 'center',
    },
    offDayTitle: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 14,
      fontWeight: '700',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    offDaySubtitle: {
      color: colors.textDisabled,
      fontSize: isTablet ? 13 : 12,
      fontStyle: 'italic',
      fontWeight: '500',
      marginTop: 4,
    },
    statusBar: {
      width: isTablet ? 36 : 32,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusBarLetter: {
      color: '#FFFFFF',
      fontSize: isTablet ? 16 : 14,
      fontWeight: '700',
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
