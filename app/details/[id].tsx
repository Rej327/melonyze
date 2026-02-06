import { ModernModal } from "@/components/ui/modern-modal";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface WatermelonDetail {
  watermelon_item_id: string;
  watermelon_item_label: string;
  watermelon_item_variety: string;
  watermelon_item_description: string;
  watermelon_item_harvest_status: "READY" | "NOT_READY";
  watermelon_item_image_url: string;
  watermelon_item_created_at: string;
  last_analysis?: {
    frequency: number;
    amplitude: number;
    result: string;
  };
  last_sweetness?: number;
}

export default function WatermelonDetails() {
  const { id } = useLocalSearchParams();
  const [watermelon, setWatermelon] = useState<WatermelonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const router = useRouter();
  const isDark = false;

  const fetchDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("watermelon_item_table")
        .select("*")
        .eq("watermelon_item_id", id)
        .single();

      if (error) throw error;

      // Fetch latest analysis
      const { data: analysisData } = await supabase
        .from("watermelon_sound_analyses_table")
        .select("*")
        .eq("watermelon_item_id", id)
        .order("watermelon_sound_analysis_created_at", { ascending: false })
        .limit(1)
        .single();

      // Fetch latest sweetness
      const { data: sweetnessData } = await supabase
        .from("watermelon_sweetness_record_table")
        .select("*")
        .eq("watermelon_item_id", id)
        .order("watermelon_sweetness_record_created_at", { ascending: false })
        .limit(1)
        .single();

      setWatermelon({
        ...data,
        last_analysis: analysisData
          ? {
              frequency: analysisData.watermelon_sound_analysis_frequency,
              amplitude: analysisData.watermelon_sound_analysis_amplitude,
              result: analysisData.watermelon_sound_analysis_result,
            }
          : undefined,
        last_sweetness: sweetnessData?.watermelon_sweetness_record_score,
      });
    } catch (error) {
      console.error("Error fetching details:", error);
      setErrorVisible(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const handleDelete = () => {
    setDeleteVisible(true);
  };

  const confirmDelete = async () => {
    const { error } = await supabase
      .from("watermelon_item_table")
      .delete()
      .eq("watermelon_item_id", id);

    if (error) {
      console.error(error);
    } else {
      router.replace("/(tabs)");
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.centered,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  if (!watermelon) return null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <View
        style={[
          styles.container,
          { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
        ]}
      >
        <ModernModal
          visible={errorVisible}
          onClose={() => setErrorVisible(false)}
          title="Error"
          message="Could not load watermelon details. Please try again."
          type="error"
        />

        <ModernModal
          visible={deleteVisible}
          onClose={() => setDeleteVisible(false)}
          title="Delete Entry"
          message="Are you sure you want to delete this watermelon record? This action cannot be undone."
          type="error"
          confirmText="Delete"
          onConfirm={confirmDelete}
        />

        <ScrollView>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButton}
            >
              <MaterialIcons name="arrow-back" size={24} color="#2D6A4F" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Details</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.content}>
            <View style={styles.imageContainer}>
              <Image
                source={{
                  uri:
                    watermelon.watermelon_item_image_url ||
                    "https://placehold.co/600x400?text=No+Image",
                }}
                style={styles.mainImage}
              />
              <View style={styles.idBadge}>
                <Text style={styles.idText}>
                  ID: {watermelon.watermelon_item_label}
                </Text>
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.titleRow}>
                <Text
                  style={[
                    styles.variety,
                    { color: isDark ? "#FFFFFF" : "#1B4332" },
                  ]}
                >
                  {watermelon.watermelon_item_variety}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        watermelon.watermelon_item_harvest_status === "READY"
                          ? "#2D6A4F"
                          : "#D90429",
                    },
                  ]}
                />
              </View>
              <Text style={styles.batchInfo}>
                {watermelon.watermelon_item_description?.match(
                  /\[Batch: (.*?)\]/,
                )?.[1] || "No Batch Set"}
              </Text>

              <View style={styles.statsGrid}>
                <View style={styles.statBox}>
                  <MaterialIcons
                    name="bubble-chart"
                    size={24}
                    color="#2D6A4F"
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={styles.statTitle}>BRIX LEVEL</Text>
                  <Text style={[styles.statValue, { color: "#2D6A4F" }]}>
                    {watermelon.last_sweetness || "--"}°
                  </Text>
                  <Text style={styles.statDesc}>
                    {watermelon.last_sweetness
                      ? watermelon.last_sweetness > 11
                        ? "Excellent Sweetness"
                        : "Standard Sweetness"
                      : "No Record"}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <MaterialIcons
                    name="check-circle"
                    size={24}
                    color={
                      watermelon.watermelon_item_harvest_status === "READY"
                        ? "#2D6A4F"
                        : "#D90429"
                    }
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={styles.statTitle}>RIPENESS</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          watermelon.watermelon_item_harvest_status === "READY"
                            ? "#2D6A4F"
                            : "#D90429",
                      },
                    ]}
                  >
                    {watermelon.watermelon_item_harvest_status === "READY"
                      ? "Ripe"
                      : "Unripe"}
                  </Text>
                  <Text style={styles.statDesc}>
                    {watermelon.watermelon_item_harvest_status === "READY"
                      ? "Ready to Ship"
                      : "Needs more time"}
                  </Text>
                </View>
              </View>

              <View style={styles.analysisCard}>
                <View style={styles.analysisHeader}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <MaterialIcons
                      name="description"
                      size={20}
                      color="#1B4332"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.analysisTitle}>Description</Text>
                  </View>
                  <View style={styles.densityBadge}>
                    <Text style={styles.densityText}>High Density</Text>
                  </View>
                </View>

                <Text style={styles.analysisNotes}>
                  {watermelon.watermelon_item_description?.replace(
                    /\[Batch: .*?\]\n?/,
                    "",
                  ) || "No additional description provided."}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.editButton}
                onPress={() =>
                  router.push({
                    pathname: "/management/add-edit",
                    params: { id: watermelon.watermelon_item_id },
                  } as any)
                }
              >
                <Text style={styles.editButtonText}>Edit Details</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete Entry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
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
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    paddingVertical: 8,
  },
  backButtonText: {
    color: "#2D6A4F",
    fontWeight: "600",
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  content: {
    paddingBottom: 40,
  },
  imageContainer: {
    marginHorizontal: 24,
    borderRadius: 16,
    overflow: "hidden",
    height: 280,
    position: "relative",
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  mainImage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F0F0F0",
  },
  idBadge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  idText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 12,
  },
  infoSection: {
    paddingHorizontal: 24,
    marginTop: 24,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  variety: {
    fontSize: 28,
    fontWeight: "800",
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  batchInfo: {
    fontSize: 14,
    color: "#6C757D",
    marginTop: 4,
    fontWeight: "500",
  },
  statsGrid: {
    flexDirection: "row",
    marginTop: 24,
    gap: 16,
  },
  statBox: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: "flex-start",
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  statTitle: {
    fontSize: 10,
    fontWeight: "800",
    color: "#A0A0A0",
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  statDesc: {
    fontSize: 10,
    color: "#6C757D",
  },
  analysisCard: {
    marginTop: 24,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  analysisTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B4332",
  },
  densityBadge: {
    backgroundColor: "#D8F3DC",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  densityText: {
    color: "#2D6A4F",
    fontSize: 10,
    fontWeight: "800",
  },
  chartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 80,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  chartBar: {
    width: "8%",
    backgroundColor: "#2D6A4F",
    borderRadius: 4,
  },
  chartLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginBottom: 20,
  },
  chartLabelText: {
    fontSize: 10,
    color: "#A0A0A0",
    fontWeight: "600",
  },
  analysisNotes: {
    fontSize: 14,
    lineHeight: 22,
    color: "#495057",
    fontWeight: "400",
  },
  editButton: {
    marginTop: 32,
    height: 56,
    backgroundColor: "#2D6A4F",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  editButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 12,
    height: 56,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#FFD7D7",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  deleteButtonText: {
    color: "#D90429",
    fontSize: 16,
    fontWeight: "700",
  },
});
