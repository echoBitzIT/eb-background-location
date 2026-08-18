import { Platform, StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1422',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0B1422',
  },
  scrollView: {
    flex: 1,
    alignSelf: 'stretch',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  gateContent: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 14,
    color: '#9AA4B2',
    marginBottom: 20,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  description: {
    fontSize: 16,
    color: '#9AA4B2',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  errorContainer: {
    backgroundColor: '#162033',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#C62828',
  },
  errorText: {
    color: '#D6DEE8',
    fontSize: 14,
    marginBottom: 10,
  },
  dismissButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#C62828',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#162033',
    borderRadius: 10,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 10,
    color: '#9AA4B2',
  },
  statusText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  tracking: {
    color: '#4CAF50',
  },
  stopped: {
    color: '#C62828',
  },
  sessionContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#162033',
    borderRadius: 10,
  },
  label: {
    fontSize: 14,
    color: '#9AA4B2',
    marginBottom: 5,
  },
  sessionId: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#D6DEE8',
  },
  infoContainer: {
    marginBottom: 15,
    padding: 12,
    backgroundColor: '#162033',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1B6EF3',
  },
  infoText: {
    fontSize: 13,
    color: '#9AA4B2',
    lineHeight: 18,
  },
  lastLocationContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#162033',
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D4F',
  },
  locationDetail: {
    fontSize: 14,
    color: '#D6DEE8',
    marginTop: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  buttonContainer: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1B6EF3',
  },
  dangerButton: {
    backgroundColor: '#C62828',
  },
  mutedButton: {
    backgroundColor: '#243044',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  locationsContainer: {
    backgroundColor: '#162033',
    borderRadius: 10,
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#FFFFFF',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9AA4B2',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  locationItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#243044',
  },
  locationText: {
    fontSize: 14,
    color: '#D6DEE8',
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: '#9AA4B2',
  },
  additionalPropsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#243044',
  },
  additionalPropText: {
    fontSize: 11,
    color: '#9AA4B2',
    marginTop: 3,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  configContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#162033',
    borderRadius: 10,
  },
  configHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  configTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 12,
  },
  toggleButton: {
    backgroundColor: '#243044',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 13,
  },
  configContent: {
    marginTop: 16,
  },
  configSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9AA4B2',
    marginBottom: 10,
  },
  presetContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  presetButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#243044',
    borderWidth: 2,
    borderColor: '#1B6EF3',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetButtonSelected: {
    backgroundColor: '#1B6EF3',
    borderColor: '#1B6EF3',
  },
  presetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B6EF3',
  },
  presetButtonTextSelected: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  configDetails: {
    backgroundColor: '#243044',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  configDetailTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  configDetailText: {
    fontSize: 12,
    color: '#9AA4B2',
    marginBottom: 5,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  configInfo: {
    backgroundColor: '#162033',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#1B6EF3',
  },
  configInfoText: {
    fontSize: 12,
    color: '#9AA4B2',
    lineHeight: 18,
  },
});

export default styles;
