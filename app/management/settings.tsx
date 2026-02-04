import { useAuth } from "@/context/auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Analysis Settings
  const [freqMin, setFreqMin] = useState("100");
  const [freqMax, setFreqMax] = useState("200");
  const [ampMin, setAmpMin] = useState("0.5");

  // Farm Address Settings
  const [sitio, setSitio] = useState("");
  const [barangay, setBarangay] = useState("");
  const [municipality, setMunicipality] = useState("");
  const [province, setProvince] = useState("");

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
          analysisData.watermelon_analysis_settings_ready_frequency_min.toString(),
        );
        setFreqMax(
          analysisData.watermelon_analysis_settings_ready_frequency_max.toString(),
        );
        setAmpMin(
          analysisData.watermelon_analysis_settings_ready_amplitude_min.toString(),
        );
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
        setBarangay(addressData.farmer_address_barangay || "");
        setMunicipality(addressData.farmer_address_municipality || "");
        setProvince(addressData.farmer_address_province || "");
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      Alert.alert("Error", "Could not load settings");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Update Analysis Settings
      const { error: analysisError } = await supabase
        .from("watermelon_analysis_settings_table")
        .upsert({
          farmer_account_id: user.id,
          watermelon_analysis_settings_ready_frequency_min: parseFloat(freqMin),
          watermelon_analysis_settings_ready_frequency_max: parseFloat(freqMax),
          watermelon_analysis_settings_ready_amplitude_min: parseFloat(ampMin),
        });

      if (analysisError) throw analysisError;

      // Update Address Settings
      const { error: addressError } = await supabase
        .from("farmer_address_table")
        .upsert({
          farmer_account_id: user.id,
          farmer_address_sitio: sitio,
          farmer_address_barangay: barangay,
          farmer_address_municipality: municipality,
          farmer_address_province: province,
        });

      if (addressError) throw addressError;

      Alert.alert("Success", "Settings updated successfully");
      router.back();
    } catch (error: any) {
      console.error("Error saving settings:", error);
      Alert.alert("Error", error.message);
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: isDark ? "#FFFFFF" : "#1B4332" }]}
          >
            Analysis & Farm Settings
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#2D6A4F" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#2D6A4F" : "#1B4332" },
            ]}
          >
            Ripeness Analysis Thresholds
          </Text>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Min Frequency (Hz)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={freqMin}
                onChangeText={setFreqMin}
                keyboardType="numeric"
              />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Max Frequency (Hz)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={freqMax}
                onChangeText={setFreqMax}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Min Amplitude
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
            value={ampMin}
            onChangeText={setAmpMin}
            keyboardType="numeric"
          />

          <View style={styles.divider} />

          <Text
            style={[
              styles.sectionTitle,
              { color: isDark ? "#2D6A4F" : "#1B4332" },
            ]}
          >
            Farm Location
          </Text>

          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Sitio / Street
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
            value={sitio}
            onChangeText={setSitio}
            placeholder="e.g. Purok 1"
            placeholderTextColor="#A0A0A0"
          />

          <Text
            style={[styles.label, { color: isDark ? "#A0A0A0" : "#495057" }]}
          >
            Barangay
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                color: isDark ? "#FFFFFF" : "#000000",
              },
            ]}
            value={barangay}
            onChangeText={setBarangay}
          />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Municipality
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
                  },
                ]}
                value={municipality}
                onChangeText={setMunicipality}
              />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.label,
                  { color: isDark ? "#A0A0A0" : "#495057" },
                ]}
              >
                Province
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                    color: isDark ? "#FFFFFF" : "#000000",
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
    paddingTop: 60,
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
});
