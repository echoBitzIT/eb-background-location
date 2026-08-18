import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ToastConfig } from 'react-native-toast-message';

type ToastProps = {
  text1?: string;
};

const WaSuccessToast = ({ text1 }: ToastProps) => {
  if (!text1) {
    return null;
  }

  return (
    <View style={styles.toast}>
      <Text style={styles.message}>{text1}</Text>
    </View>
  );
};

export const toastConfig: ToastConfig = {
  success: props => <WaSuccessToast {...props} />,
  info: props => <WaSuccessToast {...props} />,
  error: props => <WaSuccessToast {...props} />,
};

const styles = StyleSheet.create({
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: '90%',
    backgroundColor: 'rgba(55, 55, 55, 0.92)',
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  message: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
  },
});
