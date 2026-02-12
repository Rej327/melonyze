import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
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
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function DiscoverFarmsScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allFarms, setAllFarms] = useState<any[]>([]);
  const [filteredFarms, setFilteredFarms] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const insets = useSafeAreaInsets();

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
      const { data, error } = await supabase.rpc("get_discover_farms", {
        p_farmer_id: user.id,
      });

      if (error) throw error;
      setAllFarms(data || []);
      setFilteredFarms(data || []);
    } catch (error) {
      console.error("Error fetching farm data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (search.trim() === "") {
      setFilteredFarms(allFarms);
    } else {
      const filtered = allFarms.filter(
        (f) =>
          f.farm_group_name?.toLowerCase().includes(search.toLowerCase()) ||
          f.farm_group_description
            ?.toLowerCase()
            .includes(search.toLowerCase()),
      );
      setFilteredFarms(filtered);
    }
  }, [search, allFarms]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleJoinFarm = async (groupId: string) => {
    try {
      const { error } = await supabase.rpc("join_farm_group", {
        p_farmer_id: user?.id,
        p_group_id: groupId,
      });
      if (error) throw error;
      showAlert("Success", "Join request sent!", "success");
      await fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    }
  };

  const handleCancelJoin = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from("farm_membership_table")
        .delete()
        .eq("farm_group_id", groupId)
        .eq("farmer_account_id", user?.id)
        .eq("farm_membership_status", "PENDING");

      if (error) throw error;
      showAlert("Success", "Join request cancelled.", "success");
      await fetchData();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
    }
  };

  const handleLeaveFarm = async (groupId: string) => {
    const confirmLeave = async () => {
      setModalVisible(false);
      try {
        // 1. Remove membership
        const { error: memError } = await supabase
          .from("farm_membership_table")
          .delete()
          .eq("farm_group_id", groupId)
          .eq("farmer_account_id", user?.id);

        if (memError) throw memError;

        // 2. If this was the current farm, reset it
        const { data: profile } = await supabase
          .from("farmer_account_table")
          .select("current_farm_group_id")
          .eq("farmer_account_id", user?.id)
          .single();

        if (profile?.current_farm_group_id === groupId) {
          await supabase
            .from("farmer_account_table")
            .update({ current_farm_group_id: null })
            .eq("farmer_account_id", user?.id);
        }

        showAlert("Success", "You have left the farm group.", "success");
        await fetchData();
      } catch (error: any) {
        showAlert("Error", error.message, "error");
      }
    };

    setModalConfig({
      title: "Leave Farm",
      message: "Are you sure you want to leave this farm group?",
      type: "warning",
      onConfirm: confirmLeave,
    });
    setModalVisible(true);
  };

  const renderFarmItem = ({ item }: { item: any }) => {
    const isPending = item.membership_status === "PENDING";
    const isRejected = item.membership_status === "REJECTED";
    const isAccepted = item.membership_status === "ACCEPTED";
    const isOwner = item.farm_owner_id === user?.id;

    return (
      <View style={styles.farmItem}>
        <View style={styles.farmMain}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={styles.farmName}>{item.farm_group_name} </Text>
            {isOwner && (
              <View style={styles.ownerSmallBadge}>
                <Text style={styles.ownerSmallBadgeText}>OWNER</Text>
              </View>
            )}
          </View>
          <Text style={styles.farmOwner}>
            Owner: {item.owner_first_name} {item.owner_last_name}
          </Text>
          {item.farm_group_description ? (
            <Text style={styles.farmDesc} numberOfLines={2}>
              {item.farm_group_description}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionContainer}>
          {isOwner ? (
            <View style={styles.joinedBadge}>
              <MaterialIcons name="stars" size={24} color="#2D6A4F" />
              <Text style={styles.joinedText}>My Farm</Text>
            </View>
          ) : isAccepted ? (
            <View style={styles.pendingContainer}>
              <View style={styles.joinedBadge}>
                <MaterialIcons name="check-circle" size={24} color="#2D6A4F" />
                <Text style={styles.joinedText}>Joined</Text>
              </View>
              <TouchableOpacity
                style={styles.leaveBtn}
                onPress={() => handleLeaveFarm(item.farm_group_id)}
              >
                <Text style={styles.leaveBtnText}>Leave</Text>
              </TouchableOpacity>
            </View>
          ) : isPending ? (
            <View style={styles.pendingContainer}>
              <View style={styles.pendingBadge}>
                <MaterialIcons
                  name="hourglass-empty"
                  size={20}
                  color="#F59E0B"
                />
                <Text style={styles.pendingText}>Pending</Text>
              </View>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => handleCancelJoin(item.farm_group_id)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : isRejected ? (
            <View style={styles.rejectedBadge}>
              <MaterialIcons name="error-outline" size={20} color="#D90429" />
              <Text style={styles.rejectedText}>Rejected</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.joinBtn}
              onPress={() => handleJoinFarm(item.farm_group_id)}
            >
              <Text style={styles.joinBtnText}>Join</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading && !refreshing) {
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
        title="Discover Farms"
        subtitle="Find groups to join"
        onBack={() => router.back()}
      />
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <MaterialIcons name="search" size={20} color="#6C757D" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or description..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor="#A0A0A0"
            />
          </View>
        </View>

        <FlatList
          data={filteredFarms}
          renderItem={renderFarmItem}
          extraData={[search]}
          keyExtractor={(item) => item.farm_group_id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#2D6A4F"]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="search-off" size={64} color="#D8F3DC" />
              <Text style={styles.emptyText}>No farms found.</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#2D6A4F",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#D8F3DC",
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#1B4332",
  },
  listContent: {
    padding: 24,
    paddingTop: 0,
  },
  farmItem: {
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 24,
    marginBottom: 16,
    elevation: 2,
    shadowColor: "#2D6A4F",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  farmMain: { flex: 1, marginRight: 16 },
  farmName: { fontSize: 18, fontWeight: "700", color: "#1B4332" },
  farmOwner: { fontSize: 12, color: "#74C69D", marginTop: 2 },
  farmDesc: { fontSize: 13, color: "#6C757D", marginTop: 8, lineHeight: 18 },
  actionContainer: { alignItems: "center", minWidth: 80 },
  joinBtn: {
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  joinBtnText: { color: "#FFF", fontWeight: "700", fontSize: 14 },
  joinedBadge: { alignItems: "center", gap: 4 },
  joinedText: { fontSize: 12, fontWeight: "700", color: "#2D6A4F" },
  pendingBadge: { alignItems: "center", gap: 4 },
  pendingText: { fontSize: 12, fontWeight: "700", color: "#F59E0B" },
  rejectedBadge: { alignItems: "center", gap: 4 },
  rejectedText: { fontSize: 12, fontWeight: "700", color: "#D90429" },
  pendingContainer: { alignItems: "center" },
  cancelBtn: {
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#D90429",
    marginTop: 8,
  },
  cancelBtnText: { color: "#D90429", fontWeight: "700", fontSize: 12 },
  leaveBtn: {
    backgroundColor: "transparent",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FDE2E4",
    marginTop: 8,
  },
  leaveBtnText: { color: "#D90429", fontWeight: "600", fontSize: 12 },
  ownerSmallBadge: {
    backgroundColor: "#D8F3DC",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  ownerSmallBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#2D6A4F",
  },
  emptyContainer: {
    alignItems: "center",
    marginTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: "#6C757D",
    marginTop: 16,
    fontWeight: "600",
  },
});
