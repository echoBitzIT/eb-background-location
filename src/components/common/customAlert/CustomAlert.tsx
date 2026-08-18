import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useAppTheme } from '../../../theme/ThemeContext';
import { createStyles } from './CustomAlertStyle';

type CustomAlertProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  destructive?: boolean;
  cancelable?: boolean;
};

const CustomAlert = ({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText,
  onConfirm,
  onCancel,
  destructive = false,
  cancelable,
}: CustomAlertProps) => {
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const isConfirmDialog = Boolean(cancelText);
  const canDismiss =
    typeof cancelable === 'boolean' ? cancelable : isConfirmDialog;

  const handleRequestClose = () => {
    if (!canDismiss) {
      return;
    }
    if (isConfirmDialog) {
      onCancel?.();
      return;
    }
    onConfirm();
  };

  const handleOverlayPress = () => {
    if (!canDismiss) {
      return;
    }
    if (isConfirmDialog) {
      onCancel?.();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleRequestClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleOverlayPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss alert"
        />
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {isConfirmDialog ? (
              <View style={styles.buttonSlot}>
                <Pressable
                  style={styles.cancelButton}
                  onPress={onCancel}
                  accessibilityRole="button"
                  accessibilityLabel={cancelText}
                >
                  <Text style={styles.cancelText}>{cancelText}</Text>
                </Pressable>
              </View>
            ) : null}

            <View
              style={isConfirmDialog ? styles.buttonSlot : styles.singleConfirm}
            >
              {destructive ? (
                <Pressable
                  style={styles.destructiveButton}
                  onPress={onConfirm}
                  accessibilityRole="button"
                  accessibilityLabel={confirmText}
                >
                  <Text style={styles.destructiveText}>{confirmText}</Text>
                </Pressable>
              ) : (
                <Pressable
                  style={styles.confirmButton}
                  onPress={onConfirm}
                  accessibilityRole="button"
                  accessibilityLabel={confirmText}
                >
                  <LinearGradient
                    colors={[...colors.buttonGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={styles.confirmGradient}
                  >
                    <Text style={styles.confirmText}>{confirmText}</Text>
                  </LinearGradient>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default CustomAlert;
