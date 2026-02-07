import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function WelcomeScreen() {
  const router = useRouter();

  const steps = [
    {
      icon: "touch-app",
      title: "Tap",
      description: "Thump the watermelon gently",
    },
    {
      icon: "mic",
      title: "Record",
      description: "App captures the sound profile",
    },
    {
      icon: "auto-graph",
      title: "Analyze",
      description: "Get instant ripeness results",
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </View>
          <Text style={styles.title}>Melonyze</Text>
          <Text style={styles.subtitle}>Smart Watermelon Harvest</Text>
        </View>

        <View style={styles.stepsContainer}>
          <Text style={styles.stepsHeader}>How it works</Text>
          {steps.map((step, index) => (
            <View key={index} style={styles.stepItem}>
              <View style={styles.stepIconCircle}>
                <MaterialIcons
                  name={step.icon as any}
                  size={28}
                  color="#2D6A4F"
                />
              </View>
              <View style={styles.stepTextContainer}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.footer}>
          <Text style={styles.welcomeText}>
            Assess fruit ripeness through acoustic response analysis
          </Text>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push("/(auth)/register")}
          >
            <Text style={styles.registerButtonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#2D6A4F", // Dark Green
  },
  content: {
    flex: 1,
    backgroundColor: "#F8FBF9",
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    padding: 24,
    justifyContent: "space-between",
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
  logo: {
    width: 60,
    height: 60,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1B4332",
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: "#74C69D",
    fontWeight: "600",
    marginTop: 2,
  },
  stepsContainer: {
    paddingVertical: 20,
  },
  stepsHeader: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 20,
    textAlign: "center",
  },
  stepItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  stepIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  stepTextContainer: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: 14,
    color: "#6C757D",
    lineHeight: 20,
  },
  footer: {
    width: "100%",
    paddingBottom: 10,
  },
  welcomeText: {
    fontSize: 15,
    color: "#495057",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  loginButton: {
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  registerButton: {
    height: 56,
    backgroundColor: "transparent",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2D6A4F",
  },
  registerButtonText: {
    color: "#2D6A4F",
    fontSize: 18,
    fontWeight: "700",
  },
});
