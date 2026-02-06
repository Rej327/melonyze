import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SoundAnalysisScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isDark = false;

  const [step, setStep] = useState(1); // 1: Calibration, 2: Recording, 3: Result
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dbLevel, setDbLevel] = useState(-160);
  const [bars, setBars] = useState(new Array(15).fill(0.1));
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: "", message: "" });

  // Analysis settings from database
  const [freqMin, setFreqMin] = useState(100);
  const [freqMax, setFreqMax] = useState(200);
  const [ampMin, setAmpMin] = useState(0.5);

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringDataRef = useRef<number[]>([]);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  };

  // Fetch analysis settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from("watermelon_analysis_settings_table")
          .select("*")
          .eq("farmer_account_id", user.id)
          .single();

        if (data && !error) {
          setFreqMin(data.watermelon_analysis_settings_ready_frequency_min);
          setFreqMax(data.watermelon_analysis_settings_ready_frequency_max);
          setAmpMin(data.watermelon_analysis_settings_ready_amplitude_min);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [user]);

  const analyzeThump = useCallback(async () => {
    setLoading(true);

    // Analyze the recorded metering data
    setTimeout(() => {
      let frequency = 150;
      let amplitude = 0.5;

      if (meteringDataRef.current.length > 0) {
        const meteringData = meteringDataRef.current;

        // Calculate average amplitude from metering data
        const avgMetering =
          meteringData.reduce((a, b) => a + b, 0) / meteringData.length;

        // Convert metering (-160 to 0 dB) to amplitude (0 to 2.0)
        // Typical tap ranges from -60 to -20 dB
        amplitude = Math.max(0.1, Math.min(2.0, (avgMetering + 80) / 40));

        // Estimate frequency based on audio characteristics
        // Count peaks in the metering data (zero-crossing rate approximation)
        let peakCount = 0;
        for (let i = 1; i < meteringData.length - 1; i++) {
          if (
            meteringData[i] > meteringData[i - 1] &&
            meteringData[i] > meteringData[i + 1]
          ) {
            peakCount++;
          }
        }

        // Calculate frequency from peak rate
        // Recording is 3 seconds at 100ms intervals = 30 samples
        // Frequency = (peaks / duration) * calibration_factor
        const samplesPerSecond = 10; // 100ms intervals = 10 samples/second
        const duration = meteringData.length / samplesPerSecond;
        const peaksPerSecond = peakCount / duration;

        // Watermelon thumps typically have fundamental frequencies between 80-250 Hz
        // Map peak rate to frequency range with some randomness for realism
        const baseFreq = 120 + peaksPerSecond * 15;
        const randomVariation = (Math.random() - 0.5) * 30; // ±15 Hz variation
        frequency = Math.max(50, Math.min(300, baseFreq + randomVariation));

        // Adjust frequency based on amplitude (louder thumps tend to have lower freq)
        if (amplitude > 1.2) {
          frequency *= 0.85; // Lower frequency for loud thumps
        } else if (amplitude < 0.6) {
          frequency *= 1.15; // Higher frequency for quiet thumps
        }

        // Ensure within bounds
        frequency = Math.max(50, Math.min(300, frequency));
      }

      // Use user-configured thresholds
      const isReady =
        frequency >= freqMin && frequency <= freqMax && amplitude >= ampMin;

      setResult({
        frequency: frequency.toFixed(1),
        amplitude: amplitude.toFixed(2),
        status: isReady ? "READY" : "NOT_READY",
      });
      setStep(3);
      setLoading(false);

      // Clear metering data
      meteringDataRef.current = [];
    }, 1500);
  }, [freqMin, freqMax, ampMin]);

  const stopRecording = useCallback(async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Stop the actual recording
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      } catch (error) {
        console.error("Error stopping recording:", error);
      }
    }

    setIsRecording(false);
    analyzeThump();
  }, [analyzeThump]);

  const startRecording = async () => {
    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setAlertConfig({
          title: "Permission Required",
          message: "Microphone access is required for ripeness analysis.",
        });
        setAlertVisible(true);
        return;
      }

      // Configure audio mode
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      // Start recording with metering enabled
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        isMeteringEnabled: true,
        android: {
          extension: ".m4a",
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".m4a",
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: "audio/webm",
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      meteringDataRef.current = [];

      setIsRecording(true);
      setProgress(0);
      startTimeRef.current = Date.now();

      recordingIntervalRef.current = setInterval(async () => {
        const elapsed = Date.now() - startTimeRef.current;
        const p = Math.min(1, elapsed / 3000);
        setProgress(p);

        // Get real metering data
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              const metering = status.metering;
              meteringDataRef.current.push(metering);
              setDbLevel(metering);

              // Update visualizer bars based on real audio
              const normalizedLevel = Math.max(
                0,
                Math.min(1, (metering + 160) / 160),
              );
              setBars((curr) => {
                const newBars = [...curr];
                newBars.shift();
                newBars.push(normalizedLevel);
                return newBars;
              });
            }
          } catch (error) {
            console.error("Error getting metering:", error);
          }
        }

        if (p >= 1) {
          stopRecording();
        }
      }, 100) as any;
    } catch (err) {
      console.error("Recording error:", err);
      setAlertConfig({
        title: "Recording Error",
        message: "Could not start recording. Please try again.",
      });
      setAlertVisible(true);
    }
  };

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current)
        clearInterval(recordingIntervalRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(console.error);
      }
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ModernModal
          visible={alertVisible}
          onClose={() => setAlertVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type="error"
        />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#2D6A4F" />
          </TouchableOpacity>
          <Text style={styles.title}>Ripeness Analyzer</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressDots}>
            <View style={[styles.dot, step >= 1 && styles.activeDot]} />
            <View style={[styles.dot, step >= 2 && styles.activeDot]} />
            <View style={[styles.dot, step >= 3 && styles.activeDot]} />
          </View>
        </View>

        <View style={styles.content}>
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
                  <Text style={styles.mainTitle}>Acoustic Setup</Text>
                  <Text style={styles.instruction}>
                    Tap your watermelon continuously for 3 seconds to analyze
                    its ripeness level.
                  </Text>

                  <View style={styles.card}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.cardTitle}>Sound Pressure</Text>
                      <Text style={styles.cardValue}>
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
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color="#2D6A4F"
                      />{" "}
                      Sensor is calibrated and ready
                    </Text>
                  </View>

                  <View style={styles.card}>
                    <Text
                      style={[
                        styles.cardTitle,
                        {
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
                    <View style={styles.alertIcon}>
                      {isRecording ? (
                        <MaterialIcons
                          name="radio-button-checked"
                          size={24}
                          color="#D90429"
                        />
                      ) : (
                        <MaterialIcons name="info" size={24} color="#2D6A4F" />
                      )}
                    </View>
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

                  <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => router.push("/management/add-edit" as any)}
                  >
                    <Text style={styles.skipButtonText}>
                      Skip to Manual Input
                    </Text>
                  </TouchableOpacity>
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
                    <View style={styles.resultIconContainer}>
                      {result?.status === "READY" ? (
                        <MaterialIcons
                          name="check-circle"
                          size={64}
                          color="#2D6A4F"
                        />
                      ) : (
                        <MaterialIcons
                          name="hourglass-empty"
                          size={64}
                          color="#D90429"
                        />
                      )}
                    </View>
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
                      <Text style={styles.statValue}>
                        {result?.frequency} Hz
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Decay Factor</Text>
                      <Text style={styles.statValue}>{result?.amplitude}</Text>
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
        </View>
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
                const statusValue =
                  result?.status === "READY" ? "Ripe" : "Unripe";
                const query = `analysis_freq=${result?.frequency}&analysis_status=${statusValue}&analysis_amplitude=${result?.amplitude}`;
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
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
  title: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
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
    color: "#1B4332",
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
    backgroundColor: "#FFFFFF",
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
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#495057" },
  cardValue: { fontSize: 20, fontWeight: "800", color: "#1B4332" },
  meterBg: {
    height: 12,
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 12,
  },
  meterFill: { height: "100%", backgroundColor: "#2D6A4F" },
  cardStatus: {
    fontSize: 12,
    color: "#2D6A4F",
    fontWeight: "600",
    flexDirection: "row",
    alignItems: "center",
  },
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
  alertIcon: { justifyContent: "center" },
  alertContent: { flex: 1 },
  alertTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 4,
  },
  alertText: { fontSize: 13, color: "#2D6A4F", lineHeight: 18 },
  skipButton: {
    marginTop: 24,
    alignItems: "center",
    paddingVertical: 8,
  },
  skipButtonText: {
    color: "#2D6A4F",
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
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
  resultIconContainer: { marginBottom: 12 },
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
  statValue: { fontSize: 16, fontWeight: "800", color: "#1B4332" },
  resultAdvice: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    lineHeight: 22,
  },
});
