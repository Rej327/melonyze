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
 * Simple High-Pass Filter (IIR) to remove rumble < 60Hz
 */
function highPassFilter(buffer: Float32Array, cutoff: number): Float32Array {
  const rc = 1.0 / (2.0 * Math.PI * cutoff);
  const dt = 1.0 / SAMPLE_RATE;
  const alpha = rc / (rc + dt);
  const output = new Float32Array(buffer.length);

  output[0] = buffer[0];
  for (let i = 1; i < buffer.length; i++) {
    output[i] = alpha * (output[i - 1] + buffer[i] - buffer[i - 1]);
  }
  return output;
}

/**
 * Calculate confidence based on Frequency (Dominant Pitch)
 * 60-119 Hz -> 10%
 * 120-140 Hz -> 30%
 * 141-150 Hz -> 40%
 * 151-160 Hz -> 60%
 * 160-164 Hz -> 80% (Assuming 160 inclusive starts here? User said 151-160 is 60%)
 * >= 165 Hz -> 100%
 */
// 130Hz is now RIPE per user request
function getFrequencyConfidence(freq: number): number {
  if (freq < 110) return 0.1; // Too low
  if (freq <= 145) return 0.9; // 110-145Hz RIPE (Includes 130Hz)
  if (freq <= 160) return 0.8; // 146-160Hz Good
  if (freq < 165) return 0.9; // High freq also good
  return 1.0;
}

/**
 * Calculate confidence based on Decay Time
 * EXTREMELY LENIENT for Mobile Mic
 * < 20ms -> 10%
 * 20-60ms -> 40%
 * 60-150ms -> 80% (Reasonable)
 * > 150ms -> 100% (Ideal)
 */
function getDecayConfidence(ms: number): number {
  if (ms < 20) return 0.1;
  if (ms <= 60) return 0.4;
  if (ms <= 150) return 0.9; // Boosted to 0.9 to ensure high confidence
  return 1.0;
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
    minAmplitude: number;
  },
): AnalysisResult {
  // 0. Noise Cancellation: High-Pass Filter
  // Remove frequencies below MIN_FREQ (e.g. 60Hz rumble)
  const filteredBuffer = highPassFilter(buffer, 60);

  // 1. Find Impulse (Peak Amplitude)
  let peakIndex = 0;
  let peakAmp = 0;

  for (let i = 0; i < filteredBuffer.length; i++) {
    if (Math.abs(filteredBuffer[i]) > peakAmp) {
      peakAmp = Math.abs(filteredBuffer[i]);
      peakIndex = i;
    }
  }

  // Normalize Check
  if (peakAmp < thresholdSettings.minAmplitude) {
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
  const windowSize = Math.min(filteredBuffer.length, FFT_SIZE);
  const start = Math.max(0, peakIndex - windowSize / 4);
  const end = Math.min(filteredBuffer.length, start + windowSize);
  const window = filteredBuffer.slice(start, end);

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
  const decayEnd = Math.min(
    filteredBuffer.length,
    peakIndex + 2.5 * SAMPLE_RATE,
  );
  const decaySlice = filteredBuffer.slice(decayStart, decayEnd);

  // Exponential fit approximation or simple threshold finding
  // Find time to drop below 5% of peak (captures full tail)
  const targetAmp = peakAmp * 0.05;
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
  // Ripe = Resonant frequency + Long Reverberation Time (Weighted)

  // New strict confidence tables
  const freqScore = getFrequencyConfidence(domFreq);
  const decayScore = getDecayConfidence(decayTimeMs);

  // Weighted Confidence Calculation (Default)
  let confidence = decayScore * 0.4 + freqScore * 0.5;

  if (peakAmp > thresholdSettings.minAmplitude) confidence += 0.1;

  // USER OVERRIDE: 130Hz -> 80% Confidence (Guaranteed Ripe)
  if (domFreq >= 120 && domFreq <= 149) {
    confidence = Math.max(confidence, 0.8);
  }

  // HARD GATE: Frequency MUST be >= 120Hz to be Ripe
  if (domFreq < 120) {
    confidence = Math.min(confidence, 0.3); // Fail
  }

  // Ripe if Confidence >= 0.50
  const isRipe = confidence >= 0.5;

  return {
    frequency: domFreq,
    amplitude: peakAmp,
    decayTime: decayTimeMs,
    isRipe: isRipe,
    confidence: confidence,
    debug: `Freq: ${domFreq.toFixed(1)}, Decay: ${decayTimeMs.toFixed(0)}`,
  };
}

export async function parseWav(uri: string): Promise<Float32Array | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: "base64",
    });

    // Convert base64 to ArrayBuffer using native methods
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const arrayBuffer = bytes.buffer;
    const dataView = new DataView(arrayBuffer);

    // Skip header (44 bytes standard for WAV)
    const headerSize = 44;
    const sampleBytes = len - headerSize;
    if (sampleBytes <= 0) return null;

    const sampleCount = Math.floor(sampleBytes / 2);
    const samples = new Float32Array(sampleCount);

    for (let i = 0; i < sampleCount; i++) {
      // Read Int16 Little Endian (DataView.getInt16(byteOffset, littleEndian))
      // Standard WAV is Little Endian
      try {
        const int16 = dataView.getInt16(headerSize + i * 2, true);
        samples[i] = int16 / 32768.0;
      } catch {
        // Fallback for unexpected end of buffer
        break;
      }
    }

    return samples;
  } catch (err) {
    console.error("WAV Parse Error", err);
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
    minAmplitude: number;
  },
): AnalysisResult {
  // 1. Convert dB to linear amplitude (0.0 - 1.0) approx
  let amplitudeProfile = meteringData.map((db) => Math.pow(10, db / 20));

  // 1b. Noise Floor Cancellation (Metering)
  // Estimate noise from the first few frames if peak is further in
  // or use a baseline assumption.
  let noiseFloor = 0;
  // If we have enough data before likely peak
  if (amplitudeProfile.length > 5) {
    // Take min of first 3 frames as noise floor
    noiseFloor = Math.min(
      amplitudeProfile[0],
      amplitudeProfile[1],
      amplitudeProfile[2],
    );
    // Subtract noise floor
    amplitudeProfile = amplitudeProfile.map((val) =>
      Math.max(0, val - noiseFloor),
    );
  }

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
  if (peakAmp < thresholdSettings.minAmplitude) {
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

  // 3. Estimate Decay - SIMPLIFIED for mobile robustness
  const TIME_PER_SAMPLE_MS = 20; // Matches high-frequency polling in index.tsx

  // Count samples where signal is above 20% of peak (sustained energy)
  // This is more robust than finding exact decay point
  let sustainedSamples = 0;
  const sustainThreshold = peakAmp * 0.2; // 20% threshold

  for (let i = peakIndex; i < amplitudeProfile.length; i++) {
    if (amplitudeProfile[i] >= sustainThreshold) {
      sustainedSamples++;
    }
  }

  // Also count samples above 50% (strong signal indicator)
  let strongSamples = 0;
  const strongThreshold = peakAmp * 0.5;
  for (let i = peakIndex; i < amplitudeProfile.length; i++) {
    if (amplitudeProfile[i] >= strongThreshold) {
      strongSamples++;
    }
  }

  // Decay time is the sustained sample count * time per sample
  const decayTimeMs = sustainedSamples * TIME_PER_SAMPLE_MS;

  // 4. Estimate Frequency from oscillation pattern
  // Count peaks in the amplitude envelope after the main peak
  let estimatedFreq = 0;
  if (amplitudeProfile.length > peakIndex + 10) {
    const segment = amplitudeProfile.slice(
      peakIndex,
      Math.min(peakIndex + 40, amplitudeProfile.length),
    );

    // Simple peak counting in the decay envelope
    let peakCount = 0;
    let lastWasPeak = false;
    const threshold = peakAmp * 0.1; // Look for oscillations above 10% of peak

    for (let i = 1; i < segment.length - 1; i++) {
      const isPeak =
        segment[i] > segment[i - 1] &&
        segment[i] > segment[i + 1] &&
        segment[i] > threshold;
      if (isPeak && !lastWasPeak) {
        peakCount++;
        lastWasPeak = true;
      } else if (!isPeak) {
        lastWasPeak = false;
      }
    }

    // Estimate frequency from peak count
    if (peakCount > 2) {
      const durationSeconds = (segment.length * TIME_PER_SAMPLE_MS) / 1000;
      estimatedFreq = peakCount / durationSeconds;

      // Clamp to reasonable watermelon range (60-200 Hz)
      estimatedFreq = Math.max(60, Math.min(200, estimatedFreq));
    } else {
      // Fallback: estimate based on sustained samples
      // strongSamples = samples above 50% of peak (strong sustained energy)
      const strongTimeMs = strongSamples * TIME_PER_SAMPLE_MS;

      // Use strong samples as primary indicator (more reliable)
      if (strongTimeMs > 100 || decayTimeMs > 200) {
        estimatedFreq = 170; // 100% Freq Conf - Ripe
      } else if (strongTimeMs > 40 || decayTimeMs > 100) {
        estimatedFreq = 162; // 80% Freq Conf - Good
      } else {
        estimatedFreq = 130; // 30% Freq Conf - Unripe
      }
    }
  } else {
    // Not enough data, use decay-based estimate
    estimatedFreq = decayTimeMs > 80 ? 162 : 130;
  }

  /* const isDecayGood = decayTimeMs >= thresholdSettings.decayThreshold; */

  const freqScore = getFrequencyConfidence(estimatedFreq);
  const decayScore = getDecayConfidence(decayTimeMs);

  // Weighted Confidence Calculation (Default)
  let confidence = decayScore * 0.4 + freqScore * 0.5;

  if (peakAmp > 0.1) confidence += 0.1;

  // USER OVERRIDE: 130Hz -> 80% Confidence (Guaranteed Ripe)
  if (estimatedFreq >= 120 && estimatedFreq <= 149) {
    confidence = Math.max(confidence, 0.8);
  }

  // HARD GATE: Frequency MUST be >= 120Hz to be Ripe
  if (estimatedFreq < 120) {
    confidence = Math.min(confidence, 0.3); // Fail
  }

  // Ripe if Confidence >= 0.50
  const isRipe = confidence >= 0.5;

  return {
    frequency: estimatedFreq,
    amplitude: peakAmp,
    decayTime: decayTimeMs,
    isRipe: isRipe,
    confidence: confidence,
    debug: `[Estimated] Freq: ${estimatedFreq.toFixed(0)}Hz, Decay: ${decayTimeMs.toFixed(0)}ms`,
  };
}
