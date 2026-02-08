import { ModernHeader } from "@/components/ui/modern-header";
import { ModernModal } from "@/components/ui/modern-modal";
import { useAuth } from "@/context/auth";
import { useFarm } from "@/context/farm";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const {
    activeFarm,
    isOwner,
    myFarms,
    loading: farmLoading,
    refreshFarms,
  } = useFarm();
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
  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(null);

  // Generic Alert Modal State
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    type: "success" | "warning" | "error" | "info";
    onConfirm?: () => void;
  }>({
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "warning" | "error" | "info" = "info",
    onConfirm?: () => void,
  ) => {
    setAlertConfig({ title, message, type, onConfirm });
    setAlertModalVisible(true);
  };

  const router = useRouter();

  // Check if any filters are active
  const hasActiveFilters =
    brixFilter !== "ALL" ||
    minBrix !== "" ||
    maxBrix !== "" ||
    fromDate !== "" ||
    toDate !== "";

  const clearAllFilters = () => {
    setBrixFilter("ALL");
    setMinBrix("");
    setMaxBrix("");
    setFromDate("");
    setToDate("");
  };

  useEffect(() => {
    if (activeFarm && !selectedFarmId) {
      setSelectedFarmId(activeFarm.farm_group_id);
    }
  }, [activeFarm, selectedFarmId]);

  const handleFarmSelect = useCallback(
    async (farmId: string) => {
      setSelectedFarmId(farmId);
      try {
        const { error } = await supabase.rpc("set_default_farm", {
          p_farmer_id: user?.id,
          p_group_id: farmId,
        });

        if (error) {
          console.error("Error setting default farm:", error.message);
          return;
        }

        // Refresh the global context so other screens see the change
        await refreshFarms();
      } catch (err) {
        console.error("Unexpected error switching farm:", err);
      }
    },
    [user, refreshFarms],
  );

  const fetchInventory = useCallback(async () => {
    if (!user || farmLoading) return;

    try {
      const activeId = selectedFarmId || activeFarm?.farm_group_id;

      if (!activeId) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Fetch inventory for selected farm
      const { data, error } = await supabase.rpc("get_group_inventory", {
        p_group_id: activeId,
      });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, selectedFarmId, activeFarm, farmLoading]);

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
    refreshFarms();
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
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [selectedIds, user, fetchInventory]);

  const recordBulkSale = useCallback(async () => {
    if (!saleAmount || isNaN(Number(saleAmount))) {
      showAlert(
        "Invalid Amount",
        "Please enter a valid sale amount.",
        "warning",
      );
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
      showAlert("Error", error.message, "error");
    } finally {
      setLoading(false);
    }
  }, [saleAmount, user, selectedFarmId, selectedIds, fetchInventory]);

  const handleBulkSold = useCallback(() => {
    if (!isOwner) {
      showAlert(
        "Permission Denied",
        "Only the farm owner can mark items as sold.",
        "warning",
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
        showAlert(
          "Request Sent",
          "Deletion request has been sent to the farm owner.",
          "success",
        );
      }
      setSelectedIds([]);
      setIsSelectionMode(false);
      fetchInventory();
    } catch (error: any) {
      showAlert("Error", error.message, "error");
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
                <MaterialIcons name="bubble-chart" size={14} color="#495057" />
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

  if ((loading || farmLoading) && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: "#F8FBF9" }]}>
        <ActivityIndicator size="large" color="#2D6A4F" />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#F8FBF9",
      }}
    >
      <View style={[styles.container, { backgroundColor: "#F8FBF9" }]}>
        <ModernHeader
          title="Watermelon Harvest"
          subtitle={
            loading || farmLoading
              ? "Loading your harvest..."
              : selectedFarmId
                ? `Managing ${myFarms.find((f) => f.farm_group_id === selectedFarmId)?.farm_group_name || "Active Farm"}`
                : "Join a farm to start tracking"
          }
          rightActions={
            selectedFarmId ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.headerActionButton,
                    isSelectionMode && {
                      backgroundColor: "rgba(255, 255, 255, 0.81)",
                    },
                  ]}
                  onPress={handleSelectAll}
                >
                  <MaterialIcons
                    name={
                      isSelectionMode &&
                      filteredItems.every((i) =>
                        selectedIds.includes(i.item_id),
                      )
                        ? "deselect"
                        : "select-all"
                    }
                    size={24}
                    color={isSelectionMode ? "#2D6A4F" : "#FFFFFF"}
                  />
                </TouchableOpacity>
                {isSelectionMode && selectedIds.length > 0 ? (
                  <TouchableOpacity
                    style={[
                      styles.headerActionButton,
                      {
                        backgroundColor: "rgba(255, 255, 255, 0.81)",
                      },
                    ]}
                    onPress={() => {
                      setIsSelectionMode(false);
                      setSelectedIds([]);
                    }}
                  >
                    <MaterialIcons name="close" size={24} color="#D90429" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={styles.headerActionButton}
                    onPress={() => setShowFilters(!showFilters)}
                  >
                    <MaterialIcons
                      name={showFilters ? "filter-list-off" : "filter-list"}
                      size={24}
                      color="#FFFFFF"
                    />
                  </TouchableOpacity>
                )}
              </>
            ) : null
          }
        />

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
                  onPress={() => handleFarmSelect(farm.farm_group_id)}
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

        {isSelectionMode && selectedIds.length > 0 && (
          <View style={styles.bulkToolbar}>
            <TouchableOpacity
              style={styles.bulkAction}
              onPress={handleSelectAll}
            >
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

        {selectedFarmId && (
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
            {hasActiveFilters && (
              <TouchableOpacity
                style={styles.clearFiltersButton}
                onPress={clearAllFilters}
              >
                <MaterialIcons
                  name="filter-list-off"
                  size={20}
                  color="#D90429"
                />
                <Text style={styles.clearFiltersText}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

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

        <ModernModal
          visible={alertModalVisible}
          onClose={() => setAlertModalVisible(false)}
          title={alertConfig.title}
          message={alertConfig.message}
          type={alertConfig.type}
          onConfirm={alertConfig.onConfirm}
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
            search || hasActiveFilters ? (
              <View style={styles.emptyContainer}>
                <MaterialIcons
                  name="search-off"
                  size={64}
                  color="#E0E0E0"
                  style={{ marginBottom: 16 }}
                />
                <Text style={styles.emptyText}>No matching watermelons</Text>
                <Text style={styles.emptySubText}>
                  Try adjusting your search or filters to find what you&apos;re
                  looking for.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    setSearch("");
                    clearAllFilters();
                  }}
                >
                  <Text style={styles.emptyButtonText}>Clear All Filters</Text>
                </TouchableOpacity>
              </View>
            ) : myFarms.length === 0 ? (
              <View style={styles.noGroupContainer}>
                <View style={styles.noGroupIconWrapper}>
                  <MaterialIcons name="groups" size={64} color="#2D6A4F" />
                </View>
                <Text style={styles.noGroupTitle}>No Farm Group Yet</Text>
                <Text style={styles.noGroupMessage}>
                  You need to be part of a farm group to manage inventory. Join
                  one or create your own!
                </Text>
                <View style={styles.noGroupActions}>
                  <TouchableOpacity
                    style={styles.primaryNoGroupButton}
                    onPress={() =>
                      router.push("/management/discover-farms" as any)
                    }
                  >
                    <MaterialIcons name="search" size={20} color="#FFFFFF" />
                    <Text style={styles.noGroupButtonText}>Join Group</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.secondaryNoGroupButton}
                    onPress={() => router.push("/management/farm-group" as any)}
                  >
                    <MaterialIcons name="add" size={20} color="#2D6A4F" />
                    <Text style={styles.noGroupButtonTextSecondary}>
                      Create New
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <MaterialIcons
                  name="inventory"
                  size={64}
                  color="#E0E0E0"
                  style={{ marginBottom: 16 }}
                />
                <Text style={styles.emptyText}>Your inventory is empty</Text>
                <Text style={styles.emptySubText}>
                  Start by analyzing the watermelon.
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push("/analysis" as any)}
                >
                  <Text style={styles.emptyButtonText}>Analyze Watermelon</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    // paddingTop: 12,
    paddingHorizontal: 24,
    paddingBottom: 20,
    backgroundColor: "#2D6A4F",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerActions: { flexDirection: "row", gap: 8, marginTop: 16 },
  title: { fontSize: 24, fontWeight: "800", color: "#FFFFFF" },
  subtitle: { fontSize: 13, color: "#D8F3DC", marginTop: 2, opacity: 0.9 },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  filterToggle: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.81)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  actionToggle: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  farmSelector: { paddingTop: 12, paddingHorizontal: 20 },
  farmChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#E8F5E9",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#C8E6C9",
  },
  farmChipActive: { backgroundColor: "#2D6A4F", borderColor: "#2D6A4F" },
  farmChipText: { fontSize: 13, fontWeight: "600", color: "#2D6A4F" },
  farmChipTextActive: { color: "#FFFFFF" },
  searchContainer: {
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: "#1B4332" },
  clearFiltersButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FDE2E4",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    height: 48,
  },
  clearFiltersText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#D90429",
  },
  listContent: { paddingHorizontal: 24, paddingBottom: 100 },
  itemCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    marginBottom: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  itemCardSelected: { borderColor: "#2D6A4F", borderWidth: 2 },
  imageWrapper: { width: 100, height: 100, position: "relative" },
  itemImage: { width: "100%", height: "100%" },
  selectionOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 12,
    padding: 2,
  },
  itemInfo: { flex: 1, padding: 12, justifyContent: "space-between" },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#495057",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "800" },
  itemVariety: {
    fontSize: 12,
    color: "#495057",
    fontWeight: "600",
    marginTop: -2,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  statsRow: { flexDirection: "row", gap: 12 },
  miniStat: { flexDirection: "row", alignItems: "center", gap: 4 },
  miniStatText: { fontSize: 12, color: "#495057", fontWeight: "600" },
  pendingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF0F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pendingText: { fontSize: 9, fontWeight: "800", color: "#D90429" },
  bulkToolbar: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 24,
    marginVertical: 12,
    padding: 12,
    borderRadius: 16,
    justifyContent: "space-around",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  bulkAction: { alignItems: "center", gap: 4 },
  bulkActionText: { fontSize: 10, fontWeight: "800", color: "#2D6A4F" },
  filterTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1B4332",
    marginBottom: 12,
    marginTop: 16,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F0F0F0",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  filterChipActive: { backgroundColor: "#2D6A4F", borderColor: "#2D6A4F" },
  filterChipText: { fontSize: 12, fontWeight: "600", color: "#495057" },
  filterChipTextActive: { color: "#FFFFFF" },
  rangeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rangeInput: {
    flex: 1,
    height: 44,
    backgroundColor: "#F8F8F8",
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    color: "#1B4332",
  },
  rangeSep: { fontSize: 14, color: "#999" },
  modalSubTitle: { fontSize: 14, color: "#666", marginBottom: 16 },
  modalInfoText: {
    fontSize: 12,
    color: "#999",
    marginTop: 8,
    fontStyle: "italic",
  },
  emptyContainer: { alignItems: "center", marginTop: 60, padding: 24 },
  emptyText: { fontSize: 16, color: "#999", fontWeight: "600" },
  emptyButton: {
    marginTop: 16,
    backgroundColor: "#2D6A4F",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  headerActionButton: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  emptySubText: {
    fontSize: 14,
    color: "#A0A0A0",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 8,
  },
  noGroupContainer: {
    alignItems: "center",
    marginTop: 60,
    padding: 32,
    backgroundColor: "#FFFFFF",
    borderRadius: 32,
    marginHorizontal: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
  },
  noGroupIconWrapper: {
    width: 120,
    height: 120,
    backgroundColor: "#F0FDF4",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  noGroupTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B4332",
    marginBottom: 8,
  },
  noGroupMessage: {
    fontSize: 15,
    color: "#52796F",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  noGroupActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  primaryNoGroupButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#2D6A4F",
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  secondaryNoGroupButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#2D6A4F",
  },
  noGroupButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  noGroupButtonTextSecondary: {
    color: "#2D6A4F",
    fontWeight: "700",
    fontSize: 14,
  },
});
