import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface WatermelonDetail {
  watermelon_item_id: string;
  watermelon_item_label: string;
  watermelon_item_variety: string;
  watermelon_item_description: string;
  watermelon_item_harvest_status: "READY" | "NOT_READY" | "SOLD";
  watermelon_item_image_url: string;
  watermelon_item_created_at: string;
  last_analysis?: {
    frequency: number;
    amplitude: number;
    result: string;
  };
  last_sweetness?: number;
  farm_group_table?: {
    farm_owner_id: string;
    farm_group_id: string;
  };
  farm_group_id?: string;
  is_deletion_pending?: boolean;
}

export default function WatermelonDetails() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [watermelon, setWatermelon] = useState<WatermelonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [errorVisible, setErrorVisible] = useState(false);
  const [isSaleModalVisible, setIsSaleModalVisible] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");
  const router = useRouter();

  const isOwner = React.useMemo(
    () => watermelon?.farm_group_table?.farm_owner_id === user?.id,
    [watermelon, user],
  );

  const fetchDetails = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("watermelon_item_table")
        .select("*, farm_group_table(farm_owner_id, farm_group_id)") // Fetch farm_group_id
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
        farm_group_id: data.farm_group_table?.farm_group_id, // Assign farm_group_id
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
    setDeleteConfig({
      title: isOwner ? "Confirm Delete" : "Request Delete",
      message: isOwner
        ? "Are you sure you want to delete this watermelon record?"
        : "You are not the owner. Requesting deletion will notify the owner for approval. Continue?",
      isOwner,
    });
    setDeleteVisible(true);
  };

  const [deleteConfig, setDeleteConfig] = useState({
    title: "Delete Entry",
    message: "Are you sure you want to delete this watermelon record?",
    isOwner: false,
  });

  const confirmDelete = async () => {
    setLoading(true);
    try {
      if (deleteConfig.isOwner) {
        const { error } = await supabase.rpc("bulk_delete_watermelons", {
          p_executing_user_id: user?.id,
          p_item_ids: [id],
        });
        if (error) throw error;
        router.replace("/(tabs)");
      } else {
        const { error } = await supabase.rpc(
          "request_bulk_delete_watermelons",
          {
            p_farmer_id: user?.id,
            p_item_ids: [id],
          },
        );
        if (error) throw error;
        setDeleteVisible(false);
        fetchDetails();
      }
    } catch (error: any) {
      console.error(error);
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSale = () => {
    setSaleAmount("");
    setIsSaleModalVisible(true);
  };

  const confirmSale = async () => {
    if (!saleAmount || isNaN(Number(saleAmount))) {
      alert("Please enter a valid amount");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("record_watermelon_sale", {
        p_executing_user_id: user?.id,
        p_farm_group_id: watermelon?.farm_group_id,
        p_item_ids: [id],
        p_total_amount: Number(saleAmount),
      });

      if (error) throw error;
      setIsSaleModalVisible(false);
      fetchDetails();
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: "#F8FBF9" }]}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  if (!watermelon) return null;

  return (
    <View style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <StatusBar style="light" />
      <ModernHeader
        title={watermelon.watermelon_item_label || "Watermelon Details"}
        subtitle={watermelon.watermelon_item_variety}
        onBack={() => router.back()}
        rightActions={
          <>
            {isOwner && !watermelon.is_deletion_pending && (
              <TouchableOpacity
                style={styles.headerActionButton}
                onPress={() =>
                  router.push(
                    `/management/add-edit?id=${watermelon.watermelon_item_id}` as any,
                  )
                }
              >
                <MaterialIcons name="edit" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            )}
          </>
        }
      />
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
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
          title={deleteConfig.title}
          message={deleteConfig.message}
          type={deleteConfig.isOwner ? "error" : "info"}
          confirmText={deleteConfig.isOwner ? "Delete" : "Request"}
          onConfirm={confirmDelete}
        />

        <ModernModal
          visible={isSaleModalVisible}
          onClose={() => setIsSaleModalVisible(false)}
          title="Record Sale"
          message={`Confirming sale for ${watermelon.watermelon_item_label}.`}
          type="info"
          confirmText="Complete Sale"
          onConfirm={confirmSale}
        >
          <View style={{ marginTop: 16 }}>
            <Text style={styles.statTitle}>SALE PRICE (₱)</Text>
            <TextInput
              style={{
                backgroundColor: "#F8FBF9",
                borderRadius: 12,
                padding: 12,
                fontSize: 18,
                fontWeight: "700",
                marginTop: 8,
                borderWidth: 1,
                borderColor: "#D8F3DC",
              }}
              placeholder="e.g. 50"
              keyboardType="numeric"
              value={saleAmount}
              onChangeText={setSaleAmount}
              autoFocus
            />
          </View>
        </ModernModal>

        <ScrollView contentContainerStyle={styles.scrollContent}>
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
                <Text style={[styles.variety, { color: "#1B4332" }]}>
                  {watermelon.watermelon_item_variety}
                </Text>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor:
                        watermelon.watermelon_item_harvest_status === "READY"
                          ? "#2D6A4F"
                          : watermelon.watermelon_item_harvest_status === "SOLD"
                            ? "#DDB892"
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
                    name={
                      watermelon.watermelon_item_harvest_status === "SOLD"
                        ? "monetization-on"
                        : "check-circle"
                    }
                    size={24}
                    color={
                      watermelon.watermelon_item_harvest_status === "SOLD"
                        ? "#DDB892"
                        : watermelon.watermelon_item_harvest_status === "READY"
                          ? "#2D6A4F"
                          : "#D90429"
                    }
                    style={{ marginBottom: 8 }}
                  />
                  <Text style={styles.statTitle}>STATUS</Text>
                  <Text
                    style={[
                      styles.statValue,
                      {
                        color:
                          watermelon.watermelon_item_harvest_status === "SOLD"
                            ? "#B08968"
                            : watermelon.watermelon_item_harvest_status ===
                                "READY"
                              ? "#2D6A4F"
                              : "#D90429",
                      },
                    ]}
                  >
                    {watermelon.watermelon_item_harvest_status === "SOLD"
                      ? "Sold"
                      : watermelon.watermelon_item_harvest_status === "READY"
                        ? "Ripe"
                        : "Unripe"}
                  </Text>
                  <Text style={styles.statDesc}>
                    {watermelon.watermelon_item_harvest_status === "SOLD"
                      ? "Transaction Recorded"
                      : watermelon.watermelon_item_harvest_status === "READY"
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

              {watermelon.watermelon_item_harvest_status !== "SOLD" &&
                watermelon.farm_group_table?.farm_owner_id === user?.id && (
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      { backgroundColor: "#DDB892", marginTop: 12 },
                    ]}
                    onPress={handleSale}
                  >
                    <Text style={styles.editButtonText}>Mark as Sold</Text>
                  </TouchableOpacity>
                )}

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
  header: {
    paddingTop: 20,
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
  headerActionButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 16,
  },
});
