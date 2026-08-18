import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchFieldStopDetail,
  fetchFieldTaskDetail,
  isRequestCanceled,
  type FieldStopDetail,
  type FieldTaskChecklistLine,
  type FieldTaskDetail,
} from '../../services/apiClient';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useResponsive } from '../../hooks/useResponsive';
import { TaskDetailSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './GeoHistoryTaskDetailScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.GEO_HISTORY_TASK_DETAIL
>;

function formatClock(value: string | false | undefined) {
  if (!value) {
    return '—';
  }
  const parts = value.split(' ');
  const time = parts[1];
  if (!time) {
    return value;
  }
  return time.slice(0, 5);
}

function toImageUri(raw: string): string {
  if (raw.startsWith('data:') || raw.startsWith('http')) {
    return raw;
  }
  return `data:image/jpeg;base64,${raw}`;
}

const GeoHistoryTaskDetailScreen = ({ navigation, route }: Props) => {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth, isDark);
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const { taskId, stopId: stopIdParam, sessionId: sessionIdParam } =
    route.params;

  const [task, setTask] = useState<FieldTaskDetail | null>(null);
  const [stop, setStop] = useState<FieldStopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const iconSize = isTablet ? 26 : 22;

  const headerTitle = useMemo(() => {
    if (task?.name) {
      return task.name;
    }
    return 'Task';
  }, [task?.name]);

  const resolvedSessionId = useMemo(() => {
    if (typeof sessionIdParam === 'number' && sessionIdParam > 0) {
      return sessionIdParam;
    }
    if (task && typeof task.session_id === 'number' && task.session_id > 0) {
      return task.session_id;
    }
    return null;
  }, [sessionIdParam, task]);

  const handleViewRoute = () => {
    if (!task || resolvedSessionId == null) {
      return;
    }
    navigation.navigate(ScreenNames.GEO_HISTORY_MAP, {
      sessionId: resolvedSessionId,
      taskId: task.task_id,
      taskName: task.name,
    });
  };

  useEffect(() => {
    if (!accessToken) {
      setError('Session expired. Please log in again.');
      setTask(null);
      setStop(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const detail = await fetchFieldTaskDetail(accessToken, taskId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        setTask(detail);

        const resolvedStopId =
          typeof stopIdParam === 'number' && stopIdParam > 0
            ? stopIdParam
            : typeof detail.stop_id === 'number' && detail.stop_id > 0
              ? detail.stop_id
              : detail.open_stop &&
                  typeof detail.open_stop === 'object' &&
                  typeof detail.open_stop.stop_id === 'number'
                ? detail.open_stop.stop_id
                : null;

        if (resolvedStopId) {
          try {
            const stopDetail = await fetchFieldStopDetail(
              accessToken,
              resolvedStopId,
              { include_images: true },
              { signal: controller.signal },
            );
            if (!controller.signal.aborted) {
              setStop(stopDetail);
            }
          } catch (stopError) {
            if (
              controller.signal.aborted ||
              isRequestCanceled(stopError)
            ) {
              return;
            }
            setStop(null);
          }
        } else {
          setStop(null);
        }
      } catch (e) {
        if (controller.signal.aborted || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'task_detail_failed';
        setError(getAuthErrorMessage(message));
        setTask(null);
        setStop(null);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accessToken, stopIdParam, taskId]);

  const renderChecklist = (
    title: string,
    lines: FieldTaskChecklistLine[],
  ) => {
    if (lines.length === 0) {
      return null;
    }
    return (
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {lines.map((line) => (
          <View key={line.id} style={styles.checklistRow}>
            <MaterialIcons
              name={line.is_done ? 'check-box' : 'check-box-outline-blank'}
              size={isTablet ? 22 : 20}
              color={line.is_done ? colors.button : colors.textDisabled}
            />
            <Text
              style={[
                styles.checklistText,
                line.is_done && styles.checklistDone,
              ]}
            >
              {line.name}
              {line.is_required ? ' *' : ''}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const visitNote =
    stop && typeof stop.visit_note === 'string' && stop.visit_note
      ? stop.visit_note
      : null;

  const { selfieUri, galleryUris, viewerUris } = useMemo(() => {
    const selfie =
      stop && typeof stop.selfie === 'string' && stop.selfie
        ? toImageUri(stop.selfie)
        : null;
    const gallery = (stop?.images ?? [])
      .filter((img) => typeof img.image === 'string' && img.image.length > 0)
      .map((img) => ({
        id: img.id,
        uri: toImageUri(String(img.image)),
      }));
    const uris: string[] = [];
    if (selfie) {
      uris.push(selfie);
    }
    for (const item of gallery) {
      uris.push(item.uri);
    }
    return {
      selfieUri: selfie,
      galleryUris: gallery,
      viewerUris: uris,
    };
  }, [stop]);

  const openViewer = (uri: string) => {
    const index = viewerUris.indexOf(uri);
    setViewerIndex(index >= 0 ? index : 0);
  };

  const closeViewer = () => {
    setViewerIndex(null);
  };

  const showPrev = () => {
    setViewerIndex((current) => {
      if (current == null || viewerUris.length < 2) {
        return current;
      }
      return (current - 1 + viewerUris.length) % viewerUris.length;
    });
  };

  const showNext = () => {
    setViewerIndex((current) => {
      if (current == null || viewerUris.length < 2) {
        return current;
      }
      return (current + 1) % viewerUris.length;
    });
  };

  const galleryStartIndex = selfieUri ? 1 : 0;

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <MaterialIcons
            name="arrow-back"
            size={iconSize}
            color={colors.textEnabled}
          />
        </Pressable>

        <Text style={styles.headerTitle} numberOfLines={1}>
          {headerTitle}
        </Text>

        {resolvedSessionId != null && task ? (
          <Pressable
            style={styles.headerButton}
            onPress={handleViewRoute}
            accessibilityRole="button"
            accessibilityLabel="View route"
          >
            <MaterialIcons
              name="map"
              size={iconSize}
              color={colors.button}
            />
          </Pressable>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {loading && !task ? (
        <TaskDetailSkeleton />
      ) : error || !task ? (
        <View style={styles.centerMessage}>
          <Text style={styles.errorText}>
            {error ?? 'Could not load task details.'}
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>{task.name}</Text>
            {typeof task.address === 'string' && task.address ? (
              <Text style={styles.subtitle}>{task.address}</Text>
            ) : null}
            <Text style={styles.stateText}>{task.state}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaItem}>
                Start {formatClock(task.started_at)}
              </Text>
              <Text style={styles.metaItem}>
                Arrived {formatClock(task.arrived_at)}
              </Text>
              <Text style={styles.metaItem}>
                Done {formatClock(task.completed_at)}
              </Text>
            </View>
          </View>

          {typeof task.description === 'string' && task.description ? (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.bodyText}>{task.description}</Text>
            </View>
          ) : null}

          {renderChecklist('To do', task.checklist.todo)}
          {renderChecklist('Before submit', task.checklist.before_submit)}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Visit</Text>
            {visitNote ? (
              <Text style={styles.bodyText}>{visitNote}</Text>
            ) : null}

            {selfieUri ? (
              <>
                <Text style={[styles.sectionTitle, { marginTop: visitNote ? 8 : 0 }]}>
                  Selfie
                </Text>
                <Pressable
                  onPress={() => openViewer(selfieUri)}
                  accessibilityRole="button"
                  accessibilityLabel="Open selfie full screen"
                >
                  <Image
                    source={{ uri: selfieUri }}
                    style={styles.selfieImage}
                    resizeMode="cover"
                  />
                </Pressable>
              </>
            ) : null}

            {galleryUris.length > 0 ? (
              <>
                <Text
                  style={[
                    styles.sectionTitle,
                    { marginTop: visitNote || selfieUri ? 8 : 0 },
                  ]}
                >
                  Photos
                </Text>
                <View style={styles.imageRow}>
                  {galleryUris.map((img, index) => (
                    <Pressable
                      key={img.id}
                      onPress={() => setViewerIndex(galleryStartIndex + index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Open photo ${index + 1} full screen`}
                    >
                      <Image
                        source={{ uri: img.uri }}
                        style={styles.imageThumb}
                        resizeMode="cover"
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}

            {!visitNote && !selfieUri && galleryUris.length === 0 ? (
              <Text style={styles.mutedText}>
                No visit note or photos for this task
              </Text>
            ) : null}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={viewerIndex != null}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerModal}>
          <Pressable
            style={styles.viewerClose}
            onPress={closeViewer}
            accessibilityRole="button"
            accessibilityLabel="Close image"
          >
            <MaterialIcons name="close" size={iconSize} color="#FFFFFF" />
          </Pressable>

          {viewerIndex != null && viewerUris.length > 1 ? (
            <>
              <Pressable
                style={[styles.viewerNav, styles.viewerNavLeft]}
                onPress={showPrev}
                accessibilityRole="button"
                accessibilityLabel="Previous image"
              >
                <MaterialIcons
                  name="chevron-left"
                  size={isTablet ? 32 : 28}
                  color="#FFFFFF"
                />
              </Pressable>
              <Pressable
                style={[styles.viewerNav, styles.viewerNavRight]}
                onPress={showNext}
                accessibilityRole="button"
                accessibilityLabel="Next image"
              >
                <MaterialIcons
                  name="chevron-right"
                  size={isTablet ? 32 : 28}
                  color="#FFFFFF"
                />
              </Pressable>
            </>
          ) : null}

          {viewerIndex != null && viewerUris[viewerIndex] ? (
            <Image
              source={{ uri: viewerUris[viewerIndex] }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          ) : null}

          {viewerIndex != null && viewerUris.length > 1 ? (
            <Text style={styles.viewerCounter}>
              {viewerIndex + 1} / {viewerUris.length}
            </Text>
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default GeoHistoryTaskDetailScreen;
