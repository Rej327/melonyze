import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SoundAnalysisScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [step, setStep] = useState(1); // 1: Calibration, 2: Recording, 3: Result
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Simulated frequency bars
  const [bars, setBars] = useState(new Array(15).fill(0.2));

  const startRecording = () => {
    setIsRecording(true);
    setProgress(0);
  };

  const analyzeThump = useCallback(async () => {
    setLoading(true);
    try {
      // For this demo, we'll pick a random frequency between 100 and 200
      // In a real app, this would come from an audio buffer FFT
      const frequency = 120 + Math.random() * 80;
      const amplitude = 0.5 + Math.random() * 0.4;

      // In this simulated flow, we don't have an item_id yet,
      // so we might just show the "potential" result or require selecting an item first.
      // For simplicity in the demo, let's assume we are testing a "hypothetical" melon

      const isReady = frequency >= 110 && frequency <= 190 && amplitude >= 0.6;
      setResult({
        frequency: frequency.toFixed(1),
        amplitude: amplitude.toFixed(2),
        status: isReady ? "READY" : "NOT_READY",
      });
      setStep(3);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let interval: any;
    if (isRecording) {
      interval = setInterval(() => {
        setBars((curr) => curr.map(() => 0.1 + Math.random() * 0.9));
        setProgress((p) => {
          if (p >= 1) {
            setIsRecording(false);
            analyzeThump();
            return 1;
          }
          return p + 0.05;
        });
      }, 100);
    } else {
      setBars(new Array(15).fill(0.1));
    }
    return () => clearInterval(interval);
  }, [isRecording, analyzeThump]);

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? "#FFFFFF" : "#1B4332" }]}>
          Ripeness Analyzer
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressDots}>
          <View style={[styles.dot, step >= 1 && styles.activeDot]} />
          <View style={[styles.dot, step >= 2 && styles.activeDot]} />
          <View style={[styles.dot, step >= 3 && styles.activeDot]} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <View style={styles.resultContainer}>
            <ActivityIndicator size="large" color="#2D6A4F" />
            <Text style={styles.instruction}>Analyzing thump pattern...</Text>
          </View>
        ) : (
          <>
            {step === 1 && (
              <>
                <Text
                  style={[
                    styles.mainTitle,
                    { color: isDark ? "#FFFFFF" : "#1B4332" },
                  ]}
                >
                  Microphone Setup
                </Text>
                <Text style={styles.instruction}>
                  Place your phone 2-3 inches from the watermelon in a quiet
                  environment.
                </Text>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
                  ]}
                >
                  <View style={styles.cardHeader}>
                    <Text
                      style={[
                        styles.cardTitle,
                        { color: isDark ? "#A0A0A0" : "#495057" },
                      ]}
                    >
                      Ambient Noise
                    </Text>
                    <Text
                      style={[
                        styles.cardValue,
                        { color: isDark ? "#FFFFFF" : "#1B4332" },
                      ]}
                    >
                      32 dB
                    </Text>
                  </View>
                  <View style={styles.meterBg}>
                    <View style={[styles.meterFill, { width: "35%" }]} />
                  </View>
                  <Text style={styles.cardStatus}>
                    ✅ Environment is quiet enough for testing
                  </Text>
                </View>

                <View
                  style={[
                    styles.card,
                    { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
                  ]}
                >
                  <Text
                    style={[
                      styles.cardTitle,
                      {
                        color: isDark ? "#A0A0A0" : "#495057",
                        marginBottom: 16,
                      },
                    ]}
                  >
                    Frequency Response
                  </Text>
                  <View style={styles.chartContainer}>
                    {bars.map((h, i) => (
                      <View
                        key={i}
                        style={[
                          styles.chartBar,
                          { height: h * 60, opacity: 0.3 + h * 0.7 },
                        ]}
                      />
                    ))}
                  </View>

                  <View style={styles.chartLabels}>
                    <Text style={styles.chartLabelText}>20Hz</Text>
                    <Text style={styles.chartLabelText}>Target Signature</Text>
                    <Text style={styles.chartLabelText}>2kHz</Text>
                  </View>
                </View>

                <View style={styles.alertCard}>
                  <Text style={styles.alertIcon}>ℹ️</Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>Test Thump Required</Text>
                    <Text style={styles.alertText}>
                      Gently thump the center of the melon while the recorder is
                      active to calibrate the frequency filter.
                    </Text>
                  </View>
                </View>
              </>
            )}

            {step === 3 && (
              <View style={styles.resultContainer}>
                <View
                  style={[
                    styles.resultCircle,
                    {
                      borderColor:
                        result?.status === "READY" ? "#2D6A4F" : "#D90429",
                    },
                  ]}
                >
                  <Text style={styles.resultEmoji}>
                    {result?.status === "READY" ? "✅" : "⏳"}
                  </Text>
                  <Text
                    style={[
                      styles.resultStatus,
                      {
                        color:
                          result?.status === "READY" ? "#2D6A4F" : "#D90429",
                      },
                    ]}
                  >
                    {result?.status === "READY"
                      ? "PERFECTLY RIPE"
                      : "NOT QUITE READY"}
                  </Text>
                </View>

                <View style={styles.statsList}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Frequency</Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: isDark ? "#FFFFFF" : "#1B4332" },
                      ]}
                    >
                      {result?.frequency} Hz
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Amplitude</Text>
                    <Text
                      style={[
                        styles.statValue,
                        { color: isDark ? "#FFFFFF" : "#1B4332" },
                      ]}
                    >
                      {result?.amplitude}
                    </Text>
                  </View>
                </View>

                <Text style={styles.resultAdvice}>
                  {result?.status === "READY"
                    ? "Acoustic resonance suggests high sugar content and hollow internal structure typical of mature watermelons."
                    : "The sound is too dull, suggesting the watermelon might still be growing or has low moisture levels."}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {step === 1 && (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
            disabled={isRecording}
          >
            <Text style={styles.recordButtonText}>
              {isRecording
                ? `Recording... ${(progress * 100).toFixed(0)}%`
                : "Record Sample Thump"}
            </Text>
          </TouchableOpacity>
        )}

        {step === 3 && (
          <TouchableOpacity
            style={styles.recordButton}
            onPress={() => router.replace("/management/add-edit" as any)}
          >
            <Text style={styles.recordButtonText}>
              Save Result to Inventory
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.skipButton}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonText: {
    fontSize: 20,
    color: "#2D6A4F",
    fontWeight: "bold",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
    alignItems: "center",
  },
  progressDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E0E0E0",
  },
  activeDot: {
    width: 24,
    backgroundColor: "#2D6A4F",
  },
  content: {
    padding: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 10,
  },
  instruction: {
    fontSize: 15,
    color: "#6C757D",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  card: {
    marginTop: 32,
    padding: 20,
    borderRadius: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  meterBg: {
    height: 12,
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  meterFill: {
    height: "100%",
    backgroundColor: "#2D6A4F",
  },
  cardStatus: {
    fontSize: 12,
    color: "#2D6A4F",
    fontWeight: "600",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 60,
  },
  chartBar: {
    width: "5%",
    backgroundColor: "#2D6A4F",
    borderRadius: 4,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  chartLabelText: {
    fontSize: 10,
    color: "#A0A0A0",
    fontWeight: "600",
  },
  alertCard: {
    marginTop: 32,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#E9F5EE",
    flexDirection: "row",
    gap: 12,
  },
  alertIcon: {
    fontSize: 20,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 4,
  },
  alertText: {
    fontSize: 13,
    color: "#2D6A4F",
    lineHeight: 18,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
  },
  recordButton: {
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  skipButton: {
    marginTop: 16,
    alignItems: "center",
  },
  skipText: {
    color: "#6C757D",
    fontWeight: "600",
  },
  resultContainer: {
    alignItems: "center",
    paddingTop: 20,
  },
  resultCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  resultEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  resultStatus: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  statsList: {
    width: "100%",
    gap: 16,
    marginBottom: 32,
  },
  statItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  statLabel: {
    fontSize: 14,
    color: "#6C757D",
    fontWeight: "600",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
  },
  resultAdvice: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 22,
    fontStyle: "italic",
  },
});
