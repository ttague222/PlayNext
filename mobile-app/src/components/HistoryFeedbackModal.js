/**
 * PlayNxt History Feedback Modal
 *
 * Modal for collecting feedback on games from history.
 * Allows users to rate how well a recommendation worked.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const SIGNAL_TYPE_INFO = {
  accepted: {
    label: 'Accepted',
    icon: 'checkmark-circle',
    color: '#4ade80',
  },
  played_loved: {
    label: 'Loved it',
    icon: 'heart',
    color: '#f472b6',
  },
  played_neutral: {
    label: 'It was okay',
    icon: 'thumbs-up',
    color: '#fbbf24',
  },
  played_didnt_stick: {
    label: "Didn't stick",
    icon: 'thumbs-down',
    color: '#94a3b8',
  },
  already_played: {
    label: 'Already played',
    icon: 'game-controller',
    color: '#60a5fa',
  },
};

const HistoryFeedbackModal = ({
  visible,
  item,
  onClose,
  onFeedback,
  onRemove,
}) => {
  if (!item) return null;

  const currentStatus = SIGNAL_TYPE_INFO[item.signalType] || SIGNAL_TYPE_INFO.accepted;
  const isAccepted = item.signalType === 'accepted';

  const handleFeedback = (feedbackType) => {
    onFeedback(item.id, feedbackType);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
          <LinearGradient
            colors={['#1e1e3f', '#16213e']}
            style={styles.modal}
          >
            {/* Handle bar */}
            <View style={styles.handleBar} />

            {/* Game title */}
            <Text style={styles.gameTitle}>{item.title}</Text>

            {/* Current status */}
            <View style={styles.statusRow}>
              <Ionicons
                name={currentStatus.icon}
                size={16}
                color={currentStatus.color}
              />
              <Text style={[styles.statusText, { color: currentStatus.color }]}>
                {currentStatus.label}
              </Text>
              <Text style={styles.dateText}>
                {new Date(item.acceptedAt).toLocaleDateString()}
              </Text>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Feedback prompt */}
            <Text style={styles.promptText}>
              {isAccepted ? 'How did it go?' : 'Update your rating:'}
            </Text>

            {/* Feedback options */}
            <View style={styles.feedbackOptions}>
              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  item.signalType === 'played_loved' && styles.feedbackButtonActive,
                ]}
                onPress={() => handleFeedback('played_loved')}
              >
                <Text style={styles.feedbackEmoji}>😍</Text>
                <Text style={styles.feedbackLabel}>Loved it!</Text>
                <Text style={styles.feedbackDescription}>Great recommendation</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  item.signalType === 'played_neutral' && styles.feedbackButtonActive,
                ]}
                onPress={() => handleFeedback('played_neutral')}
              >
                <Text style={styles.feedbackEmoji}>😊</Text>
                <Text style={styles.feedbackLabel}>It was okay</Text>
                <Text style={styles.feedbackDescription}>Decent experience</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.feedbackButton,
                  item.signalType === 'played_didnt_stick' && styles.feedbackButtonActive,
                ]}
                onPress={() => handleFeedback('played_didnt_stick')}
              >
                <Text style={styles.feedbackEmoji}>😕</Text>
                <Text style={styles.feedbackLabel}>Didn't stick</Text>
                <Text style={styles.feedbackDescription}>Not for me</Text>
              </TouchableOpacity>
            </View>

            {/* Worked toggle for accepted items */}
            {isAccepted && (
              <TouchableOpacity
                style={[
                  styles.workedButton,
                  item.worked && styles.workedButtonActive,
                ]}
                onPress={() => handleFeedback(item.worked ? 'unmark_worked' : 'mark_worked')}
              >
                <Ionicons
                  name={item.worked ? 'checkmark-circle' : 'checkmark-circle-outline'}
                  size={24}
                  color={item.worked ? '#4ade80' : '#808080'}
                />
                <Text style={[
                  styles.workedButtonText,
                  item.worked && styles.workedButtonTextActive,
                ]}>
                  {item.worked ? 'Marked as worked for me' : 'Mark as worked for me'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => {
                onRemove(item.id);
                onClose();
              }}
            >
              <Ionicons name="trash-outline" size={18} color="#ef4444" />
              <Text style={styles.removeButtonText}>Remove from history</Text>
            </TouchableOpacity>

            {/* Cancel button */}
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '80%',
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  gameTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateText: {
    fontSize: 14,
    color: '#808080',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 16,
  },
  promptText: {
    fontSize: 16,
    color: '#c0c0c0',
    textAlign: 'center',
    marginBottom: 16,
  },
  feedbackOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  feedbackButton: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  feedbackButtonActive: {
    borderColor: '#f857a6',
    backgroundColor: 'rgba(248, 87, 166, 0.1)',
  },
  feedbackEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  feedbackLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 4,
  },
  feedbackDescription: {
    fontSize: 11,
    color: '#808080',
    textAlign: 'center',
  },
  workedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  workedButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  workedButtonText: {
    fontSize: 15,
    color: '#808080',
    fontWeight: '500',
  },
  workedButtonTextActive: {
    color: '#4ade80',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 8,
  },
  removeButtonText: {
    fontSize: 15,
    color: '#ef4444',
    fontWeight: '500',
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    color: '#808080',
    fontWeight: '500',
  },
});

export default HistoryFeedbackModal;
