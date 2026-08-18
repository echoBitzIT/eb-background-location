import { StyleSheet } from 'react-native';
import { ThemeColors } from '../../constants/Colors';

export const createStyles = (
  colors: ThemeColors,
  isTablet: boolean,
) => {
  const shutterSize = isTablet ? 84 : 72;
  const shutterInner = isTablet ? 64 : 56;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000000',
    },
    cameraLayer: {
      ...StyleSheet.absoluteFill,
    },
    topBar: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: isTablet ? 24 : 16,
      paddingTop: isTablet ? 4 : 2,
      zIndex: 2,
    },
    iconButton: {
      width: isTablet ? 48 : 40,
      height: isTablet ? 48 : 40,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.45)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      textAlign: 'center',
      color: '#FFFFFF',
      fontSize: isTablet ? 20 : 17,
      fontWeight: '700',
      marginRight: isTablet ? 48 : 40,
    },
    hint: {
      position: 'absolute',
      alignSelf: 'center',
      top: isTablet ? 96 : 80,
      color: '#FFFFFF',
      fontSize: isTablet ? 16 : 14,
      fontWeight: '500',
      textAlign: 'center',
      paddingHorizontal: 24,
      textShadowColor: 'rgba(0,0,0,0.6)',
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
      zIndex: 2,
    },
    bottomBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingBottom: isTablet ? 16 : 12,
      paddingHorizontal: isTablet ? 32 : 24,
      alignItems: 'center',
      zIndex: 2,
    },
    shutterOuter: {
      width: shutterSize,
      height: shutterSize,
      borderRadius: shutterSize / 2,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shutterInner: {
      width: shutterInner,
      height: shutterInner,
      borderRadius: shutterInner / 2,
      backgroundColor: '#FFFFFF',
    },
    shutterDisabled: {
      opacity: 0.45,
    },
    previewActions: {
      flexDirection: 'row',
      width: '100%',
      gap: isTablet ? 16 : 12,
    },
    secondaryButton: {
      flex: 1,
      height: isTablet ? 56 : 48,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: '#FFFFFF',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.35)',
    },
    secondaryButtonText: {
      color: '#FFFFFF',
      fontSize: isTablet ? 17 : 15,
      fontWeight: '700',
    },
    primaryButton: {
      flex: 1,
      height: isTablet ? 56 : 48,
      borderRadius: 12,
      overflow: 'hidden',
    },
    primaryGradient: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryButtonText: {
      color: colors.buttonText,
      fontSize: isTablet ? 17 : 15,
      fontWeight: '700',
    },
    errorWrap: {
      flex: 1,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    errorText: {
      color: colors.textEnabled,
      fontSize: isTablet ? 17 : 15,
      fontWeight: '500',
      textAlign: 'center',
      marginBottom: 20,
    },
    errorBackButton: {
      minWidth: 140,
      height: isTablet ? 52 : 44,
      borderRadius: 12,
      overflow: 'hidden',
    },
  });
};
