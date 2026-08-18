import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { AUTH_ERRORS, getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import { popToScreen } from '../../navigation/popToScreen';
import {
  completeFieldTask,
  fetchFieldTaskDetail,
  isRequestCanceled,
  patchFieldStopNote,
  uploadStopSelfie,
  type FieldTaskLastVisit,
  type FieldTaskRequirements,
} from '../../services/apiClient';
import {
  clearTaskProgress,
  formatOdooDeviceTimestamp,
  loadTaskProgress,
  saveTaskProgress,
} from '../../services/taskProgressStorage';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { compressSelfieToBase64 } from '../../utils/compressSelfie';
import { isCameraReady } from '../../utils/cameraGate';
import { getCurrentCoordinates } from '../../utils/locationGate';
import { createPointUuid } from '../../utils/pointUuid';
import {
  formatPauseReasonLine,
  syncTrackingAfterTaskTerminal,
} from '../../utils/fieldTaskUi';
import { consumePendingVisitPhoto } from '../../utils/visitPhotoDraft';
import { createStyles } from './TaskCaptureScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.TASK_CAPTURE
>;

function toDataUri(base64: string): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:image/jpeg;base64,${base64}`;
}

function formatArrivedAt(value?: string | false): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const raw = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatLastVisit(visit?: FieldTaskLastVisit | false | null): string | null {
  if (!visit || typeof visit !== 'object') {
    return null;
  }
  if (typeof visit.stop_datetime === 'string' && visit.stop_datetime) {
    const raw = visit.stop_datetime.replace(' ', 'T') + 'Z';
    const then = new Date(raw).getTime();
    if (Number.isFinite(then)) {
      const days = Math.max(
        0,
        Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000)),
      );
      if (days === 0) {
        return 'Last Visit: today';
      }
      if (days === 1) {
        return 'Last Visit: 1 day ago';
      }
      return `Last Visit: ${days} days ago`;
    }
  }
  return 'Last Visit: previous visit';
}

function statusLabel(status?: string): string {
  if (!status) {
    return 'Active';
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const TaskCaptureScreen = ({ navigation, route }: Props) => {
  const {
    taskId,
    stopId,
    requirements: requirementsParam,
    title: titleParam,
    address: addressParam,
  } = route.params;
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [requirements, setRequirements] = useState<FieldTaskRequirements>(
    requirementsParam ?? {
      note_required: false,
      selfie_required: false,
      max_images: 0,
    },
  );
  const [storeTitle, setStoreTitle] = useState(titleParam?.trim() || 'Task');
  const [storeAddress, setStoreAddress] = useState(
    addressParam?.trim() || '—',
  );
  const [taskStatus, setTaskStatus] = useState('active');
  const [arrivedLabel, setArrivedLabel] = useState<string | null>(null);
  const [lastVisitLabel, setLastVisitLabel] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  const [notesVisible, setNotesVisible] = useState(false);
  const [visitNote, setVisitNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [selfieSaved, setSelfieSaved] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [uploadingSelfie, setUploadingSelfie] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [pauseReasonLine, setPauseReasonLine] = useState<string | null>(null);

  const busy = openingCamera || savingNote || uploadingSelfie || submitting;

  const canDone =
    (!requirements.note_required || noteSaved) &&
    (!requirements.selfie_required || selfieSaved) &&
    !busy;

  const loadDetail = useCallback(
    async (isCancelled: () => boolean) => {
      if (!accessToken) {
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      try {
        const detail = await fetchFieldTaskDetail(accessToken, taskId);
        if (isCancelled()) {
          return;
        }
        const title =
          (typeof detail.partner_name === 'string' &&
            detail.partner_name.trim()) ||
          detail.name ||
          titleParam ||
          'Task';
        const address =
          (typeof detail.address === 'string' && detail.address.trim()) ||
          addressParam ||
          '—';
        setStoreTitle(title);
        setStoreAddress(address);
        setTaskStatus(detail.status || 'active');
        setArrivedLabel(formatArrivedAt(detail.arrived_at));
        setLastVisitLabel(formatLastVisit(detail.last_visit));
        if (detail.requirements) {
          setRequirements(detail.requirements);
        }
        setPauseReasonLine(
          detail.status === 'paused' ? formatPauseReasonLine(detail) : null,
        );
        const openStop =
          detail.open_stop && typeof detail.open_stop === 'object'
            ? detail.open_stop
            : null;
        if (openStop) {
          if (
            typeof openStop.visit_note === 'string' &&
            openStop.visit_note.trim()
          ) {
            setVisitNote(openStop.visit_note);
            setNoteSaved(true);
          }
          if (openStop.has_selfie) {
            setSelfieSaved(true);
          }
        }
      } catch (e) {
        if (isCancelled() || isRequestCanceled(e)) {
          return;
        }
        // Keep param-based title/address.
      } finally {
        if (!isCancelled()) {
          setDetailLoading(false);
        }
      }
    },
    [accessToken, addressParam, taskId, titleParam],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadDetail(() => cancelled);

      const path = consumePendingVisitPhoto();
      if (path) {
        void (async () => {
          if (!accessToken) {
            return;
          }
          setUploadingSelfie(true);
          try {
            const base64 = await compressSelfieToBase64(path);
            await uploadStopSelfie(accessToken, stopId, toDataUri(base64));
            setSelfieSaved(true);
            showToast({ message: 'Selfie saved', durationMs: 2500 });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'stop_selfie_failed';
            if (message === AUTH_ERRORS.STOP_CLOSED) {
              showAlert({
                title: 'Visit closed',
                message: getAuthErrorMessage(message),
                onConfirm: () =>
                  popToScreen(navigation, ScreenNames.TASK_ROUTING),
              });
              return;
            }
            showAlert({
              title: 'Could not upload selfie',
              message: getAuthErrorMessage(message),
            });
          } finally {
            setUploadingSelfie(false);
          }
        })();
      }

      return () => {
        cancelled = true;
      };
    }, [accessToken, loadDetail, navigation, stopId]),
  );

  useEffect(() => {
    void loadTaskProgress(taskId).then((progress) => {
      if (
        typeof progress.stop_id !== 'number' ||
        progress.stop_id !== stopId
      ) {
        void saveTaskProgress(taskId, { stop_id: stopId });
      }
    });
  }, [stopId, taskId]);

  const handleSaveNote = useCallback(
    async (note: string) => {
      setVisitNote(note);
      if (!accessToken) {
        showAlert({
          title: 'Session expired',
          message: 'Please log in again.',
        });
        return;
      }
      setSavingNote(true);
      try {
        await patchFieldStopNote(accessToken, stopId, note);
        setNoteSaved(note.trim().length > 0);
        showToast({ message: 'Note saved', durationMs: 2500 });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'stop_update_failed';
        if (message === AUTH_ERRORS.STOP_CLOSED) {
          showAlert({
            title: 'Visit closed',
            message: getAuthErrorMessage(message),
            onConfirm: () => popToScreen(navigation, ScreenNames.TASK_ROUTING),
          });
          return;
        }
        showAlert({
          title: 'Could not save note',
          message: getAuthErrorMessage(message),
        });
      } finally {
        setSavingNote(false);
      }
    },
    [accessToken, navigation, stopId],
  );

  const handleCaptureSelfie = useCallback(async () => {
    if (busy) {
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
  }, [busy, navigation]);

  const handleDone = useCallback(async () => {
    if (submittingRef.current || !canDone) {
      return;
    }
    if (!accessToken) {
      showAlert({
        title: 'Session expired',
        message: 'Please log in again.',
      });
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const progress = await loadTaskProgress(taskId);
      const checklist_done = progress.checklist_done ?? [];
      const coords = await getCurrentCoordinates();
      const completeUuid =
        progress.complete_point_uuid || createPointUuid();
      await saveTaskProgress(taskId, {
        complete_point_uuid: completeUuid,
      });

      await completeFieldTask(accessToken, taskId, {
        checklist_done,
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy:
          typeof coords.accuracy === 'number' ? coords.accuracy : undefined,
        point_uuid: completeUuid,
        device_timestamp: formatOdooDeviceTimestamp(),
      });

      await clearTaskProgress(taskId);
      await syncTrackingAfterTaskTerminal(accessToken);
      showToast({ message: 'Task completed', durationMs: 3000 });
      popToScreen(navigation, ScreenNames.TASK_ROUTING);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'task_complete_failed';
      if (message === AUTH_ERRORS.STOP_NOTE_REQUIRED) {
        showAlert({
          title: 'Visit note required',
          message: getAuthErrorMessage(message),
          onConfirm: () => setNotesVisible(true),
        });
        return;
      }
      if (message === AUTH_ERRORS.SELFIE_REQUIRED_STOP) {
        showAlert({
          title: 'Selfie required',
          message: getAuthErrorMessage(message),
          onConfirm: () => {
            void handleCaptureSelfie();
          },
        });
        return;
      }
      if (message === AUTH_ERRORS.TASK_CHECKLIST_INCOMPLETE) {
        showAlert({
          title: 'Checklist incomplete',
          message: getAuthErrorMessage(message),
          onConfirm: () =>
            navigation.navigate(ScreenNames.WHAT_NEEDS_TO_BE_DONE, {
              taskId,
            }),
        });
        return;
      }
      if (message === AUTH_ERRORS.STOP_CLOSED) {
        showAlert({
          title: 'Visit closed',
          message: getAuthErrorMessage(message),
          onConfirm: () => popToScreen(navigation, ScreenNames.TASK_ROUTING),
        });
        return;
      }
      showAlert({
        title: 'Could not complete task',
        message: getAuthErrorMessage(message),
      });
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }, [accessToken, canDone, handleCaptureSelfie, navigation, taskId]);

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
          Capture Visit
        </Text>
      </View>

      <View style={styles.content}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.infoCard}>
            <View style={styles.titleRow}>
              <Text style={styles.storeTitle} numberOfLines={2}>
                {storeTitle}
              </Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>
                  {statusLabel(taskStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <MaterialIcons
                name="place"
                size={isTablet ? 18 : 16}
                color={colors.textEnabled}
              />
              <Text style={styles.metaText}>{storeAddress}</Text>
            </View>

            {pauseReasonLine ? (
              <Text style={styles.pauseReasonText}>{pauseReasonLine}</Text>
            ) : null}

            {(arrivedLabel || lastVisitLabel) && (
              <>
                <View style={styles.divider} />
                <View style={styles.timeRow}>
                  {arrivedLabel ? (
                    <View style={styles.timeItem}>
                      <MaterialIcons
                        name="schedule"
                        size={isTablet ? 16 : 14}
                        color={colors.textDisabled}
                      />
                      <Text style={styles.timeText}>
                        Arrived: {arrivedLabel}
                      </Text>
                    </View>
                  ) : (
                    <View />
                  )}
                  {lastVisitLabel ? (
                    <Text style={styles.timeText}>{lastVisitLabel}</Text>
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.actionsDivider} />

            {detailLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={colors.button} />
              </View>
            ) : null}

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.actionTile}
                onPress={() => setNotesVisible(true)}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Add Visit Note"
              >
                <View style={styles.actionIconBox}>
                  <MaterialIcons
                    name={noteSaved ? 'check-circle' : 'location-on'}
                    size={isTablet ? 26 : 22}
                    color={colors.button}
                  />
                </View>
                <Text style={styles.actionLabel}>Add Visit Note</Text>
                <Text style={styles.actionStatus}>
                  {savingNote
                    ? 'Saving…'
                    : noteSaved
                      ? 'Note saved'
                      : requirements.note_required
                        ? 'Required'
                        : 'Tap to add'}
                </Text>
              </Pressable>

              <Pressable
                style={styles.actionTile}
                onPress={() => {
                  void handleCaptureSelfie();
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Capture Selfie"
              >
                <View style={styles.actionIconBox}>
                  <MaterialIcons
                    name={
                      selfieSaved ? 'check-circle' : 'photo-camera-front'
                    }
                    size={isTablet ? 26 : 22}
                    color={colors.button}
                  />
                </View>
                <Text style={styles.actionLabel}>Capture Selfie</Text>
                <Text style={styles.actionStatus}>
                  {uploadingSelfie
                    ? 'Uploading…'
                    : selfieSaved
                      ? 'Selfie saved'
                      : requirements.selfie_required
                        ? 'Required'
                        : 'Tap to add'}
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.doneButton,
              (!canDone || submitting) && styles.doneButtonDisabled,
            ]}
            onPress={() => {
              void handleDone();
            }}
            disabled={!canDone || submitting}
            accessibilityRole="button"
            accessibilityLabel="Done"
            accessibilityState={{ disabled: !canDone || submitting }}
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
        onSave={(note) => {
          setNotesVisible(false);
          void handleSaveNote(note);
        }}
      />
    </SafeAreaView>
  );
};

export default TaskCaptureScreen;
