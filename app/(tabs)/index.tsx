import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface WatermelonItem {
  item_id: string;
  label: string;
  variety: string;
  status: "READY" | "NOT_READY" | "SOLD";
  last_frequency: number;
  last_amplitude: number;
  last_sweetness: number;
  image_url: string;
  created_at: string;
  is_deletion_pending: boolean;
}

export default function InventoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatermelonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [brixFilter, setBrixFilter] = useState<
    "ALL" | "READY" | "NOT_READY" | "SOLD"
  >("ALL");
  const [minBrix, setMinBrix] = useState("");
  const [maxBrix, setMaxBrix] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [isSaleModalVisible, setIsSaleModalVisible] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [saleAmount, setSaleAmount] = useState("");

  const [showFilters, setShowFilters] = useState(false);
  const [myFarms, setMyFarms] = useState<any[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);
  const router = useRouter();
  const isDark = false;

  const isOwner = React.useMemo(() => {
    if (!user || !myFarms || !selectedFarmId) return false;
    const activeFarm = myFarms.find((f) => f.farm_group_id === selectedFarmId);
    return activeFarm?.farm_owner_id === user.id;
  }, [myFarms, selectedFarmId, user]);

  const fetchInventory = useCallback(async () => {
    if (!user) return;

    try {
      // 1. Get user's farms and profile
      const [profileRes, membershipsRes] = await Promise.all([
        supabase
          .from("farmer_account_table")
          .select("current_farm_group_id")
          .eq("farmer_account_id", user.id)
          .single(),
        supabase
          .from("farm_membership_table")
          .select("*, farm_group_table(*)")
          .eq("farmer_account_id", user.id)
          .eq("farm_membership_status", "ACCEPTED"),
      ]);

      const profile = profileRes.data;
      const farms = membershipsRes.data?.map((m) => m.farm_group_table) || [];
      setMyFarms(farms);

      const activeFarmId = selectedFarmId || profile?.current_farm_group_id;
      if (activeFarmId && !selectedFarmId) {
        setSelectedFarmId(activeFarmId);
      }

      if (!activeFarmId) {
        setItems([]);
        return;
      }

      // 2. Fetch inventory for selected farm
      const { data, error } = await supabase.rpc("get_group_inventory", {
        p_group_id: activeFarmId,
      });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedFarmId]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  const filteredItems = React.useMemo(() => {
    if (!items) return [];
    let filtered = items.filter(
      (item) =>
        item.label?.toLowerCase().includes((search || "").toLowerCase()) ||
        item.variety?.toLowerCase().includes((search || "").toLowerCase()),
    );

    if (brixFilter === "READY") {
      filtered = filtered.filter((item) => item.status === "READY");
    } else if (brixFilter === "NOT_READY") {
      filtered = filtered.filter((item) => item.status === "NOT_READY");
    } else if (brixFilter === "SOLD") {
      filtered = filtered.filter((item) => item.status === "SOLD");
    }

    if (minBrix) {
      filtered = filtered.filter(
        (item) => (item.last_sweetness || 0) >= parseFloat(minBrix),
      );
    }
    if (maxBrix) {
      filtered = filtered.filter(
        (item) => (item.last_sweetness || 0) <= parseFloat(maxBrix),
      );
    }

    if (fromDate) {
      const from = new Date(fromDate);
      filtered = filtered.filter((item) => new Date(item.created_at) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((item) => new Date(item.created_at) <= to);
    }

    return filtered;
  }, [search, items, brixFilter, minBrix, maxBrix, fromDate, toDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const toggleSelection = useCallback(
    (id: string) => {
      setSelectedIds((prev) => {
        const next = prev.includes(id)
          ? prev.filter((i) => i !== id)
          : [...prev, id];
        if (next.length === 0) setIsSelectionMode(false);
        return next;
      });
    },
    [setIsSelectionMode],
  );

  const handleSelectAll = useCallback(() => {
    const allIds = filteredItems.map((i) => i.item_id);
    const areAllSelected =
      allIds.length > 0 && allIds.every((id) => selectedIds.includes(id));

    if (areAllSelected) {
      setSelectedIds([]);
      setIsSelectionMode(false);
    } else {
      setSelectedIds(allIds);
      setIsSelectionMode(true);
    }
  }, [filteredItems, selectedIds]);

  const handleBulkHarvest = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("bulk_update_watermelon_status", {
        p_executing_user_id: user?.id,
        p_item_ids: selectedIds,
        p_status: "READY",
      });
      if (error) throw error;
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchInventory();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedIds, user, fetchInventory]);

  const recordBulkSale = useCallback(async () => {
    if (!saleAmount || isNaN(Number(saleAmount))) {
      Alert.alert("Invalid Amount", "Please enter a valid sale amount.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.rpc("record_watermelon_sale", {
        p_executing_user_id: user?.id,
        p_farm_group_id: selectedFarmId,
        p_item_ids: selectedIds,
        p_total_amount: Number(saleAmount),
      });

      if (error) throw error;

      setIsSaleModalVisible(false);
      setSaleAmount("");
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchInventory();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [saleAmount, user, selectedFarmId, selectedIds, fetchInventory]);

  const handleBulkSold = useCallback(() => {
    if (!isOwner) {
      Alert.alert(
        "Permission Denied",
        "Only the farm owner can mark items as sold.",
      );
      return;
    }

    setSaleAmount("");
    setIsSaleModalVisible(true);
  }, [isOwner]);

  const handleBulkDelete = useCallback(() => {
    setIsDeleteModalVisible(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    setIsDeleteModalVisible(false);
    setLoading(true);
    try {
      if (isOwner) {
        const { error } = await supabase.rpc("bulk_delete_watermelons", {
          p_executing_user_id: user?.id,
          p_item_ids: selectedIds,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc(
          "request_bulk_delete_watermelons",
          {
            p_farmer_id: user?.id,
            p_item_ids: selectedIds,
          },
        );
        if (error) throw error;
        Alert.alert(
          "Request Sent",
          "Deletion request has been sent to the farm owner.",
        );
      }
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchInventory();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  }, [isOwner, user, selectedIds, fetchInventory]);

  const renderItem = useCallback(
    ({ item }: { item: WatermelonItem }) => (
      <TouchableOpacity
        key={`${item.item_id}-${isSelectionMode}`}
        style={[
          styles.itemCard,
          selectedIds.includes(item.item_id) && styles.itemCardSelected,
        ]}
        onPress={() => {
          if (isSelectionMode) {
            toggleSelection(item.item_id);
          } else {
            router.push(`/details/${item.item_id}` as any);
          }
        }}
        onLongPress={() => {
          setIsSelectionMode(true);
          toggleSelection(item.item_id);
        }}
      >
        <View style={styles.imageWrapper}>
          <Image
            source={{
              uri:
                item.image_url || "https://placehold.co/400x400?text=No+Image",
            }}
            style={styles.itemImage}
            contentFit="cover"
          />
          {item.status === "SOLD" && !isSelectionMode && (
            <View
              style={[
                styles.selectionOverlay,
                { backgroundColor: "rgba(255,255,255,0.7)" },
              ]}
            >
              <MaterialIcons name="check-circle" size={20} color="#D90429" />
            </View>
          )}
          {isSelectionMode && (
            <View style={styles.selectionOverlay}>
              <MaterialIcons
                name={
                  selectedIds.includes(item.item_id)
                    ? "check-circle"
                    : "radio-button-unchecked"
                }
                size={20}
                color={
                  selectedIds.includes(item.item_id) ? "#2D6A4F" : "#A0A0A0"
                }
              />
            </View>
          )}
        </View>
        <View style={styles.itemInfo}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemLabel} numberOfLines={1}>
              {item.label}
            </Text>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    item.status === "READY"
                      ? "#D8F3DC"
                      : item.status === "SOLD"
                        ? "#FDE2E4"
                        : "#FFF4E6",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      item.status === "READY"
                        ? "#2D6A4F"
                        : item.status === "SOLD"
                          ? "#D90429"
                          : "#D9480F",
                  },
                ]}
              >
                {item.status === "READY"
                  ? "RIPE"
                  : item.status === "SOLD"
                    ? "SOLD"
                    : "UNRIPE"}
              </Text>
            </View>
          </View>

          <Text style={styles.itemVariety}>{item.variety}</Text>

          <View style={styles.cardFooter}>
            <View style={styles.statsRow}>
              <View style={styles.miniStat}>
                <MaterialIcons name="bubble-chart" size={14} color="#74C69D" />
                <Text style={styles.miniStatText}>
                  {item.last_sweetness || "--"}°Bx
                </Text>
              </View>
              <View style={styles.miniStat}>
                <MaterialIcons name="event" size={14} color="#999" />
                <Text style={styles.miniStatText}>
                  {new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
            </View>

            {item.is_deletion_pending && (
              <View style={styles.pendingBadge}>
                <MaterialIcons
                  name="hourglass-empty"
                  size={10}
                  color="#D90429"
                />
                <Text style={styles.pendingText}>DEL. PENDING</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    ),
    [isSelectionMode, selectedIds, router, toggleSelection],
  );

  if (loading && !refreshing) {
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

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#121212" : "#F8FBF9" },
      ]}
    >
      <View style={styles.header}>
        <Text style={styles.title}>
          {isSelectionMode && selectedIds.length > 0
            ? `${selectedIds.length} Selected`
            : "Inventory"}
        </Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.filterToggle,
              isSelectionMode && { backgroundColor: "#D8F3DC" },
            ]}
            onPress={handleSelectAll}
          >
            <MaterialIcons
              name={
                isSelectionMode &&
                filteredItems.every((i) => selectedIds.includes(i.item_id))
                  ? "deselect"
                  : "select-all"
              }
              size={24}
              color="#2D6A4F"
            />
          </TouchableOpacity>
          {isSelectionMode && selectedIds.length > 0 ? (
            <TouchableOpacity
              style={styles.actionToggle}
              onPress={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
            >
              <MaterialIcons name="close" size={24} color="#D90429" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.filterToggle}
              onPress={() => setShowFilters(!showFilters)}
            >
              <MaterialIcons name="filter-list" size={24} color="#2D6A4F" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {/* Farm Selector Strip */}
      {myFarms.length > 0 && (
        <View style={styles.farmSelector}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {myFarms.map((farm) => (
              <TouchableOpacity
                key={farm.farm_group_id}
                style={[
                  styles.farmChip,
                  selectedFarmId === farm.farm_group_id &&
                    styles.farmChipActive,
                ]}
                onPress={() => setSelectedFarmId(farm.farm_group_id)}
              >
                <Text
                  style={[
                    styles.farmChipText,
                    selectedFarmId === farm.farm_group_id &&
                      styles.farmChipTextActive,
                  ]}
                >
                  {farm.farm_group_name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Stats Quick View */}

      {isSelectionMode && selectedIds.length > 0 && (
        <View style={styles.bulkToolbar}>
          <TouchableOpacity style={styles.bulkAction} onPress={handleSelectAll}>
            <MaterialIcons
              name={
                filteredItems.every((i) => selectedIds.includes(i.item_id))
                  ? "deselect"
                  : "select-all"
              }
              size={24}
              color="#2D6A4F"
            />
            <Text style={styles.bulkActionText}>
              {filteredItems.every((i) => selectedIds.includes(i.item_id))
                ? "DESELECT"
                : "SELECT ALL"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.bulkAction}
            onPress={handleBulkHarvest}
          >
            <MaterialIcons name="done-all" size={24} color="#2D6A4F" />
            <Text style={styles.bulkActionText}>RIPE</Text>
          </TouchableOpacity>
          {isOwner && (
            <TouchableOpacity
              style={styles.bulkAction}
              onPress={handleBulkSold}
            >
              <MaterialIcons name="shopping-cart" size={24} color="#2D6A4F" />
              <Text style={styles.bulkActionText}>SOLD</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.bulkAction}
            onPress={handleBulkDelete}
          >
            <MaterialIcons name="delete" size={24} color="#D90429" />
            <Text style={styles.bulkActionText}>DEL</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialIcons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search label, variety..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ModernModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        title="Filter Inventory"
        type="info"
        confirmText="Apply Filters"
        onConfirm={() => setShowFilters(false)}
      >
        <View style={{ width: "100%", marginBottom: 24 }}>
          <Text style={styles.filterTitle}>Brix Analysis</Text>
          <View style={styles.filterRow}>
            {["ALL", "READY", "NOT_READY", "SOLD"].map((f: any) => (
              <TouchableOpacity
                key={f}
                style={[
                  styles.filterChip,
                  brixFilter === f && styles.filterChipActive,
                ]}
                onPress={() => setBrixFilter(f)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    brixFilter === f && styles.filterChipTextActive,
                  ]}
                >
                  {f === "READY"
                    ? "Ripe"
                    : f === "NOT_READY"
                      ? "Unripe"
                      : f === "SOLD"
                        ? "Sold"
                        : "All"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.filterTitle}>Brix Range</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              placeholder="Min"
              keyboardType="numeric"
              value={minBrix}
              onChangeText={setMinBrix}
              placeholderTextColor="#A0A0A0"
            />
            <Text style={styles.rangeSep}>to</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder="Max"
              keyboardType="numeric"
              value={maxBrix}
              onChangeText={setMaxBrix}
              placeholderTextColor="#A0A0A0"
            />
          </View>

          <Text style={styles.filterTitle}>Scan Date Range</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              placeholder="From (YYYY-MM-DD)"
              value={fromDate}
              onChangeText={setFromDate}
              placeholderTextColor="#A0A0A0"
            />
            <Text style={styles.rangeSep}>to</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder="To (YYYY-MM-DD)"
              value={toDate}
              onChangeText={setToDate}
              placeholderTextColor="#A0A0A0"
            />
          </View>
        </View>
      </ModernModal>

      <ModernModal
        visible={isSaleModalVisible}
        onClose={() => setIsSaleModalVisible(false)}
        title="Record Sale"
        type="info"
        confirmText="Confirm Sale"
        onConfirm={recordBulkSale}
      >
        <View style={{ width: "100%" }}>
          <Text style={styles.modalSubTitle}>
            Recording sale for {selectedIds.length} item(s).
          </Text>
          <Text style={styles.filterTitle}>Total Sale Amount (₱)</Text>
          <TextInput
            style={[
              styles.rangeInput,
              { width: "100%", height: 52, fontSize: 18, fontWeight: "700" },
            ]}
            placeholder="e.g. 6000"
            keyboardType="numeric"
            value={saleAmount}
            onChangeText={setSaleAmount}
            placeholderTextColor="#A0A0A0"
            autoFocus
          />
          <Text style={styles.modalInfoText}>
            Items will be marked as SOLD and revenue will be tracked.
          </Text>
        </View>
      </ModernModal>

      <ModernModal
        visible={isDeleteModalVisible}
        onClose={() => setIsDeleteModalVisible(false)}
        title={isOwner ? "Confirm Delete" : "Request Deletion"}
        message={
          isOwner
            ? `Are you sure you want to delete ${selectedIds.length} selected items? This action cannot be undone.`
            : `You are not the owner. Requesting deletion for ${selectedIds.length} items will notify the owner for approval.`
        }
        type={isOwner ? "error" : "info"}
        confirmText={isOwner ? "Delete Items" : "Send Request"}
        onConfirm={confirmDelete}
      />

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        extraData={[isSelectionMode, selectedIds.length]}
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
            <Text style={styles.emptyText}>No watermelons found</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push("/management/add-edit" as any)}
            >
              <Text style={styles.emptyButtonText}>Add Your First Item</Text>
            </TouchableOpacity>
          </View>
        }
      />
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
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1B4332",
  },
  filterToggle: {
    width: 44,
    height: 44,
    backgroundColor: "#F0F0F0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActions: { flexDirection: "row", gap: 8 },
  actionToggle: {
    width: 44,
    height: 44,
    backgroundColor: "#FFD7D7",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  bulkToolbar: {
    flexDirection: "row",
    backgroundColor: "#FFF",
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 12,
    borderRadius: 16,
    justifyContent: "space-around",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  bulkAction: { alignItems: "center", gap: 4 },
  bulkActionText: { fontSize: 10, fontWeight: "800", color: "#495057" },
  imageWrapper: {
    width: 110,
    height: "100%",
    position: "relative",
    backgroundColor: "#F8FBF9",
  },
  selectionOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius: 12,
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  itemCardSelected: { borderColor: "#2D6A4F", borderWidth: 2 },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: "#000",
  },
  filterTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#6C757D",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "transparent",
  },
  filterChipActive: {
    backgroundColor: "#D8F3DC",
    borderColor: "#2D6A4F",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6C757D",
  },
  filterChipTextActive: {
    color: "#2D6A4F",
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rangeInput: {
    flex: 1,
    height: 52,
    backgroundColor: "#F8FBF9",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  rangeSep: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  itemCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    height: 120, // Strict height for perfect layout stability
  },
  modalSubTitle: {
    fontSize: 14,
    color: "#495057",
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInfoText: {
    fontSize: 12,
    color: "#6C757D",
    marginTop: 8,
    fontStyle: "italic",
  },

  itemImage: {
    width: "100%",
    height: "100%",
  },
  itemInfo: {
    flex: 1,
    padding: 12,
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B4332",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  itemVariety: {
    fontSize: 14,
    color: "#52B788",
    fontWeight: "600",
    marginTop: 2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  miniStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  miniStatText: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "500",
  },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: "#FFF0F3",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pendingText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#D90429",
  },
  emptyContainer: {
    marginTop: 100,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#6C757D",
    marginBottom: 16,
  },
  loaderText: { marginTop: 12, color: "#6C757D" },
  farmSelector: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#F8FBF9",
  },
  farmChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  farmChipActive: {
    backgroundColor: "#2D6A4F",
    borderColor: "#2D6A4F",
  },
  farmChipText: {
    color: "#6C757D",
    fontSize: 13,
    fontWeight: "600",
  },
  farmChipTextActive: {
    color: "#FFF",
  },
  emptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#D8F3DC",
    borderRadius: 12,
  },
  emptyButtonText: {
    color: "#2D6A4F",
    fontWeight: "700",
  },
});
