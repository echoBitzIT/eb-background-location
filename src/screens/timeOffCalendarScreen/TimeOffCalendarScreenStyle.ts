import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
  contentMaxWidth: number,
  isDark: boolean,
) => {
  const fabSize = isTablet ? 64 : 56;
  const mutedText = colors.textDisabled;
  const badgePendingBg = isDark ? '#3D2E14' : '#FEF3C7';
  const badgePendingText = isDark ? '#FBBF24' : '#B45309';
  const badgeApprovedBg = isDark ? '#1E3A5F' : '#DBEAFE';
  const badgeApprovedText = isDark ? '#93C5FD' : '#1D4ED8';
  const badgeRefusedBg = isDark ? '#3F1D1D' : '#FEE2E2';
  const badgeRefusedText = isDark ? '#FCA5A5' : '#B91C1C';
  const badgeCancelledBg = isDark ? '#1F2A1F' : '#DCFCE7';
  const badgeCancelledText = isDark ? '#86EFAC' : '#15803D';

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
    },
    content: {
      flex: 1,
      width: '100%',
      maxWidth: contentMaxWidth,
      alignSelf: 'center',
    },
    listHeader: {
      paddingTop: isTablet ? 12 : 8,
      paddingBottom: isTablet ? 12 : 8,
      gap: isTablet ? 16 : 14,
    },
    listContent: {
      paddingHorizontal: isTablet ? 32 : 20,
      gap: isTablet ? 12 : 10,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isTablet ? 10 : 8,
    },
    chip: {
      borderRadius: 20,
      overflow: 'hidden',
    },
    chipInner: {
      paddingHorizontal: isTablet ? 18 : 14,
      paddingVertical: isTablet ? 10 : 8,
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 20,
    },
    chipInnerSelected: {
      borderWidth: 0,
    },
    chipText: {
      color: mutedText,
      fontSize: isTablet ? 14 : 13,
      fontWeight: '600',
    },
    chipTextSelected: {
      color: colors.buttonText,
    },
    pendingCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: isTablet ? 20 : 16,
      paddingVertical: isTablet ? 18 : 14,
    },
    pendingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pendingLabel: {
      color: mutedText,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '700',
      letterSpacing: 0.6,
    },
    pendingRight: {
      alignItems: 'flex-end',
    },
    pendingCount: {
      color: colors.textEnabled,
      fontSize: isTablet ? 32 : 28,
      fontWeight: '700',
      lineHeight: isTablet ? 36 : 32,
    },
    pendingHint: {
      color: mutedText,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
      marginTop: 2,
    },
    sectionTitle: {
      color: colors.textEnabled,
      fontSize: isTablet ? 18 : 16,
      fontWeight: '700',
      marginTop: isTablet ? 4 : 2,
    },
    leaveCard: {
      backgroundColor: colors.inputBox,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: isTablet ? 16 : 14,
      paddingTop: isTablet ? 14 : 12,
      paddingBottom: isTablet ? 12 : 10,
    },
    leaveCardTop: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    leaveIconWrap: {
      width: isTablet ? 44 : 40,
      height: isTablet ? 44 : 40,
      borderRadius: 12,
      backgroundColor: isDark ? '#1A2B45' : '#E8F1FE',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: isTablet ? 12 : 10,
    },
    leaveMain: {
      flex: 1,
      minWidth: 0,
      paddingRight: 8,
    },
    leaveTitle: {
      color: colors.textEnabled,
      fontSize: isTablet ? 16 : 15,
      fontWeight: '700',
    },
    leaveDates: {
      color: mutedText,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
      marginTop: 2,
    },
    statusBadge: {
      borderRadius: 8,
      paddingHorizontal: isTablet ? 10 : 8,
      paddingVertical: isTablet ? 5 : 4,
    },
    statusBadgePending: {
      backgroundColor: badgePendingBg,
    },
    statusBadgeApproved: {
      backgroundColor: badgeApprovedBg,
    },
    statusBadgeRefused: {
      backgroundColor: badgeRefusedBg,
    },
    statusBadgeCancelled: {
      backgroundColor: badgeCancelledBg,
    },
    statusBadgeText: {
      fontSize: isTablet ? 12 : 11,
      fontWeight: '700',
    },
    statusBadgeTextPending: {
      color: badgePendingText,
    },
    statusBadgeTextApproved: {
      color: badgeApprovedText,
    },
    statusBadgeTextRefused: {
      color: badgeRefusedText,
    },
    statusBadgeTextCancelled: {
      color: badgeCancelledText,
    },
    leaveDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginTop: isTablet ? 12 : 10,
      marginBottom: isTablet ? 10 : 8,
    },
    leaveCardBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    leaveDurationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      flex: 1,
    },
    leaveDuration: {
      color: mutedText,
      fontSize: isTablet ? 13 : 12,
      fontWeight: '500',
    },
    kebabButton: {
      padding: 4,
    },
    errorText: {
      color: '#FF4444',
      fontSize: isTablet ? 14 : 13,
      fontWeight: '500',
    },
    emptyText: {
      color: mutedText,
      fontSize: isTablet ? 15 : 14,
      fontWeight: '500',
      textAlign: 'center',
      paddingVertical: isTablet ? 24 : 16,
    },
    loadingWrap: {
      paddingVertical: isTablet ? 40 : 32,
      alignItems: 'center',
    },
    fab: {
      position: 'absolute',
      right: isTablet ? 32 : 20,
      bottom: isTablet ? 32 : 24,
      width: fabSize,
      height: fabSize,
      borderRadius: fabSize / 2,
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
    fabGradient: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
};
