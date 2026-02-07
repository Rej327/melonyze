import { ModernModal } from "@/components/ui/modern-modal";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as any,
  });
  const router = useRouter();
  const isDark = false;

  const handleResetPassword = async () => {
    if (!email) {
      setAlertConfig({
        title: "Error",
        message: "Please enter your email address",
        type: "error",
      });
      setAlertVisible(true);
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: "melonyze://reset-password",
    });

    if (error) {
      setAlertConfig({
        title: "Error",
        message: error.message,
        type: "error",
      });
      setAlertVisible(true);
    } else {
      setAlertConfig({
        title: "Check your email",
        message: "We've sent a password reset link to your email address.",
        type: "success",
      });
      setAlertVisible(true);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[
          styles.container,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ModernModal
          visible={alertVisible}
          onClose={() => {
            setAlertVisible(false);
            if (alertConfig.type === "success") {
              router.back();
            }
          }}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
        />

        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#2D6A4F" />
          </TouchableOpacity>
        </View>

        <View style={styles.inner}>
          <View style={styles.content}>
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              No worries! Enter your email below and we&apos;ll send you a link
              to reset your password.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.label,
                    { color: isDark ? "#A0A0A0" : "#495057" },
                  ]}
                >
                  Email Address
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                      color: isDark ? "#FFFFFF" : "#000000",
                      borderColor: isDark ? "#333333" : "#E0E0E0",
                    },
                  ]}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <TouchableOpacity
                style={styles.button}
                onPress={handleResetPassword}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  inner: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
  },
  content: {
    width: "100%",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: "#6C757D",
    lineHeight: 24,
    marginBottom: 32,
  },
  form: {
    width: "100%",
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  button: {
    height: 60,
    backgroundColor: "#2D6A4F",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
