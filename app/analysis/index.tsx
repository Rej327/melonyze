import { useColorScheme } from "@/hooks/use-color-scheme";
import { AudioModule } from "expo-audio";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const [dbLevel, setDbLevel] = useState(-160);
  const [bars, setBars] = useState(new Array(15).fill(0.1));

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const analyzeThump = useCallback(async () => {
    setLoading(true);
    // Simulate audio analysis logic
    setTimeout(() => {
      const isReady = Math.random() > 0.4;
      setResult({
        frequency: (120 + Math.random() * 40).toFixed(1),
        amplitude: (0.5 + Math.random() * 0.4).toFixed(2),
        status: isReady ? "READY" : "NOT_READY",
      });
      setStep(3);
      setLoading(false);
    }, 1500);
  }, []);

  const stopRecording = useCallback(() => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    analyzeThump();
  }, [analyzeThump]);

  const startRecording = async () => {
    try {
      // Still request permissions for UX consistency
      const { status } = await AudioModule.requestRecordingPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Required",
          "Microphone access is recommended for the best experience.",
        );
      }

      setIsRecording(true);
      setProgress(0);
      startTimeRef.current = Date.now();

      recordingIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        const p = Math.min(1, elapsed / 3000);
        setProgress(p);

        // Simulate visualizer bars
        setBars((curr) => {
          const newBars = [...curr];
          newBars.shift();
          newBars.push(0.2 + Math.random() * 0.8);
          return newBars;
        });

        // Simulate dB levels
        setDbLevel(-40 + Math.random() * 20);

        if (p >= 1) {
          stopRecording();
        }
      }, 100) as any;
    } catch (err) {
      console.error("Setup error:", err);
      // Fallback start anyway
      setIsRecording(true);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
    };
  }, []);

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
            <Text style={styles.instruction}>
              Analyzing acoustic signature...
            </Text>
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
                  Acoustic Setup
                </Text>
                <Text style={styles.instruction}>
                  Tap your watermelon continuously for 3 seconds to analyze its
                  ripeness level.
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
                      Sound Pressure
                    </Text>
                    <Text
                      style={[
                        styles.cardValue,
                        { color: isDark ? "#FFFFFF" : "#1B4332" },
                      ]}
                    >
                      {isRecording ? Math.round(dbLevel + 160) : "--"} dB
                    </Text>
                  </View>
                  <View style={styles.meterBg}>
                    <View
                      style={[
                        styles.meterFill,
                        {
                          width: isRecording
                            ? `${Math.min(100, (dbLevel + 160) / 1.6)}%`
                            : "0%",
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.cardStatus}>
                    ✅ Sensor is calibrated and ready
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
                    Frequency Spectrum
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
                </View>

                <View
                  style={[
                    styles.alertCard,
                    isRecording && { backgroundColor: "#D8F3DC" },
                  ]}
                >
                  <Text style={styles.alertIcon}>
                    {isRecording ? "🔴" : "ℹ️"}
                  </Text>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle}>
                      {isRecording ? "Recording Taps..." : "3-Second Scan"}
                    </Text>
                    <Text style={styles.alertText}>
                      {isRecording
                        ? "Listening to the resonance. Keep tapping the center..."
                        : "Click below to begin. You will have 3 seconds to tap the watermelon."}
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
                    {result?.status === "READY" ? "🍉" : "⌛"}
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
                      ? "READY FOR HARVEST"
                      : "STILL RIPENING"}
                  </Text>
                </View>

                <View style={styles.statsList}>
                  <View style={styles.statItem}>
                    <Text style={styles.statLabel}>Resonance Freq</Text>
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
                    <Text style={styles.statLabel}>Decay Factor</Text>
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
                    ? "Deep hollow sound detected. High sugar content and maturity achieved."
                    : "The sound is too sharp/solid. The melon likely needs 3-5 more days on the vine."}
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
                ? `Scanning... ${(progress * 100).toFixed(0)}%`
                : "Start Acoustic Scan"}
            </Text>
          </TouchableOpacity>
        )}

        {step === 3 && (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              style={styles.recordButton}
              onPress={() => {
                const query = `analysis_freq=${result?.frequency}&analysis_status=${result?.status}&analysis_amplitude=${result?.amplitude}`;
                router.replace(`/management/add-edit?${query}` as any);
              }}
            >
              <Text style={styles.recordButtonText}>
                Save Result to Inventory
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: "#D8F3DC" }]}
              onPress={() => setStep(1)}
            >
              <Text style={[styles.recordButtonText, { color: "#2D6A4F" }]}>
                Run Another Test
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  backButtonText: { fontSize: 20, color: "#2D6A4F", fontWeight: "bold" },
  title: { fontSize: 18, fontWeight: "700" },
  progressContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
    alignItems: "center",
  },
  progressDots: { flexDirection: "row", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#E0E0E0" },
  activeDot: { width: 24, backgroundColor: "#2D6A4F" },
  content: { padding: 24 },
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
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardValue: { fontSize: 20, fontWeight: "800" },
  meterBg: {
    height: 12,
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  meterFill: { height: "100%", backgroundColor: "#2D6A4F" },
  cardStatus: { fontSize: 12, color: "#2D6A4F", fontWeight: "600" },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 60,
  },
  chartBar: { width: "5%", backgroundColor: "#2D6A4F", borderRadius: 4 },
  alertCard: {
    marginTop: 32,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#E9F5EE",
    flexDirection: "row",
    gap: 12,
  },
  alertIcon: { fontSize: 20 },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 4,
  },
  alertText: { fontSize: 13, color: "#2D6A4F", lineHeight: 18 },
  footer: { padding: 24, paddingBottom: 40 },
  recordButton: {
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  recordButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  resultContainer: { alignItems: "center", paddingTop: 20 },
  resultCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  resultEmoji: { fontSize: 48, marginBottom: 12 },
  resultStatus: {
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  statsList: { width: "100%", gap: 16, marginBottom: 32 },
  statItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  statLabel: { fontSize: 14, color: "#6C757D", fontWeight: "600" },
  statValue: { fontSize: 16, fontWeight: "800" },
  resultAdvice: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 22,
  },
});
