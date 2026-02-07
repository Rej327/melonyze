import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function FarmSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as any,
    onConfirm: undefined as any,
  });

  const router = useRouter();

  // Analysis Settings
  const [freqMin, setFreqMin] = useState(100);
  const [freqMax, setFreqMax] = useState(200);
  const [ampMin, setAmpMin] = useState(0.5);
  const [decayThreshold, setDecayThreshold] = useState(120);

  // Farm Address Settings
  const [sitio, setSitio] = useState("");
  const [barangay, setBarangay] = useState("Brgy. F. Nanadiego");
  const [municipality, setMunicipality] = useState("Mulanay");
  const [province, setProvince] = useState("Quezon");
  const [analysisSettingsId, setAnalysisSettingsId] = useState<string | null>(
    null,
  );
  const [addressSettingsId, setAddressSettingsId] = useState<string | null>(
    null,
  );

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      // Fetch Analysis Settings
      const { data: analysisData, error: analysisError } = await supabase
        .from("watermelon_analysis_settings_table")
        .select("*")
        .eq("farmer_account_id", user.id)
        .single();

      if (analysisError && analysisError.code !== "PGRST116") {
        throw analysisError;
      }

      if (analysisData) {
        setFreqMin(
          analysisData.watermelon_analysis_settings_ready_frequency_min,
        );
        setFreqMax(
          analysisData.watermelon_analysis_settings_ready_frequency_max,
        );
        setAmpMin(
          analysisData.watermelon_analysis_settings_ready_amplitude_min,
        );
        if (analysisData.watermelon_analysis_settings_ready_decay_threshold) {
          setDecayThreshold(
            analysisData.watermelon_analysis_settings_ready_decay_threshold,
          );
        }
        setAnalysisSettingsId(analysisData.watermelon_analysis_settings_id);
      }

      // Fetch Address Settings
      const { data: addressData, error: addressError } = await supabase
        .from("farmer_address_table")
        .select("*")
        .eq("farmer_account_id", user.id)
        .single();

      if (addressError && addressError.code !== "PGRST116") {
        throw addressError;
      }

      if (addressData) {
        setSitio(addressData.farmer_address_sitio || "");
        setBarangay(
          addressData.farmer_address_barangay || "Brgy. F. Nanadiego",
        );
        setMunicipality(addressData.farmer_address_municipality || "Mulanay");
        setProvince(addressData.farmer_address_province || "Quezon");
        setAddressSettingsId(addressData.farmer_address_id);
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      setAlertConfig({
        title: "Error",
        message: "Could not load settings",
        type: "error",
        onConfirm: undefined,
      });
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!user) return;

    // Validate frequency range
    if (freqMin >= freqMax) {
      setAlertConfig({
        title: "Invalid Range",
        message: "Minimum frequency must be less than maximum frequency.",
        type: "error",
        onConfirm: undefined,
      });
      setAlertVisible(true);
      return;
    }

    setSaving(true);
    try {
      const analysisPayload: any = {
        farmer_account_id: user.id,
        watermelon_analysis_settings_ready_frequency_min: freqMin,
        watermelon_analysis_settings_ready_frequency_max: freqMax,
        watermelon_analysis_settings_ready_amplitude_min: ampMin,
        watermelon_analysis_settings_ready_decay_threshold: decayThreshold,
        watermelon_analysis_settings_updated_at: new Date().toISOString(),
      };

      if (analysisSettingsId) {
        analysisPayload.watermelon_analysis_settings_id = analysisSettingsId;
      }

      const { error: analysisError } = await supabase
        .from("watermelon_analysis_settings_table")
        .upsert(analysisPayload);

      if (analysisError) throw analysisError;

      // Upsert Address Settings - we need to fetch the ID first to ensure we update the right record if multiple exist,
      // but usually there's only one. schema.sql doesn't have a unique constraint on farmer_account_id for address.
      // However, we'll try to find an existing one first to keep it simple and consistent.

      const addressPayload: any = {
        farmer_account_id: user.id,
        farmer_address_sitio: sitio,
        farmer_address_barangay: barangay,
        farmer_address_municipality: municipality,
        farmer_address_province: province,
        farmer_address_updated_at: new Date().toISOString(),
      };

      if (addressSettingsId) {
        addressPayload.farmer_address_id = addressSettingsId;
      }

      const { error: addressError } = await supabase
        .from("farmer_address_table")
        .upsert(addressPayload);

      if (addressError) throw addressError;

      setAlertConfig({
        title: "Success",
        message: "Settings updated successfully",
        type: "success",
        onConfirm: () => router.back(),
      });
      setAlertVisible(true);
    } catch (error: any) {
      console.error("Error saving settings:", error);
      setAlertConfig({
        title: "Error",
        message: error.message,
        type: "error",
        onConfirm: undefined,
      });
      setAlertVisible(true);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <StatusBar style="light" />
      <ModernHeader
        title="Farm Settings"
        subtitle="Manage thresholds and location"
        onBack={() => router.back()}
        rightActions={
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <MaterialIcons name="save" size={24} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={[styles.container, { backgroundColor: "#F8FBF9" }]}
      >
        <ModernModal
          visible={alertVisible}
          onClose={() => setAlertVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onConfirm={alertConfig.onConfirm}
        />

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.form}>
            <Text style={styles.sectionTitle}>
              Ripeness Analysis Thresholds
            </Text>

            <Text style={styles.filterTitle}>Min Frequency (Hz)</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={50}
                maximumValue={300}
                step={1}
                value={freqMin}
                onValueChange={setFreqMin}
                minimumTrackTintColor="#2D6A4F"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#2D6A4F"
              />
              <Text style={styles.sliderValue}>{Math.round(freqMin)} Hz</Text>
            </View>

            <Text style={styles.filterTitle}>Max Frequency (Hz)</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={50}
                maximumValue={300}
                step={1}
                value={freqMax}
                onValueChange={setFreqMax}
                minimumTrackTintColor="#2D6A4F"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#2D6A4F"
              />
              <Text style={styles.sliderValue}>{Math.round(freqMax)} Hz</Text>
            </View>

            <Text style={styles.filterTitle}>Min Amplitude</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={0.1}
                maximumValue={2.0}
                step={0.1}
                value={ampMin}
                onValueChange={setAmpMin}
                minimumTrackTintColor="#2D6A4F"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#2D6A4F"
              />
              <Text style={styles.sliderValue}>{ampMin.toFixed(1)}</Text>
            </View>

            <Text style={styles.filterTitle}>Min Decay Time (ms)</Text>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={50}
                maximumValue={500}
                step={10}
                value={decayThreshold}
                onValueChange={setDecayThreshold}
                minimumTrackTintColor="#2D6A4F"
                maximumTrackTintColor="#E0E0E0"
                thumbTintColor="#2D6A4F"
              />
              <Text style={styles.sliderValue}>
                {Math.round(decayThreshold)} ms
              </Text>
            </View>

            <View style={styles.divider} />

            <Text style={[styles.sectionTitle, { color: "#1B4332" }]}>
              Farm Location
            </Text>

            <Text style={[styles.label, { color: "#495057" }]}>
              Sitio / Street
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: "#FFFFFF",
                  color: "#000000",
                },
              ]}
              value={sitio}
              onChangeText={setSitio}
              placeholder="e.g. Purok 1"
              placeholderTextColor="#A0A0A0"
            />

            <Text style={[styles.label, { color: "#495057" }]}>Barangay</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: "#FFFFFF",
                  color: "#000000",
                },
              ]}
              value={barangay}
              onChangeText={setBarangay}
            />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: "#495057" }]}>
                  Municipality
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                    },
                  ]}
                  value={municipality}
                  onChangeText={setMunicipality}
                />
              </View>
              <View style={{ width: 16 }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: "#495057" }]}>
                  Province
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    {
                      backgroundColor: "#FFFFFF",
                      color: "#000000",
                    },
                  ]}
                  value={province}
                  onChangeText={setProvince}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: 20,
    paddingHorizontal: 24,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backButton: {
    paddingVertical: 4,
  },
  backButtonText: {
    color: "#6C757D",
    fontSize: 16,
    fontWeight: "600",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  saveText: {
    color: "#2D6A4F",
    fontSize: 16,
    fontWeight: "700",
  },
  form: {
    padding: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  input: {
    height: 56,
    borderRadius: 16,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 24,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  row: {
    flexDirection: "row",
  },
  divider: {
    height: 1,
    backgroundColor: "#E9F5EE",
    marginVertical: 24,
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    color: "#495057",
    marginTop: 8,
  },
  sliderContainer: {
    marginBottom: 20,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2D6A4F",
    textAlign: "center",
    marginTop: 4,
  },
  headerActionButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
});
