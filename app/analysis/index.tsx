import { analyzeAudioBuffer, analyzeMetering, parseWav } from "@/app/utils/dsp";
import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function SoundAnalysisScreen() {
  const router = useRouter();
  const { user } = useAuth();

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
  const [decayThreshold, setDecayThreshold] = useState(120);

  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringDataRef = useRef<number[]>([]);
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null);

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
        const { data: profile } = await supabase
          .from("farmer_account_table")
          .select("current_farm_group_id")
          .eq("farmer_account_id", user.id)
          .single();

        if (profile?.current_farm_group_id) {
          setCurrentGroupId(profile.current_farm_group_id);
        }

        const { data, error } = await supabase
          .from("watermelon_analysis_settings_table")
          .select("*")
          .eq("farmer_account_id", user.id)
          .single();

        if (data && !error) {
          setFreqMin(data.watermelon_analysis_settings_ready_frequency_min);
          setFreqMax(data.watermelon_analysis_settings_ready_frequency_max);
          if (data.watermelon_analysis_settings_ready_decay_threshold) {
            setDecayThreshold(
              data.watermelon_analysis_settings_ready_decay_threshold,
            );
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();
  }, [user]);

  const stopRecording = useCallback(async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    setIsRecording(false);
    setLoading(true);

    try {
      if (!recordingRef.current) {
        setLoading(false);
        return;
      }

      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        throw new Error("No recording URI");
      }

      // DSP Analysis
      let dspResult: any;

      if (Platform.OS === "ios") {
        // Attempt to parse raw WAV
        const rawSamples = await parseWav(uri);
        if (rawSamples && rawSamples.length > 0) {
          dspResult = analyzeAudioBuffer(rawSamples, {
            freqMin,
            freqMax,
            decayThreshold,
          });
        } else {
          // Fallback if parsing failed
          console.warn("WAV parsing failed, falling back to metering");
          dspResult = analyzeMetering(meteringDataRef.current, {
            freqMin,
            freqMax,
            decayThreshold,
          });
        }
      } else {
        // Android/Other fallback
        dspResult = analyzeMetering(meteringDataRef.current, {
          freqMin,
          freqMax,
          decayThreshold,
        });
      }

      setResult({
        frequency: dspResult.frequency.toFixed(1),
        amplitude: dspResult.amplitude.toFixed(2),
        decayTime: dspResult.decayTime.toFixed(0),
        confidence: dspResult.confidence.toFixed(2),
        status: dspResult.isRipe ? "READY" : "NOT_READY",
        debug: dspResult.debug,
      });

      meteringDataRef.current = [];
      setStep(3);
    } catch (error) {
      console.error("Analysis Error:", error);
      setAlertConfig({
        title: "Analysis Failed",
        message: "Could not process audio. Please try again.",
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  }, [freqMin, freqMax, decayThreshold]);

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

      // Prefer WAV on iOS for raw analysis
      const recordingOptions = {
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        ios: {
          extension: ".wav",
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      };

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);

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

        // Get real metering data for UI and Fallback
        if (recordingRef.current) {
          try {
            const status = await recordingRef.current.getStatusAsync();
            if (status.isRecording && status.metering !== undefined) {
              const metering = status.metering;
              meteringDataRef.current.push(metering);
              setDbLevel(metering);

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
          } catch {
            // ignore
          }
        }

        if (p >= 1) {
          stopRecording();
        }
      }, 50) as any; // Fast polling for better metering resolution
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
    <View style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <ModernHeader
        title="Ripeness Analyzer"
        subtitle="Acoustic resonance testing"
        onBack={handleBack}
      />
      <ModernModal
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type="error"
      />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: "#F8FBF9" },
        ]}
      >
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
                    onPress={() => {
                      if (!currentGroupId) {
                        setAlertConfig({
                          title: "Farm Required",
                          message:
                            "You must join or create a farm group before adding items to inventory. You can still use the analyzer to test ripeness.",
                        });
                        setAlertVisible(true);
                        return;
                      }
                      router.push("/management/add-edit" as any);
                    }}
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
                      <Text style={styles.statLabel}>Decay Time</Text>
                      <Text style={styles.statValue}>
                        {result?.decayTime} ms
                      </Text>
                    </View>
                    <View style={styles.statItem}>
                      <Text style={styles.statLabel}>Confidence</Text>
                      <Text style={styles.statValue}>
                        {Math.round(result?.confidence * 100)}%
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.resultAdvice}>
                    {result?.status === "READY"
                      ? "Deep resonance detected with slow decay. High ripeness probability."
                      : "Sound decays too quickly or frequency is off. Likely unripe or hollow."}
                  </Text>

                  <View style={{ gap: 12, width: "100%", marginTop: 32 }}>
                    <TouchableOpacity
                      style={styles.recordResultButton}
                      onPress={() => {
                        if (!currentGroupId) {
                          setAlertConfig({
                            title: "Cannot Save Result",
                            message:
                              "You must join or create a farm group to save analysis results to inventory. Please visit Farm Management to set up your farm.",
                          });
                          setAlertVisible(true);
                          return;
                        }
                        const statusValue =
                          result?.status === "READY" ? "Ripe" : "Unripe";
                        const query = `analysis_freq=${result?.frequency}&analysis_status=${statusValue}&analysis_amplitude=${result?.amplitude}&analysis_decay=${result?.decayTime}&analysis_confidence=${result?.confidence}`;
                        router.replace(`/management/add-edit?${query}` as any);
                      }}
                    >
                      <Text style={styles.recordButtonText}>
                        Save Result to Inventory
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.recordResultButton,
                        { backgroundColor: "#D8F3DC" },
                      ]}
                      onPress={() => setStep(1)}
                    >
                      <Text
                        style={[styles.recordButtonText, { color: "#2D6A4F" }]}
                      >
                        Run Another Test
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {step === 1 && (
        <View style={styles.footer}>
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
          {!currentGroupId && (
            <Text style={styles.footerWarning}>
              <MaterialIcons name="info" size={14} color="#D97706" /> You can
              test ripeness, but must join a farm to save results.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#2D6A4F",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
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
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  recordResultButton: {
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
  footerWarning: {
    fontSize: 12,
    color: "#D97706",
    textAlign: "center",
    marginTop: 12,
    fontWeight: "600",
  },
});
