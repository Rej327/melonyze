import { MaterialIcons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface ModernModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  type?: "info" | "error" | "success" | "warning";
  confirmText?: string;
  onConfirm?: () => void;
}

export function ModernModal({
  visible,
  onClose,
  title,
  message,
  children,
  type = "info",
  confirmText = "OK",
  onConfirm,
}: ModernModalProps) {
  const getIcon = () => {
    switch (type) {
      case "error":
        return "error-outline";
      case "success":
        return "check-circle-outline";
      case "warning":
        return "warning-amber";
      default:
        return "info-outline";
    }
  };

  const getIconColor = () => {
    switch (type) {
      case "error":
        return "#D90429";
      case "success":
        return "#2D6A4F";
      case "warning":
        return "#F5A623";
      default:
        return "#2D6A4F";
    }
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: getIconColor() + "20" },
            ]}
          >
            <MaterialIcons name={getIcon()} size={40} color={getIconColor()} />
          </View>

          <Text style={styles.title}>{title}</Text>
          {children ? children : <Text style={styles.message}>{message}</Text>}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: getIconColor() }]}
              onPress={onConfirm || onClose}
            >
              <Text style={styles.buttonText}>{confirmText}</Text>
            </TouchableOpacity>

            {onConfirm && (
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  footer: {
    width: "100%",
    gap: 12,
  },
  button: {
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  cancelButton: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#6C757D",
    fontSize: 16,
    fontWeight: "600",
  },
});
