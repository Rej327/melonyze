import { analyzeAudioBuffer, analyzeMetering, parseWav } from "@/app/utils/dsp";
import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { MaterialIcons } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PublicAnalyzerScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1); // 1: Calibration, 2: Recording, 3: Result
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [dbLevel, setDbLevel] = useState(-160);
  const [bars, setBars] = useState(new Array(15).fill(0.1));
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: "", message: "" });

  // Default analysis settings
  const freqMin = 60;
  const freqMax = 180;
  const ampMin = 0.1;
  const decayThreshold = 120;

  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const startTimeRef = useRef<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringDataRef = useRef<number[]>([]);
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(auth)/welcome");
    }
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
        setAlertConfig({
          title: "Error",
          message: "No recording found",
        });
        setAlertVisible(true);
        return;
      }

      setLoading(true);
      setStep(3);

      // Parse WAV file
      const samples = await parseWav(uri);

      if (!samples) {
        setAlertConfig({
          title: "Error",
          message: "Could not parse audio file",
        });
        setAlertVisible(true);
        setStep(1);
        setLoading(false);
        return;
      }

      const thresholdSettings = {
        freqMin,
        freqMax,
        decayThreshold,
        minAmplitude: ampMin,
      };

      const meteringAnalysis = analyzeMetering(
        meteringDataRef.current,
        thresholdSettings,
      );
      const audioAnalysis = analyzeAudioBuffer(samples, thresholdSettings);

      const dominantFreq = audioAnalysis.frequency;
      const amplitude = audioAnalysis.amplitude;
      const decay = audioAnalysis.decayTime;

      let isRipe = false;
      let confidence = 0.5;

      if (amplitude >= ampMin) {
        if (dominantFreq >= freqMin && dominantFreq <= freqMax) {
          if (decay >= decayThreshold) {
            isRipe = true;
            confidence = 0.75 + Math.min(0.2, (decay - decayThreshold) / 1000);
          } else {
            confidence = 0.3 + (decay / decayThreshold) * 0.4;
          }
        } else {
          confidence = 0.2;
        }
      } else {
        confidence = 0.1;
      }

      setResult({
        frequency: dominantFreq.toFixed(1),
        amplitude: amplitude.toFixed(3),
        decay: decay.toFixed(0),
        status: isRipe ? "Ripe" : "Not Ready",
        confidence: confidence.toFixed(2),
        meteringPeak: meteringAnalysis.amplitude.toFixed(3),
        meteringAvg: (meteringAnalysis.decayTime / 1000).toFixed(1),
      });
    } catch (error: any) {
      console.error("Analysis error:", error);
      setAlertConfig({
        title: "Analysis Failed",
        message: error.message || "Could not analyze the recording",
      });
      setAlertVisible(true);
      setStep(1);
    } finally {
      setLoading(false);
    }
  }, [ampMin, decayThreshold, freqMax, freqMin]);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        setAlertConfig({
          title: "Permission Required",
          message: "Microphone access is needed for sound analysis",
        });
        setAlertVisible(true);
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
      setAlertConfig({
        title: "Recording Failed",
        message: error.message,
      });
      setAlertVisible(true);
    }
  };

  const handleReset = () => {
    setStep(1);
    setResult(null);
    setProgress(0);
    setDbLevel(-160);
    setBars(new Array(15).fill(0.1));
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <StatusBar style="light" />
      <ModernHeader
        title="Try Sound Analyzer"
        subtitle="Test without signing in"
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
          { backgroundColor: "#F8FBF9", paddingBottom: insets.bottom + 100 },
        ]}
      >
        <View style={styles.progressContainer}>
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
              <Text style={styles.stepNumber}>1</Text>
            </View>
            <View
              style={[styles.stepLine, step >= 2 && styles.stepLineActive]}
            />
            <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
              <Text style={styles.stepNumber}>2</Text>
            </View>
            <View
              style={[styles.stepLine, step >= 3 && styles.stepLineActive]}
            />
            <View style={[styles.stepDot, step >= 3 && styles.stepDotActive]}>
              <Text style={styles.stepNumber}>3</Text>
            </View>
          </View>
        </View>

        {step === 1 && (
          <View style={styles.content}>
            <View style={styles.instructionCard}>
              <MaterialIcons name="info-outline" size={32} color="#2D6A4F" />
              <Text style={styles.instructionTitle}>How to Test</Text>
              <Text style={styles.instructionText}>
                1. Find a watermelon to test{"\n"}
                2. Tap the watermelon gently with your knuckles{"\n"}
                3. Hold your phone close to capture the sound{"\n"}
                4. Get instant ripeness analysis
              </Text>
            </View>

            <View style={styles.noteCard}>
              <MaterialIcons
                name="lightbulb-outline"
                size={24}
                color="#F59E0B"
              />
              <Text style={styles.noteText}>
                This is a demo version. Sign in to save your analysis results
                and manage your harvest!
              </Text>
            </View>
          </View>
        )}

        {step === 2 && (
          <View style={styles.content}>
            <View style={styles.recordingCard}>
              <Text style={styles.recordingTitle}>
                {isRecording ? "Recording..." : "Ready"}
              </Text>
              <View style={styles.visualizer}>
                {bars.map((height, i) => (
                  <View
                    key={i}
                    style={[
                      styles.bar,
                      {
                        height: `${height * 100}%`,
                        backgroundColor:
                          height > 0.5 ? "#2D6A4F" : "rgba(45, 106, 79, 0.3)",
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[styles.progressBar, { width: `${progress * 100}%` }]}
                />
              </View>
              <Text style={styles.dbText}>
                {dbLevel > -160 ? `${dbLevel.toFixed(0)} dB` : "Waiting..."}
              </Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.content}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2D6A4F" />
                <Text style={styles.loadingText}>Analyzing sound...</Text>
              </View>
            ) : result ? (
              <View style={styles.resultContainer}>
                <View
                  style={[
                    styles.statusBadge,
                    result.status === "Ripe"
                      ? styles.statusBadgeRipe
                      : styles.statusBadgeUnripe,
                  ]}
                >
                  <MaterialIcons
                    name={result.status === "Ripe" ? "check-circle" : "cancel"}
                    size={48}
                    color="#FFFFFF"
                  />
                  <Text style={styles.statusText}>{result.status}</Text>
                  <Text style={styles.confidenceText}>
                    {Math.round(parseFloat(result.confidence) * 100)}%
                    Confidence
                  </Text>
                </View>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricCard}>
                    <MaterialIcons
                      name="graphic-eq"
                      size={24}
                      color="#2D6A4F"
                    />
                    <Text style={styles.metricLabel}>Frequency</Text>
                    <Text style={styles.metricValue}>
                      {result.frequency} Hz
                    </Text>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialIcons name="volume-up" size={24} color="#2D6A4F" />
                    <Text style={styles.metricLabel}>Amplitude</Text>
                    <Text style={styles.metricValue}>{result.amplitude}</Text>
                  </View>
                  <View style={styles.metricCard}>
                    <MaterialIcons name="timer" size={24} color="#2D6A4F" />
                    <Text style={styles.metricLabel}>Decay</Text>
                    <Text style={styles.metricValue}>{result.decay} ms</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.resetButton}
                  onPress={handleReset}
                >
                  <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                  <Text style={styles.resetButtonText}>Test Another</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.signInPrompt}
                  onPress={() => router.push("/(auth)/login")}
                >
                  <Text style={styles.signInPromptText}>
                    Sign in to save results and manage your harvest →
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {step === 1 && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(24, insets.bottom + 16) },
          ]}
        >
          <TouchableOpacity
            style={styles.recordButton}
            onPress={() => setStep(2)}
          >
            <MaterialIcons name="mic" size={28} color="#FFFFFF" />
            <Text style={styles.recordButtonText}>Start Test</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 2 && !isRecording && (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(24, insets.bottom + 16) },
          ]}
        >
          <TouchableOpacity
            style={styles.recordButton}
            onPress={startRecording}
          >
            <MaterialIcons name="mic" size={28} color="#FFFFFF" />
            <Text style={styles.recordButtonText}>Tap to Record</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  progressContainer: {
    marginBottom: 32,
  },
  stepIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  stepDot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E0E0E0",
    justifyContent: "center",
    alignItems: "center",
  },
  stepDotActive: {
    backgroundColor: "#2D6A4F",
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stepLine: {
    width: 60,
    height: 3,
    backgroundColor: "#E0E0E0",
  },
  stepLineActive: {
    backgroundColor: "#2D6A4F",
  },
  content: {
    flex: 1,
  },
  instructionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  instructionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1B4332",
    marginTop: 16,
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 15,
    color: "#495057",
    lineHeight: 24,
    textAlign: "center",
  },
  noteCard: {
    backgroundColor: "#FFF9E6",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "#F59E0B",
  },
  noteText: {
    flex: 1,
    fontSize: 14,
    color: "#92400E",
    lineHeight: 20,
    marginLeft: 12,
  },
  recordingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  recordingTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 24,
  },
  visualizer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    height: 120,
    gap: 4,
    marginBottom: 24,
  },
  bar: {
    width: 8,
    borderRadius: 4,
    minHeight: 8,
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    backgroundColor: "#E0E0E0",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#2D6A4F",
    borderRadius: 4,
  },
  dbText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#495057",
  },
  loadingContainer: {
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: "#495057",
    marginTop: 16,
  },
  resultContainer: {
    alignItems: "center",
  },
  statusBadge: {
    width: "100%",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  statusBadgeRipe: {
    backgroundColor: "#2D6A4F",
  },
  statusBadgeUnripe: {
    backgroundColor: "#F59E0B",
  },
  statusText: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: 16,
  },
  confidenceText: {
    fontSize: 16,
    color: "#D8F3DC",
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
    width: "100%",
  },
  metricCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6C757D",
    marginTop: 8,
    fontWeight: "600",
  },
  metricValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B4332",
    marginTop: 4,
  },
  resetButton: {
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  signInPrompt: {
    paddingVertical: 12,
  },
  signInPromptText: {
    fontSize: 14,
    color: "#2D6A4F",
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#F8FBF9",
    paddingHorizontal: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  recordButton: {
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    height: 64,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    elevation: 6,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
  },
  recordButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
});
