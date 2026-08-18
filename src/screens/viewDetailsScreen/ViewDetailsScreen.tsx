import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import DiscussionNotesModal from '../../components/discussionNotesModal/DiscussionNotesModal';
import { showAlert } from '../../components/common/customAlert/alertService';
import { showToast } from '../../components/common/customToast/toastService';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fieldAddStop,
  type FieldAddStopPayload,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { compressSelfieToBase64 } from '../../utils/compressSelfie';
import { isCameraReady } from '../../utils/cameraGate';
import { getCurrentCoordinates } from '../../utils/locationGate';
import { createPointUuid } from '../../utils/pointUuid';
import { consumePendingVisitPhoto } from '../../utils/visitPhotoDraft';
import { createStyles } from './ViewDetailsScreenStyle';

type Props = NativeStackScreenProps<RootStackParamList, 'ViewDetails'>;

type ViewDetailsParams = {
  photoPath?: string;
  visitNote?: string;
};

function toFileUri(path: string) {
  return path.startsWith('file://') ? path : `file://${path}`;
}

const ViewDetailsScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const params = (route.params ?? {}) as ViewDetailsParams;

  const [notesVisible, setNotesVisible] = useState(false);
  const [visitNote, setVisitNote] = useState(params.visitNote ?? '');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    const noteFromParams = (route.params as ViewDetailsParams | undefined)
      ?.visitNote;
    if (typeof noteFromParams !== 'string') {
      return;
    }
    if (noteFromParams === visitNote) {
      return;
    }
    setVisitNote(noteFromParams);
  }, [route.params, visitNote]);

  useEffect(() => {
    const path = (route.params as ViewDetailsParams | undefined)?.photoPath;
    if (!path) {
      return;
    }
    setPhotoPath(path);
    navigation.setParams({ photoPath: undefined });
  }, [navigation, route.params]);

  useFocusEffect(
    useCallback(() => {
      const path = consumePendingVisitPhoto();
      if (!path) {
        return;
      }
      setPhotoPath(path);
    }, []),
  );

  const handleSaveNote = useCallback(
    (note: string) => {
      setVisitNote(note);
      navigation.setParams({ visitNote: note });
    },
    [navigation],
  );

  const handleCaptureSelfie = useCallback(async () => {
    if (openingCamera || submitting) {
      return;
    }
    setOpeningCamera(true);
    try {
      const ready = await isCameraReady();
      if (!ready) {
        showAlert({
          title: 'Camera Required',
          message: 'Please allow camera access to capture a selfie.',
        });
        return;
      }
      navigation.navigate(ScreenNames.SELFIE_CAMERA, {
        returnTo: 'visitStop',
      });
    } finally {
      setOpeningCamera(false);
    }
  }, [navigation, openingCamera, submitting]);

  const handleDone = useCallback(async () => {
    if (submittingRef.current) {
      return;
    }

    if (!accessToken) {
      showAlert({
        title: 'Session expired',
        message: 'Please log in again.',
      });
      return;
    }

    const note = visitNote.trim();
    if (!note) {
      showAlert({
        title: 'Visit note required',
        message: 'Please add a visit note before tapping Done.',
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const coords = await getCurrentCoordinates();

      let selfie: string | undefined;
      if (photoPath) {
        selfie = await compressSelfieToBase64(photoPath);
      }

      const payload: FieldAddStopPayload = {
        stop_uuid: createPointUuid(),
        point_uuid: createPointUuid(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        stop_type: 'customer_visit',
        note,
      };
      if (coords.accuracy != null) {
        payload.accuracy = coords.accuracy;
      }
      if (selfie) {
        payload.selfie = selfie;
      }

      await fieldAddStop(accessToken, payload);

      showToast({ message: 'Visit saved', durationMs: 3500 });
      navigation.goBack();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'add_stop_failed';
      showAlert({
        title: 'Could not save visit',
        message: getAuthErrorMessage(message),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [accessToken, navigation, photoPath, visitNote]);

  const hasNote = visitNote.trim().length > 0;
  const hasPhoto = Boolean(photoPath);
  const busy = openingCamera || submitting;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={isTablet ? 26 : 22}
            color={colors.textEnabled}
          />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          View Details
        </Text>
      </View>

      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.grid}>
            <Pressable
              style={styles.card}
              onPress={() => setNotesVisible(true)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Add Visit Note"
            >
              <View style={styles.iconBox}>
                <MaterialIcons
                  name={hasNote ? 'check-circle' : 'location-on'}
                  size={isTablet ? 28 : 22}
                  color={colors.button}
                />
              </View>
              <Text style={styles.cardLabel}>Add Visit Note</Text>
              <Text style={styles.cardStatus}>
                {hasNote ? 'Note added' : 'Tap to add'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.card}
              onPress={() => {
                void handleCaptureSelfie();
              }}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Capture selfie"
            >
              <View style={styles.iconBox}>
                <MaterialIcons
                  name={hasPhoto ? 'check-circle' : 'photo-camera-front'}
                  size={isTablet ? 28 : 22}
                  color={colors.button}
                />
              </View>
              <Text style={styles.cardLabel}>Capture selfie</Text>
              <Text style={styles.cardStatus}>
                {hasPhoto ? 'Selfie added' : 'Tap to add'}
              </Text>
            </Pressable>
          </View>

          {hasNote || hasPhoto ? (
            <View style={styles.previewSection}>
              <Text style={styles.previewTitle}>Visit preview</Text>
              <View style={styles.previewPanel}>
                {hasNote ? (
                  <View style={styles.previewBlock}>
                    <Text style={styles.previewBlockLabel}>Note</Text>
                    <View style={styles.noteBox}>
                      <Text style={styles.noteText} numberOfLines={5}>
                        {visitNote.trim()}
                      </Text>
                    </View>
                  </View>
                ) : null}

                {hasPhoto && photoPath ? (
                  <View
                    style={[
                      styles.previewBlock,
                      hasNote && styles.previewBlockSpaced,
                    ]}
                  >
                    <Text style={styles.previewBlockLabel}>Selfie</Text>
                    <View style={styles.selfieWrap}>
                      <Image
                        source={{ uri: toFileUri(photoPath) }}
                        style={styles.selfieImage}
                        resizeMode="cover"
                      />
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[styles.doneButton, busy && styles.doneButtonDisabled]}
            onPress={() => {
              void handleDone();
            }}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Done"
            accessibilityState={{ disabled: busy }}
          >
            <LinearGradient
              colors={[...colors.buttonGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.doneGradient}
            >
              {submitting ? (
                <ActivityIndicator color={colors.buttonText} />
              ) : (
                <Text style={styles.doneText}>Done</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <DiscussionNotesModal
        visible={notesVisible}
        initialNote={visitNote}
        onClose={() => setNotesVisible(false)}
        onSave={handleSaveNote}
      />
    </SafeAreaView>
  );
};

export default ViewDetailsScreen;
