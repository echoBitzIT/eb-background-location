import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Camera,
  useCameraDevice,
  usePhotoOutput,
} from 'react-native-vision-camera';
import { showAlert } from '../../components/common/customAlert/alertService';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { popToScreen } from '../../navigation/popToScreen';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { setPendingVisitPhoto } from '../../utils/visitPhotoDraft';
import { createStyles } from './SelfieCameraScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.SELFIE_CAMERA
>;

type Mode = 'camera' | 'preview';

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

function getCaptureErrorMessage(error: unknown): string {
  const raw = (
    error instanceof Error ? error.message : String(error)
  ).toLowerCase();
  if (raw.includes('camera is closed') || raw.includes('closed')) {
    return 'Capture was cancelled. Please try again.';
  }
  if (raw.includes('permission')) {
    return 'Camera permission is required to take a selfie.';
  }
  if (raw.includes('busy') || raw.includes('in use')) {
    return 'Camera is busy. Close other camera apps and try again.';
  }
  return 'Could not capture selfie. Please try again.';
}

const SelfieCameraScreen = ({ navigation, route }: Props) => {
  const { colors } = useAppTheme();
  const { isTablet } = useResponsive();
  const styles = createStyles(colors, isTablet);
  const isFocused = useIsFocused();
  const returnTo =
    (route.params as { returnTo?: 'checkIn' | 'visitStop' } | undefined)
      ?.returnTo ?? 'checkIn';

  const device = useCameraDevice('front');
  const photoOutput = usePhotoOutput();

  const [mode, setMode] = useState<Mode>('camera');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const leftScreenRef = useRef(false);

  const isCameraActive =
    (mode === 'camera' || capturing) && isFocused && !!device;

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!capturing) {
        return;
      }
      e.preventDefault();
    });
    return unsubscribe;
  }, [navigation, capturing]);

  const onClose = useCallback(() => {
    if (capturing) {
      return;
    }
    leftScreenRef.current = true;
    navigation.goBack();
  }, [capturing, navigation]);

  const onCapture = useCallback(async () => {
    if (capturing || !photoOutput) {
      return;
    }
    setCapturing(true);
    try {
      const photo = await photoOutput.capturePhoto({ flashMode: 'off' }, {});
      try {
        // Bake orientation + mirror into pixels (real-camera behavior)
        const image = await photo.toImageAsync();
        try {
          const path = await image.saveToTemporaryFileAsync('jpg', 90);
          setPhotoPath(path);
          setMode('preview');
        } finally {
          image.dispose();
        }
      } finally {
        photo.dispose();
      }
    } catch (error) {
      if (leftScreenRef.current) {
        return;
      }
      showAlert({
        title: "Couldn't take photo",
        message: getCaptureErrorMessage(error),
      });
    } finally {
      setCapturing(false);
    }
  }, [capturing, photoOutput]);

  const onRetake = useCallback(() => {
    setPhotoPath(null);
    setMode('camera');
  }, []);

  const onConfirm = useCallback(() => {
    if (!photoPath) {
      return;
    }
    if (returnTo === 'visitStop') {
      setPendingVisitPhoto(photoPath);
      leftScreenRef.current = true;
      navigation.goBack();
      return;
    }
    leftScreenRef.current = true;
    popToScreen(navigation, ScreenNames.CHECK_IN, { selfiePath: photoPath });
  }, [navigation, photoPath, returnTo]);

  if (!device) {
    return (
      <SafeAreaView style={styles.errorWrap} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <Text style={styles.errorText}>
          Front camera is not available on this device.
        </Text>
        <Pressable
          style={styles.errorBackButton}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <LinearGradient
            colors={[...colors.buttonGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.primaryGradient}
          >
            <Text style={styles.primaryButtonText}>Go back</Text>
          </LinearGradient>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        translucent
        barStyle="light-content"
        backgroundColor="transparent"
      />

      {mode === 'preview' && photoPath ? (
        <Image
          source={{ uri: toFileUri(photoPath) }}
          style={styles.cameraLayer}
          resizeMode="contain"
        />
      ) : (
        <Camera
          style={styles.cameraLayer}
          device={device}
          isActive={isCameraActive}
          outputs={[photoOutput]}
          orientationSource="device"
          mirrorMode="auto"
          resizeMode="cover"
          implementationMode="compatible"
        />
      )}

      <SafeAreaView edges={['top']} pointerEvents="box-none">
        <View style={styles.topBar} pointerEvents="box-none">
          <Pressable
            style={[styles.iconButton, capturing && styles.shutterDisabled]}
            onPress={onClose}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            accessibilityState={{ disabled: capturing }}
          >
            <MaterialIcons
              name="close"
              size={isTablet ? 26 : 22}
              color="#FFFFFF"
            />
          </Pressable>
          <Text style={styles.title}>
            {mode === 'preview' ? 'Confirm selfie' : 'Take a selfie'}
          </Text>
        </View>
      </SafeAreaView>

      <SafeAreaView
        edges={['bottom']}
        style={styles.bottomBar}
        pointerEvents="box-none"
      >
        {mode === 'camera' ? (
          <Pressable
            style={[styles.shutterOuter, capturing && styles.shutterDisabled]}
            onPress={onCapture}
            disabled={capturing}
            accessibilityRole="button"
            accessibilityLabel="Capture selfie"
          >
            {capturing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        ) : (
          <View style={styles.previewActions}>
            <Pressable
              style={styles.secondaryButton}
              onPress={onRetake}
              accessibilityRole="button"
              accessibilityLabel="Retake selfie"
            >
              <Text style={styles.secondaryButtonText}>Retake</Text>
            </Pressable>
            <Pressable
              style={styles.primaryButton}
              onPress={onConfirm}
              accessibilityRole="button"
              accessibilityLabel="Confirm selfie"
            >
              <LinearGradient
                colors={[...colors.buttonGradient]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={styles.primaryGradient}
              >
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </LinearGradient>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </SafeAreaView>
  );
};

export default SelfieCameraScreen;
