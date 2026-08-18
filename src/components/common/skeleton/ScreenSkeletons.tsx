import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../../theme/ThemeContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { SkeletonBox } from './SkeletonBox';

function useSkeletonLayout() {
  const { colors, isDark } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const pad = isTablet ? 32 : 20;
  const gap = isTablet ? 14 : 12;
  const cardRadius = 16;
  const dateStripBg = isDark ? '#0F1A2C' : '#F3F4F6';

  const card = {
    backgroundColor: colors.inputBox,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: cardRadius,
  } as const;

  const shell = {
    width: '100%' as const,
    maxWidth: contentMaxWidth,
    alignSelf: 'center' as const,
    paddingHorizontal: pad,
  };

  return { colors, isDark, isTablet, contentMaxWidth, pad, gap, card, shell, dateStripBg };
}

export function TaskRoutingSkeleton() {
  const { isTablet, gap, card, shell } = useSkeletonLayout();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[shell, { paddingTop: isTablet ? 12 : 8, gap, paddingBottom: 24 }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      <View style={[card, { paddingHorizontal: isTablet ? 16 : 14, paddingVertical: isTablet ? 14 : 12 }]}>
        <SkeletonBox height={11} width="28%" />
        <SkeletonBox height={16} width="46%" style={{ marginTop: 6 }} />
      </View>
      <View style={styles.chipRow}>
        {[72, 86, 70, 74, 92].map((width) => (
          <SkeletonBox key={width} height={isTablet ? 36 : 32} width={width} borderRadius={20} />
        ))}
      </View>
      {[0, 1, 2].map((key) => (
        <View
          key={key}
          style={[
            card,
            {
              paddingHorizontal: isTablet ? 18 : 16,
              paddingTop: isTablet ? 16 : 14,
              paddingBottom: isTablet ? 14 : 12,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <SkeletonBox height={isTablet ? 18 : 16} width="58%" />
            <SkeletonBox height={isTablet ? 22 : 20} width={64} borderRadius={8} />
          </View>
          <SkeletonBox height={13} width="82%" style={{ marginTop: isTablet ? 10 : 8 }} />
          <SkeletonBox height={13} width="48%" style={{ marginTop: isTablet ? 8 : 6 }} />
          <SkeletonBox
            height={isTablet ? 40 : 36}
            borderRadius={10}
            style={{ marginTop: isTablet ? 16 : 14 }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

export function ChecklistSkeleton() {
  const { isTablet, gap, card, shell } = useSkeletonLayout();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[shell, { paddingTop: isTablet ? 12 : 8, gap, paddingBottom: 24 }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      <SkeletonBox height={isTablet ? 20 : 18} width="36%" style={{ marginTop: isTablet ? 10 : 8 }} />
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <View
          key={key}
          style={[
            card,
            {
              borderRadius: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: isTablet ? 12 : 10,
              paddingHorizontal: isTablet ? 18 : 16,
              paddingVertical: isTablet ? 16 : 14,
            },
          ]}
        >
          <SkeletonBox height={isTablet ? 22 : 20} width={isTablet ? 22 : 20} borderRadius={4} />
          <SkeletonBox height={15} width={key % 2 === 0 ? '78%' : '64%'} />
        </View>
      ))}
    </ScrollView>
  );
}

export function DayListSkeleton() {
  const { isTablet, gap, card, dateStripBg } = useSkeletonLayout();
  const stripWidth = isTablet ? 72 : 64;

  return (
    <View style={{ gap, paddingBottom: isTablet ? 24 : 16 }}>
      {[0, 1, 2, 3, 4, 5].map((key) => (
        <View
          key={key}
          style={[
            card,
            {
              flexDirection: 'row',
              overflow: 'hidden',
              minHeight: isTablet ? 88 : 76,
              borderWidth: 1,
            },
          ]}
        >
          <View
            style={{
              width: stripWidth,
              backgroundColor: dateStripBg,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: isTablet ? 14 : 12,
              gap: 6,
            }}
          >
            <SkeletonBox height={11} width={36} />
            <SkeletonBox height={isTablet ? 22 : 18} width={28} />
          </View>
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: isTablet ? 16 : 14,
              gap: isTablet ? 8 : 6,
            }}
          >
            <SkeletonBox height={14} width="70%" />
            <SkeletonBox height={12} width="46%" />
          </View>
        </View>
      ))}
    </View>
  );
}

export function TimeOffSkeleton() {
  const { isTablet, gap, card } = useSkeletonLayout();

  return (
    <View style={{ gap, paddingTop: 4, paddingBottom: isTablet ? 24 : 16 }}>
      {[0, 1, 2].map((key) => (
        <View
          key={key}
          style={[
            card,
            {
              paddingHorizontal: isTablet ? 16 : 14,
              paddingTop: isTablet ? 14 : 12,
              paddingBottom: isTablet ? 12 : 10,
            },
          ]}
        >
          <View style={styles.rowStart}>
            <SkeletonBox
              height={isTablet ? 44 : 40}
              width={isTablet ? 44 : 40}
              borderRadius={12}
              style={{ marginRight: isTablet ? 12 : 10 }}
            />
            <View style={styles.flex}>
              <SkeletonBox height={15} width="62%" />
              <SkeletonBox height={12} width="48%" style={{ marginTop: 6 }} />
            </View>
            <SkeletonBox height={20} width={68} borderRadius={8} />
          </View>
          <SkeletonBox height={StyleSheet.hairlineWidth} style={{ marginTop: isTablet ? 12 : 10 }} />
          <SkeletonBox height={12} width="40%" style={{ marginTop: isTablet ? 10 : 8 }} />
        </View>
      ))}
    </View>
  );
}

export function SessionListSkeleton() {
  const { isTablet, gap, card } = useSkeletonLayout();

  return (
    <View style={{ gap, paddingBottom: isTablet ? 24 : 16 }}>
      {[0, 1, 2, 3].map((key) => (
        <View
          key={key}
          style={[
            card,
            {
              paddingHorizontal: isTablet ? 18 : 16,
              paddingVertical: isTablet ? 16 : 14,
              gap: isTablet ? 12 : 10,
            },
          ]}
        >
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <SkeletonBox height={15} width="58%" />
              <SkeletonBox height={12} width="32%" style={{ marginTop: 6 }} />
            </View>
            <SkeletonBox height={isTablet ? 32 : 28} width={72} borderRadius={10} />
          </View>
          <View style={styles.rowBetween}>
            <SkeletonBox height={14} width="28%" />
            <SkeletonBox height={14} width="28%" />
          </View>
          <SkeletonBox height={12} width="54%" />
        </View>
      ))}
    </View>
  );
}

export function SessionDetailSkeleton() {
  const { isTablet, gap, card } = useSkeletonLayout();

  return (
    <View style={{ paddingBottom: isTablet ? 24 : 16 }}>
      <View
        style={[
          card,
          {
            paddingHorizontal: isTablet ? 18 : 16,
            paddingVertical: isTablet ? 16 : 14,
            marginBottom: isTablet ? 16 : 12,
            gap: isTablet ? 10 : 8,
          },
        ]}
      >
        <SkeletonBox height={12} width="24%" />
        <View style={styles.chipRow}>
          <SkeletonBox height={12} width={64} />
          <SkeletonBox height={12} width={52} />
          <SkeletonBox height={12} width={70} />
        </View>
      </View>
      <View style={{ gap }}>
        {[0, 1, 2].map((key) => (
          <View
            key={key}
            style={[
              card,
              {
                paddingHorizontal: isTablet ? 18 : 16,
                paddingVertical: isTablet ? 16 : 14,
                gap: 8,
              },
            ]}
          >
            <SkeletonBox height={15} width="64%" />
            <SkeletonBox height={12} width="78%" />
            <SkeletonBox height={12} width="36%" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function TaskDetailSkeleton() {
  const { isTablet, gap, card, shell } = useSkeletonLayout();

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[shell, { gap, paddingBottom: isTablet ? 32 : 24 }]}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
    >
      <View
        style={[
          card,
          {
            paddingHorizontal: isTablet ? 18 : 16,
            paddingVertical: isTablet ? 16 : 14,
            gap: isTablet ? 10 : 8,
          },
        ]}
      >
        <SkeletonBox height={isTablet ? 20 : 18} width="72%" />
        <SkeletonBox height={13} width="88%" />
        <SkeletonBox height={12} width="22%" />
        <View style={styles.chipRow}>
          <SkeletonBox height={12} width={88} />
          <SkeletonBox height={12} width={96} />
          <SkeletonBox height={12} width={80} />
        </View>
      </View>
      <View
        style={[
          card,
          {
            paddingHorizontal: isTablet ? 18 : 16,
            paddingVertical: isTablet ? 16 : 14,
            gap: isTablet ? 10 : 8,
          },
        ]}
      >
        <SkeletonBox height={15} width="28%" />
        {[0, 1, 2].map((key) => (
          <View key={key} style={styles.rowStart}>
            <SkeletonBox height={16} width={16} borderRadius={4} style={{ marginRight: 10 }} />
            <SkeletonBox height={13} width={key === 1 ? '70%' : '82%'} />
          </View>
        ))}
      </View>
      <View
        style={[
          card,
          {
            paddingHorizontal: isTablet ? 18 : 16,
            paddingVertical: isTablet ? 16 : 14,
            gap: isTablet ? 10 : 8,
          },
        ]}
      >
        <SkeletonBox height={15} width="22%" />
        <SkeletonBox height={isTablet ? 180 : 140} borderRadius={12} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowStart: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
