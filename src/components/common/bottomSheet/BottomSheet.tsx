import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../theme/ThemeContext';
import { useResponsive } from '../../../hooks/useResponsive';
import { createStyles } from './BottomSheetStyle';

export type BottomSheetOption = {
  key: string;
  label: string;
  icon?: string;
  iconColor?: string;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  options?: BottomSheetOption[];
  children?: React.ReactNode;
  onClose: () => void;
};

const BottomSheet = ({
  visible,
  title,
  subtitle,
  options,
  children,
  onClose,
}: Props) => {
  const { colors } = useAppTheme();
  const { isTablet, contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, isTablet, contentMaxWidth);
  const iconSize = isTablet ? 24 : 22;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, isTablet ? 28 : 24) },
          ]}
        >
          <Text
            style={[styles.title, !subtitle && styles.titleOnlySpacing]}
          >
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          {options?.map((option, index) => {
            const isLast = index === options.length - 1;
            return (
              <Pressable
                key={option.key}
                style={[styles.optionRow, isLast && styles.optionRowLast]}
                onPress={option.onPress}
                accessibilityRole="button"
                accessibilityLabel={option.label}
              >
                <View style={styles.optionLabelWrap}>
                  {option.icon ? (
                    <MaterialIcons
                      name={option.icon}
                      size={iconSize}
                      color={option.iconColor ?? colors.textEnabled}
                    />
                  ) : null}
                  <Text style={styles.optionText}>{option.label}</Text>
                </View>
                <MaterialIcons
                  name="chevron-right"
                  size={iconSize}
                  color={colors.textDisabled}
                />
              </Pressable>
            );
          })}

          {children ? <View style={styles.childrenWrap}>{children}</View> : null}
        </View>
      </View>
    </Modal>
  );
};

export default BottomSheet;
