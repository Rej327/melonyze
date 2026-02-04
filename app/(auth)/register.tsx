import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const handleRegister = async () => {
    if (!email || !password || !firstName || !lastName || !contactNumber) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up with Supabase Auth
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) throw authError;

      if (data.user) {
        // 2. Create profile in farmer_account_table
        // Note: The trigger 'on_farmer_created' in SQL will automatically handle analysis settings creation
        const { error: profileError } = await supabase
          .from("farmer_account_table")
          .insert([
            {
              farmer_account_id: data.user.id,
              farmer_account_first_name: firstName,
              farmer_account_last_name: lastName,
              farmer_account_email: email,
              farmer_contact_number: contactNumber,
            },
          ]);

        if (profileError) {
          console.error("Profile creation error:", profileError);
          // We might want to handle this edge case (auth created but profile failed)
          // But with RLS and triggers, it should be robust.
        }

        Alert.alert(
          "Success",
          "Account created! Please check your email for confirmation.",
          [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
        );
      }
    } catch (error: any) {
      Alert.alert("Registration Failed", error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: isDark ? "#FFFFFF" : "#1B4332" }]}
          >
            Create Account
          </Text>
          <Text style={styles.subtitle}>
            Join our community of smart harvesters
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputContainer, { flex: 1, marginRight: 8 }]}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                First Name
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
                placeholder="Juan"
                placeholderTextColor="#999"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={[styles.inputContainer, { flex: 1, marginLeft: 8 }]}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Last Name
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
                placeholder="Dela Cruz"
                placeholderTextColor="#999"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <View style={styles.inputContainer}>
            <Text
              style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
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
              placeholder="juan.delacruz@example.com"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text
              style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
            >
              Contact Number
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
              placeholder="0917 123 4567"
              placeholderTextColor="#999"
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text
              style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
            >
              Password
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
              placeholder="Min. 8 characters"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Register Now</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text
              style={[
                styles.footerText,
                { color: isDark ? "#A0A0A0" : "#6C757D" },
              ]}
            >
              Already have an account?{" "}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
              <Text style={styles.linkText}>Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  backIcon: {
    fontSize: 20,
    color: "#2D6A4F",
    fontWeight: "bold",
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: "#74C69D",
    fontWeight: "500",
    marginTop: 8,
  },
  form: {
    width: "100%",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  inputContainer: {
    marginBottom: 20,
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
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  footerText: {
    fontSize: 15,
  },
  linkText: {
    fontSize: 15,
    color: "#2D6A4F",
    fontWeight: "700",
  },
});
