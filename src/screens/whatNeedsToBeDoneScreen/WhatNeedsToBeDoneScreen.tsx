import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StatusBar, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getAuthErrorMessage } from '../../constants/ApiEndpoints';
import { ScreenNames } from '../../constants/ScreenNames';
import { RootStackParamList } from '../../navigation/AppNavigator';
import {
  fetchFieldTaskDetail,
  isRequestCanceled,
  type FieldTaskCancelReason,
  type FieldTaskChecklistLine,
} from '../../services/apiClient';
import {
  loadTaskProgress,
  saveTaskProgress,
} from '../../services/taskProgressStorage';
import { useAppSelector } from '../../store/hooks';
import { useAppTheme } from '../../theme/ThemeContext';
import { useBottomContentPadding } from '../../hooks/useBottomContentPadding';
import { useResponsive } from '../../hooks/useResponsive';
import { ChecklistSkeleton } from '../../components/common/skeleton/ScreenSkeletons';
import { createStyles } from './WhatNeedsToBeDoneScreenStyle';

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ScreenNames.WHAT_NEEDS_TO_BE_DONE
>;

const WhatNeedsToBeDoneScreen = ({ navigation, route }: Props) => {
  const { taskId } = route.params;
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const bottomPadding = useBottomContentPadding(isTablet ? 24 : 16);
  const accessToken = useAppSelector((state) => state.auth.accessToken);

  const [todo, setTodo] = useState<FieldTaskChecklistLine[]>([]);
  const [beforeSubmit, setBeforeSubmit] = useState<FieldTaskChecklistLine[]>(
    [],
  );
  const [doneIds, setDoneIds] = useState<number[]>([]);
  const [cancelReasons, setCancelReasons] = useState<FieldTaskCancelReason[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(
    async (isCancelled: () => boolean) => {
      if (!accessToken) {
        setError('Session expired. Please log in again.');
        setTodo([]);
        setBeforeSubmit([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [detail, progress] = await Promise.all([
          fetchFieldTaskDetail(accessToken, taskId),
          loadTaskProgress(taskId),
        ]);
        if (isCancelled()) {
          return;
        }
        setTodo(detail.checklist.todo);
        setBeforeSubmit(detail.checklist.before_submit);
        setCancelReasons(detail.cancel_reasons ?? []);

        const serverDone = [
          ...detail.checklist.todo,
          ...detail.checklist.before_submit,
        ]
          .filter((line) => line.is_done)
          .map((line) => line.id);
        const localDone = progress.checklist_done ?? [];
        const merged = Array.from(new Set([...serverDone, ...localDone]));
        setDoneIds(merged);
        setError(null);
      } catch (e) {
        if (isCancelled() || isRequestCanceled(e)) {
          return;
        }
        const message =
          e instanceof Error ? e.message : 'task_detail_failed';
        setError(getAuthErrorMessage(message));
        setTodo([]);
        setBeforeSubmit([]);
      } finally {
        if (!isCancelled()) {
          setLoading(false);
        }
      }
    },
    [accessToken, taskId],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void loadDetail(() => cancelled);
      return () => {
        cancelled = true;
      };
    }, [loadDetail]),
  );

  const toggleDone = useCallback(
    (id: number) => {
      setDoneIds((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        void saveTaskProgress(taskId, { checklist_done: next });
        return next;
      });
    },
    [taskId],
  );

  const allIds = useMemo(
    () => [...todo, ...beforeSubmit].map((line) => line.id),
    [beforeSubmit, todo],
  );

  const allSelected =
    allIds.length > 0 && allIds.every((id) => doneIds.includes(id));

  const handleSelectAllPress = useCallback(() => {
    if (allIds.length === 0) {
      return;
    }
    const next = allSelected ? [] : allIds;
    setDoneIds(next);
    void saveTaskProgress(taskId, { checklist_done: next });
  }, [allIds, allSelected, taskId]);

  const renderSection = (
    title: string,
    items: FieldTaskChecklistLine[],
  ) => (
    <>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No items</Text>
      ) : (
        items.map((item) => {
          const checked = doneIds.includes(item.id);
          return (
            <Pressable
              key={item.id}
              style={[styles.itemCard, checked && styles.itemCardDone]}
              onPress={() => toggleDone(item.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              accessibilityLabel={item.name}
            >
              <MaterialIcons
                name={checked ? 'check-box' : 'check-box-outline-blank'}
                size={isTablet ? 24 : 22}
                color={checked ? colors.button : colors.textDisabled}
              />
              <View style={styles.itemTextWrap}>
                <Text style={styles.itemText}>{item.name}</Text>
                {item.is_required ? (
                  <Text style={styles.requiredTag}>Required</Text>
                ) : null}
              </View>
            </Pressable>
          );
        })
      )}
    </>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
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
          What Needs to Be Done
        </Text>
      </View>

      {loading && todo.length === 0 && beforeSubmit.length === 0 ? (
        <ChecklistSkeleton />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPadding },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {allIds.length > 0 ? (
            <View style={styles.selectAllRow}>
              <Pressable
                onPress={handleSelectAllPress}
                accessibilityRole="button"
                accessibilityLabel={allSelected ? 'Clear All' : 'Select All'}
              >
                <Text style={styles.selectAllText}>
                  {allSelected ? 'Clear All' : 'Select All'}
                </Text>
              </Pressable>
            </View>
          ) : null}
          {renderSection('Tasks', todo)}
          {renderSection('Before You Submit', beforeSubmit)}
          {cancelReasons.length > 0 ? (
            <Text style={styles.hintText}>
              Cancel reasons available if you need to abandon this task from the
              map.
            </Text>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

export default WhatNeedsToBeDoneScreen;
