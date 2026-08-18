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
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: isTablet ? 48 : 24,
      paddingVertical: isTablet ? 40 : 24,
    },
    formContainer: {
      width: '100%',
      maxWidth: contentMaxWidth,
    },
    logoWrap: {
      alignItems: 'center',
      marginBottom: isTablet ? 48 : 40,
    },
    logo: {
      width: isTablet ? 180 : 140,
      height: isTablet ? 180 : 140,
    },
    companyName: {
      marginTop: 12,
      color: colors.textEnabled,
      fontSize: isTablet ? 18 : 16,
      fontWeight: '600',
      textAlign: 'center',
    },
    termsRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      marginTop: 4,
      gap: 10,
    },
    checkbox: {
      marginTop: 2,
    },
    termsText: {
      flex: 1,
      color: colors.textDisabled,
      fontSize: 13,
      lineHeight: 20,
    },
    link: {
      color: colors.button,
      fontWeight: '600',
    },
    loginButton: {
      marginTop: 4,
    },
  });
