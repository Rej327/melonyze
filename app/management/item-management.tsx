import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import { SafeAreaView } from "react-native-safe-area-context";

export default function ItemManagementScreen() {
  const { user } = useAuth();
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
      // 1. Get profile to check current_farm_group_id
      const { data: profileData } = await supabase
        .from("farmer_account_table")
        .select("*, farm_group_table(*)")
        .eq("farmer_account_id", user.id)
        .single();

      if (profileData?.current_farm_group_id) {
        // Only fetch if they are the owner of the current farm
        const { data: farmData } = await supabase
          .from("farm_group_table")
          .select("farm_owner_id")
          .eq("farm_group_id", profileData.current_farm_group_id)
          .single();

        if (farmData?.farm_owner_id === user.id) {
          const { data: requests } = await supabase.rpc(
            "get_deletion_requests",
            {
              p_group_id: profileData.current_farm_group_id,
            },
          );
          setItemRequests(requests || []);
        } else {
          setItemRequests([]);
        }
      } else {
        setItemRequests([]);
      }
    } catch (error) {
      console.error("Error fetching item requests:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleManageItemDeletion = async (
    p_item_ids: string[],
    action: string,
  ) => {
    setLoading(true);
    try {
      const { error } = await supabase.rpc(
        "manage_watermelon_deletion_requests",
        {
          p_owner_id: user?.id,
          p_item_ids,
          p_action: action,
        },
      );
      if (error) throw error;
      showAlert(
        "Success",
        `Request ${action === "ACCEPT" ? "approved" : "rejected"} successfully!`,
        "success",
      );
      fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const renderRequestItem = ({ item }: { item: any }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestMain}>
        <Text style={styles.itemLabel}>{item.label}</Text>
        <Text style={styles.itemVariety}>{item.variety}</Text>
        <View style={styles.requestedBy}>
          <MaterialIcons name="person" size={14} color="#6C757D" />
          <Text style={styles.requestedByText}>
            Requested by: {item.requested_by_name}
          </Text>
        </View>
        <Text style={styles.requestDate}>
          {new Date(item.requested_at).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.acceptBtn]}
          onPress={() => handleManageItemDeletion([item.item_id], "ACCEPT")}
        >
          <MaterialIcons name="check" size={24} color="#FFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.rejectBtn]}
          onPress={() => handleManageItemDeletion([item.item_id], "REJECT")}
        >
          <MaterialIcons name="close" size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#2D6A4F" }}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="#2D6A4F" />
          </TouchableOpacity>
          <Text style={styles.title}>Item Management</Text>
        </View>

        <FlatList
          data={itemRequests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.item_id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2D6A4F"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="check-circle" size={80} color="#D8F3DC" />
              <Text style={styles.emptyTitle}>No Pending Requests</Text>
              <Text style={styles.emptyDesc}>
                All deletion requests have been handled.
              </Text>
            </View>
          }
        />

        <ModernModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          title={modalConfig.title}
          message={modalConfig.message}
          type={modalConfig.type}
          confirmText="OK"
          onConfirm={modalConfig.onConfirm}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FBF9" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1B4332" },
  listContent: { padding: 24 },
  requestCard: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  requestMain: { flex: 1, marginRight: 16 },
  itemLabel: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
  itemVariety: {
    fontSize: 13,
    color: "#74C69D",
    marginTop: 2,
    fontWeight: "600",
  },
  requestedBy: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  requestedByText: { fontSize: 12, color: "#6C757D" },
  requestDate: { fontSize: 11, color: "#A0A0A0", marginTop: 4 },
  actionButtons: { flexDirection: "row", gap: 12 },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptBtn: { backgroundColor: "#2D6A4F" },
  rejectBtn: { backgroundColor: "#D90429" },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B4332",
    marginTop: 20,
  },
  emptyDesc: {
    fontSize: 14,
    color: "#6C757D",
    textAlign: "center",
    marginTop: 8,
  },
});
