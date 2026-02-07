import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function ItemManagementScreen() {
  const { user } = useAuth();
  const { activeFarm, isOwner, loading: farmLoading } = useFarm();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [itemRequests, setItemRequests] = useState<any[]>([]);

  // Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState<any>({
    title: "",
    message: "",
    type: "info",
    onConfirm: () => {},
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "warning" | "error" | "info" = "info",
    onConfirm?: () => void,
  ) => {
    setModalConfig({
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setModalVisible(false)),
    });
    setModalVisible(true);
  };

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      if (activeFarm && isOwner) {
        const { data: requests } = await supabase.rpc("get_deletion_requests", {
          p_group_id: activeFarm.farm_group_id,
        });
        setItemRequests(requests || []);
      } else {
        setItemRequests([]);
      }
    } catch (error) {
      console.error("Error fetching item requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, activeFarm, isOwner]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleApprove = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        "manage_watermelon_deletion_requests",
        {
          p_owner_id: user?.id,
          p_item_ids: [id],
          p_action: "ACCEPT",
        },
      );

      if (error) throw error;
      showAlert(
        "Success",
        "Item deletion approved and item removed.",
        "success",
      );
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        "manage_watermelon_deletion_requests",
        {
          p_owner_id: user?.id,
          p_item_ids: [id],
          p_action: "REJECT",
        },
      );

      if (error) throw error;
      showAlert("Success", "Item deletion request rejected.", "success");
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const renderRequest = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.itemLabel}>{item.label}</Text>
          <Text style={styles.itemVariety}>{item.variety}</Text>
        </View>
        <View style={styles.requestBadge}>
          <Text style={styles.requestBadgeText}>DELETION REQUEST</Text>
        </View>
      </View>

      <View style={styles.requestedBy}>
        <MaterialIcons name="person" size={14} color="#666" />
        <Text style={styles.requestedByText}>
          Requested by: {item.requested_by_name}
        </Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={[styles.button, styles.rejectButton]}
          onPress={() => handleReject(item.item_id)}
        >
          <MaterialIcons name="close" size={20} color="#D90429" />
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.approveButton]}
          onPress={() => handleApprove(item.item_id)}
        >
          <MaterialIcons name="check" size={20} color="#FFFFFF" />
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if ((loading || farmLoading) && !refreshing) {
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
        title="Deletion Requests"
        subtitle={activeFarm?.farm_group_name || "Manage requests"}
        onBack={() => router.back()}
      />
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
        <ModernModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          onConfirm={modalConfig.onConfirm}
        />

        <View style={styles.content}>
          <FlatList
            data={itemRequests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.item_id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#2D6A4F"]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <MaterialIcons
                  name={!activeFarm ? "house" : "check-circle"}
                  size={80}
                  color={!activeFarm ? "#E0E0E0" : "#D8F3DC"}
                />
                <Text style={styles.emptyTitle}>
                  {!activeFarm ? "No Farm Selected" : "All Clear!"}
                </Text>
                <Text style={styles.emptyDesc}>
                  {!activeFarm
                    ? "Please select a farm in Farm Management to manage items."
                    : "No pending item deletion requests at the moment."}
                </Text>
              </View>
            }
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FBF9",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FBF9",
  },
  content: {
    paddingTop: 16,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#2D6A4F",
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowRadius: 2,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  list: {
    padding: 24,
    paddingTop: 8,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B4332",
  },
  itemVariety: {
    fontSize: 14,
    color: "#74C69D",
    fontWeight: "600",
    marginTop: 2,
  },
  requestBadge: {
    backgroundColor: "#FDE2E4",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  requestBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#D90429",
  },
  requestedBy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  requestedByText: {
    fontSize: 13,
    color: "#666",
  },
  cardActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  approveButton: {
    backgroundColor: "#2D6A4F",
  },
  approveButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  rejectButton: {
    backgroundColor: "#FDE2E4",
  },
  rejectButtonText: {
    color: "#D90429",
    fontWeight: "700",
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: "center",
    padding: 40,
    marginTop: 60,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1B4332",
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});
