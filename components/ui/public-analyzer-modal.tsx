import { analyzeAudioBuffer, analyzeMetering, parseWav } from "@/app/utils/dsp";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface PublicAnalyzerModalProps {
  visible: boolean;
  onClose: () => void;
}

export function PublicAnalyzerModal({
  visible,
  onClose,
}: PublicAnalyzerModalProps) {
  const [step, setStep] = useState(1); // 1: Ready, 2: Recording, 3: Result
  const [isRecording, setIsRecording] = useState(false);
  const [dbLevel, setDbLevel] = useState(-160);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bars, setBars] = useState(new Array(12).fill(0.1));
  const [error, setError] = useState("");

  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const startTimeRef = useRef<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringDataRef = useRef<number[]>([]);
  const insets = useSafeAreaInsets();

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    setStep(1);
    setResult(null);
    setProgress(0);
    setError("");
    onClose();
  };

  const stopRecording = useCallback(async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    if (!recordingRef.current) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) {
        setError("No recording found");
        setStep(1);
        return;
      }

      setLoading(true);
      setStep(3);

      const thresholdSettings = {
        freqMin: 60,
        freqMax: 180,
        decayThreshold: 120,
        minAmplitude: 0.1,
      };

      // DSP Analysis with platform-specific handling
      let dspResult: any;

      if (Platform.OS === "ios") {
        // Attempt to parse raw WAV
        const rawSamples = await parseWav(uri);
        if (rawSamples && rawSamples.length > 0) {
          console.log("Using FFT-based analysis, samples:", rawSamples.length);
          dspResult = analyzeAudioBuffer(rawSamples, thresholdSettings);
        } else {
          // Fallback if parsing failed
          console.warn("WAV parsing failed, falling back to metering");
          console.log("Metering data points:", meteringDataRef.current.length);
          dspResult = analyzeMetering(
            meteringDataRef.current,
            thresholdSettings,
          );
        }
      } else {
        // Android/Other fallback
        console.log("Android: Using metering-based analysis");
        console.log("Metering data points:", meteringDataRef.current.length);
        dspResult = analyzeMetering(meteringDataRef.current, thresholdSettings);
      }

      console.log("Analysis result:", dspResult);

      setResult({
        frequency: dspResult.frequency.toFixed(1),
        amplitude: dspResult.amplitude.toFixed(3),
        decay: dspResult.decayTime.toFixed(0),
        status: dspResult.isRipe ? "Ripe" : "Not Ready",
        confidence: dspResult.confidence.toFixed(2),
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      setError(error.message || "Could not analyze the recording");
      setStep(1);
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        recordingRef.current = null;
      }
    } catch (error) {
      console.error("Error cancelling recording:", error);
    }

    setIsRecording(false);
    setProgress(0);
    meteringDataRef.current = [];
    setStep(1);
  }, []);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setError("Microphone permission is required");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: ".wav",
          outputFormat: Audio.AndroidOutputFormat.DEFAULT,
          audioEncoder: Audio.AndroidAudioEncoder.DEFAULT,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: ".wav",
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });

      recordingRef.current = recording;
      meteringDataRef.current = [];

      await recording.startAsync();
      setIsRecording(true);
      setProgress(0);
      setError("");
      startTimeRef.current = Date.now();

      recordingIntervalRef.current = setInterval(async () => {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min(elapsed / 3000, 1);
        setProgress(newProgress);

        if (recording) {
          const status = await recording.getStatusAsync();
          if (status.isRecording && status.metering !== undefined) {
            const db = status.metering;
            meteringDataRef.current.push(db);
            setDbLevel(db);

            const normalized = Math.max(0, Math.min(1, (db + 60) / 60));
            const newBars = bars.map((_, i) => {
              if (i < bars.length * normalized) {
                return 0.3 + Math.random() * 0.7;
              }
              return 0.1 + Math.random() * 0.2;
            });
            setBars(newBars);
          }
        }

        if (newProgress >= 1) {
          setIsRecording(false);
          await stopRecording();
        }
      }, 100);
    } catch (error: any) {
      console.error("Recording error:", error);
      setError(error.message || "Could not start recording");
    }
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setProgress(0);
    setDbLevel(-160);
    setBars(new Array(12).fill(0.1));
    setError("");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <MaterialIcons name="close" size={24} color="#2D6A4F" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Sound Analyzer</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          {error ? (
            <View style={styles.centerContent}>
              <View style={styles.errorIcon}>
                <MaterialIcons name="error-outline" size={56} color="#EF4444" />
              </View>
              <Text style={styles.errorTitle}>Oops!</Text>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  setError("");
                  setStep(1);
                }}
              >
                <Text style={styles.primaryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : step === 1 ? (
            <View style={styles.centerContent}>
              <View style={styles.iconCircle}>
                <MaterialIcons name="mic" size={48} color="#2D6A4F" />
              </View>
              <Text style={styles.mainTitle}>Ready to Test</Text>
              <Text style={styles.instructionText}>
                Tap the watermelon gently and hold your phone close to capture
                the sound
              </Text>
              <View style={styles.demoNote}>
                <MaterialIcons name="info" size={18} color="#F59E0B" />
                <Text style={styles.demoNoteText}>
                  Demo mode • Sign in to save results
                </Text>
              </View>
            </View>
          ) : step === 2 ? (
            <View style={styles.centerContent}>
              <Text style={styles.recordingStatus}>
                {isRecording ? "Listening..." : "Ready"}
              </Text>

              {/* Visualizer */}
              <View style={styles.visualizer}>
                {bars.map((height, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      {
                        height: `${height * 100}%`,
                        backgroundColor: height > 0.5 ? "#2D6A4F" : "#D8F3DC",
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Progress */}
              <View style={styles.progressContainer}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Math.round(progress * 3)}s / 3s
                </Text>
              </View>
            </View>
          ) : loading ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color="#2D6A4F" />
              <Text style={styles.loadingText}>Analyzing...</Text>
            </View>
          ) : result ? (
            <View style={styles.centerContent}>
              {/* Status Badge */}
              <View
                style={[
                  styles.resultBadge,
                  result.status === "Ripe"
                    ? styles.ripeBadge
                    : styles.unripeBadge,
                ]}
              >
                <MaterialIcons
                  name={result.status === "Ripe" ? "check-circle" : "cancel"}
                  size={56}
                  color="#FFFFFF"
                />
                <Text style={styles.resultStatus}>{result.status}</Text>
                <Text style={styles.resultConfidence}>
                  {Math.round(parseFloat(result.confidence) * 100)}% Confidence
                </Text>
              </View>

              {/* Metrics */}
              <View style={styles.metricsContainer}>
                <View style={styles.metricItem}>
                  <MaterialIcons name="graphic-eq" size={20} color="#2D6A4F" />
                  <Text style={styles.metricValue}>{result.frequency} Hz</Text>
                  <Text style={styles.metricLabel}>Frequency</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <MaterialIcons name="timer" size={20} color="#2D6A4F" />
                  <Text style={styles.metricValue}>{result.decay} ms</Text>
                  <Text style={styles.metricLabel}>Decay</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metricItem}>
                  <MaterialIcons name="volume-up" size={20} color="#2D6A4F" />
                  <Text style={styles.metricValue}>{result.amplitude}</Text>
                  <Text style={styles.metricLabel}>Amplitude</Text>
                </View>
              </View>

              {/* Actions */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleReset}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Test Another</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>

        {/* Footer Button */}
        {(step === 1 || step === 2) && !error && (
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(24, insets.bottom + 16) },
            ]}
          >
            {isRecording ? (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={cancelRecording}
              >
                <View
                  style={[
                    styles.recordButtonInner,
                    { backgroundColor: "#FEE2E2" },
                  ]}
                >
                  <MaterialIcons name="close" size={32} color="#EF4444" />
                </View>
                <Text style={[styles.recordButtonText, { color: "#EF4444" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.recordButton}
                onPress={step === 1 ? () => setStep(2) : startRecording}
              >
                <View style={styles.recordButtonInner}>
                  <MaterialIcons name="mic" size={32} color="#FFFFFF" />
                </View>
                <Text style={styles.recordButtonText}>
                  {step === 1 ? "Start" : "Record"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FBF9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerContent: {
    alignItems: "center",
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 12,
  },
  instructionText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  demoNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 8,
  },
  demoNoteText: {
    fontSize: 13,
    color: "#92400E",
    fontWeight: "600",
  },
  recordingStatus: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 32,
  },
  visualizer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 100,
    gap: 6,
    marginBottom: 32,
  },
  bar: {
    width: 6,
    borderRadius: 3,
    minHeight: 6,
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
  },
  progressTrack: {
    width: "100%",
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 12,
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#2D6A4F",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
    marginTop: 16,
  },
  resultBadge: {
    width: "100%",
    borderRadius: 20,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  ripeBadge: {
    backgroundColor: "#2D6A4F",
  },
  unripeBadge: {
    backgroundColor: "#F59E0B",
  },
  resultStatus: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 16,
  },
  resultConfidence: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    marginTop: 8,
    fontWeight: "600",
  },
  metricsContainer: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    width: "100%",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
    marginTop: 8,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "600",
    textTransform: "uppercase",
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "#F8FBF9",
  },
  recordButton: {
    alignItems: "center",
    marginBottom: 8,
  },
  recordButtonInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#2D6A4F",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    elevation: 8,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  recordButtonText: {
    color: "#2D6A4F",
    fontSize: 16,
    fontWeight: "700",
  },
});
