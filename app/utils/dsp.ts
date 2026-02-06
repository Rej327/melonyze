import { Buffer } from "buffer";
import * as FileSystem from "expo-file-system";

// DSP Constants
export const SAMPLE_RATE = 44100; // Standard
export const FFT_SIZE = 2048; // Good balance for frequency resolution
export const ANALYSIS_WINDOW_MS = 600; // ms to analyze
export const MIN_FREQ = 60;
export const MAX_FREQ = 200;

export interface AnalysisResult {
  frequency: number;
  amplitude: number;
  decayTime: number;
  isRipe: boolean;
  confidence: number;
  debug?: string;
}

/**
 * Perform FFT on a real-valued signal
 * Returns magnitude spectrum
 */
export function computeFFT(signal: Float32Array): Float32Array {
  const N = signal.length;
  if (N === 0) return new Float32Array(0);

  // Simple DFT for specific freq range if N is small, or use optimized FFT
  // For JS/Mobile, a simple optimized Cooley-Tukey is best if N is power of 2
  // Here we strictly focus on the relevant bins to save time if possible,
  // but full FFT is safer for peak finding.

  // Check if power of 2
  if ((N & (N - 1)) !== 0) {
    // Pad to next power of 2
    // ... (Omitting complex padding for brevity, we assume caller handles windowing)
  }

  const spectrum = new Float32Array(N / 2);

  // Basic Real DFT for the 0-500Hz range (Optimization: don't compute > 500Hz)
  // Resolution = SampleRate / N
  const binWidth = SAMPLE_RATE / N;
  const maxBin = Math.floor(500 / binWidth);

  for (let k = 0; k <= maxBin; k++) {
    let sumReal = 0;
    let sumImag = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      sumReal += signal[n] * Math.cos(angle);
      sumImag -= signal[n] * Math.sin(angle);
    }
    spectrum[k] = Math.sqrt(sumReal * sumReal + sumImag * sumImag);
  }

  return spectrum;
}

/**
 * Analyze a raw audio buffer for thumps
 */
export function analyzeAudioBuffer(
  buffer: Float32Array,
  thresholdSettings: {
    freqMin: number;
    freqMax: number;
    decayThreshold: number;
  },
): AnalysisResult {
  // 1. Find Impulse (Peak Amplitude)
  let peakIndex = 0;
  let peakAmp = 0;

  for (let i = 0; i < buffer.length; i++) {
    if (Math.abs(buffer[i]) > peakAmp) {
      peakAmp = Math.abs(buffer[i]);
      peakIndex = i;
    }
  }

  // Normalize Check
  if (peakAmp < 0.05) {
    return {
      frequency: 0,
      amplitude: peakAmp,
      decayTime: 0,
      isRipe: false,
      confidence: 0,
      debug: "Signal too weak",
    };
  }

  // 2. Extract Window for FFT (around peak)
  const windowSize = Math.min(buffer.length, FFT_SIZE);
  const start = Math.max(0, peakIndex - windowSize / 4);
  const end = Math.min(buffer.length, start + windowSize);
  const window = buffer.slice(start, end);

  // Apply Hanning Window to reduce leakage
  const w = new Float32Array(window.length);
  for (let i = 0; i < window.length; i++) {
    const multiplier =
      0.5 * (1 - Math.cos((2 * Math.PI * i) / (window.length - 1)));
    w[i] = window[i] * multiplier;
  }

  // 3. Compute FFT & Frequency
  const spectrum = computeFFT(w);
  const binWidth = SAMPLE_RATE / window.length;

  let domFreq = 0;
  let maxMag = 0;
  for (let i = 1; i < spectrum.length; i++) {
    // Skip DC
    const freq = i * binWidth;
    if (freq >= MIN_FREQ && freq <= MAX_FREQ) {
      if (spectrum[i] > maxMag) {
        maxMag = spectrum[i];
        domFreq = freq;
      }
    }
  }

  // 4. Decay Analysis
  // Look at 300ms after peak
  const decayStart = peakIndex;
  const decayEnd = Math.min(buffer.length, peakIndex + 0.3 * SAMPLE_RATE);
  const decaySlice = buffer.slice(decayStart, decayEnd);

  // Exponential fit approximation or simple threshold finding
  // Find time to drop below 30% of peak
  const targetAmp = peakAmp * 0.3;
  let decaySamples = 0;
  let envelope = 0;
  const smoothFactor = 0.9; // Simple envelope follower

  for (let i = 0; i < decaySlice.length; i++) {
    const currentAbs = Math.abs(decaySlice[i]);
    envelope = envelope * smoothFactor + currentAbs * (1.0 - smoothFactor);

    if (i > 200 && envelope < targetAmp) {
      // Ignore immediate noise, require some sustain
      decaySamples = i;
      break;
    }
    decaySamples = i; // If never drops, use full length
  }

  const decayTimeMs = (decaySamples / SAMPLE_RATE) * 1000;

  // 5. Normalization & Scoring
  // const normalizedEnergy = decayTimeMs / (peakAmp * 1000); // Heuristic (unused for now)

  // Classification
  // Ripe = Resonant (80-150Hz ideally) + Long Decay
  const isFreqGood =
    domFreq >= thresholdSettings.freqMin &&
    domFreq <= thresholdSettings.freqMax;
  const isDecayGood = decayTimeMs >= thresholdSettings.decayThreshold;

  let confidence = 0.5;
  if (isFreqGood) confidence += 0.2;
  if (isDecayGood) confidence += 0.3;

  if (decaysTooFast(decayTimeMs)) confidence -= 0.4;

  return {
    frequency: domFreq,
    amplitude: peakAmp,
    decayTime: decayTimeMs,
    isRipe: isFreqGood && isDecayGood,
    confidence: Math.min(1.0, Math.max(0, confidence)),
    debug: `Freq: ${domFreq.toFixed(1)}, Decay: ${decayTimeMs.toFixed(0)}`,
  };
}

function decaysTooFast(ms: number) {
  return ms < 50;
}

export async function parseWav(uri: string): Promise<Float32Array | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });
    const binaryString = Buffer.from(base64, "base64");

    // Skip header (44 bytes standard, but scanning for 'data' chunk is safer)
    // Simple fixed skip for standard WAV
    const headerSize = 44;
    const rawData = binaryString.slice(headerSize);

    // Convert to Float32 (-1.0 to 1.0)
    // Assuming 16-bit PCM
    const samples = new Float32Array(rawData.length / 2);
    for (let i = 0; i < samples.length; i++) {
      // Read Int16 Little Endian
      const int16 = rawData.readInt16LE(i * 2);
      samples[i] = int16 / 32768.0;
    }

    return samples;
  } catch (e) {
    console.error("WAV Parse Error", e);
    return null;
  }
}

/**
 * Fallback analysis using Metering Data (dB)
 * Useful for Android/Expo where raw PCM access is difficult
 */
export function analyzeMetering(
  meteringData: number[], // Array of dB values (e.g., -160 to 0)
  thresholdSettings: {
    freqMin: number;
    freqMax: number;
    decayThreshold: number;
  },
): AnalysisResult {
  // 1. Convert dB to linear amplitude (0.0 - 1.0) approx
  const amplitudeProfile = meteringData.map((db) => Math.pow(10, db / 20));

  // 2. Find Peak
  let peakIndex = 0;
  let peakAmp = 0;
  for (let i = 0; i < amplitudeProfile.length; i++) {
    if (amplitudeProfile[i] > peakAmp) {
      peakAmp = amplitudeProfile[i];
      peakIndex = i;
    }
  }

  // Normalization check
  if (peakAmp < 0.001) {
    // Very quiet
    return {
      frequency: 0,
      amplitude: 0,
      decayTime: 0,
      isRipe: false,
      confidence: 0,
      debug: "Silence",
    };
  }

  // 3. Estimate Decay
  const TIME_PER_SAMPLE_MS = 50; // Approx interval for metering updates (matches polling in index.tsx)

  let decaySamples = 0;
  const targetAmp = peakAmp * 0.3;

  for (let i = peakIndex; i < amplitudeProfile.length; i++) {
    if (amplitudeProfile[i] < targetAmp) {
      decaySamples = i - peakIndex;
      break;
    }
  }
  // If never dropped, assume long decay
  if (decaySamples === 0 && amplitudeProfile.length > peakIndex)
    decaySamples = amplitudeProfile.length - peakIndex;

  const decayTimeMs = decaySamples * TIME_PER_SAMPLE_MS;

  // 4. Estimate Frequency (Heuristic fallback)
  const estimatedFreq = 125; // Median 'ripe' freq as fallback

  const isDecayGood = decayTimeMs >= thresholdSettings.decayThreshold;

  // Confidence is lower on metering-only
  let confidence = 0.4;
  if (isDecayGood) confidence += 0.2;
  if (peakAmp > 0.1) confidence += 0.2;

  return {
    frequency: estimatedFreq,
    amplitude: peakAmp,
    decayTime: decayTimeMs,
    isRipe: isDecayGood,
    confidence: confidence,
    debug: `[Approx] Decay: ${decayTimeMs}ms`,
  };
}
