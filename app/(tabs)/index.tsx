import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
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

interface WatermelonItem {
  item_id: string;
  label: string;
  variety: string;
  status: "READY" | "NOT_READY";
  last_frequency: number;
  last_amplitude: number;
  last_sweetness: number;
  image_url: string;
  created_at: string;
}

export default function InventoryScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<WatermelonItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<WatermelonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [brixFilter, setBrixFilter] = useState<"ALL" | "READ" | "NOT_READY">(
    "ALL",
  );
  const [minBrix, setMinBrix] = useState("");
  const [maxBrix, setMaxBrix] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const router = useRouter();
  const isDark = false;

  const fetchInventory = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc("get_farmer_inventory", {
        p_farmer_id: user.id,
      });

      if (error) throw error;
      setItems(data || []);
      setFilteredItems(data || []);
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    let filtered = items.filter(
      (item) =>
        item.label?.toLowerCase().includes(search.toLowerCase()) ||
        item.variety?.toLowerCase().includes(search.toLowerCase()),
    );

    if (brixFilter === "READ") {
      filtered = filtered.filter((item) => item.last_sweetness > 0);
    } else if (brixFilter === "NOT_READY") {
      filtered = filtered.filter((item) => !item.last_sweetness);
    }

    if (minBrix) {
      filtered = filtered.filter(
        (item) => item.last_sweetness >= parseFloat(minBrix),
      );
    }
    if (maxBrix) {
      filtered = filtered.filter(
        (item) => item.last_sweetness <= parseFloat(maxBrix),
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

    setFilteredItems(filtered);
  }, [search, items, brixFilter, minBrix, maxBrix, fromDate, toDate]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const renderItem = ({ item }: { item: WatermelonItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/details/${item.item_id}` as any)}
    >
      <Image
        source={{
          uri: item.image_url || "https://placehold.co/400x400?text=No+Image",
        }}
        style={styles.itemImage}
      />
      <View style={styles.itemInfo}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemLabel}>{item.label}</Text>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor:
                  item.status === "READY" ? "#D8F3DC" : "#FFD7D7",
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                { color: item.status === "READY" ? "#2D6A4F" : "#D90429" },
              ]}
            >
              {item.status === "READY" ? "RIPE" : "UNRIPE"}
            </Text>
          </View>
        </View>
        <Text style={styles.itemVariety}>{item.variety}</Text>
        <View style={styles.itemStats}>
          <MaterialIcons name="bubble-chart" size={14} color="#2D6A4F" />
          <Text style={styles.statLabel}>
            {" "}
            Sweetness:{" "}
            <Text style={styles.statValue}>
              {item.last_sweetness || "--"} °Bx
            </Text>
          </Text>
        </View>
        <View style={styles.itemStats}>
          <MaterialIcons name="calendar-today" size={12} color="#6C757D" />
          <Text style={styles.dateLabel}>
            {" "}
            {new Date(item.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
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
        <Text style={styles.title}>Inventory</Text>
        <TouchableOpacity
          style={styles.filterToggle}
          onPress={() => setShowFilters(!showFilters)}
        >
          <MaterialIcons name="filter-list" size={24} color="#2D6A4F" />
        </TouchableOpacity>
      </View>

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

      {showFilters && (
        <View style={styles.filterCard}>
          <Text style={styles.filterTitle}>Brix Analysis</Text>
          <View style={styles.filterRow}>
            {(["ALL", "READ", "NOT_READY"] as const).map((f) => (
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
                  {f === "READ"
                    ? "Analyzed"
                    : f === "NOT_READY"
                      ? "Pending"
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
            />
            <Text style={styles.rangeSep}>to</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder="Max"
              keyboardType="numeric"
              value={maxBrix}
              onChangeText={setMaxBrix}
            />
          </View>

          <Text style={styles.filterTitle}>Scan Date Range</Text>
          <View style={styles.rangeRow}>
            <TextInput
              style={styles.rangeInput}
              placeholder="From (YYYY-MM-DD)"
              value={fromDate}
              onChangeText={setFromDate}
            />
            <Text style={styles.rangeSep}>to</Text>
            <TextInput
              style={styles.rangeInput}
              placeholder="To (YYYY-MM-DD)"
              value={toDate}
              onChangeText={setToDate}
            />
          </View>
        </View>
      )}

      <FlatList
        data={filteredItems}
        renderItem={renderItem}
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
    paddingTop: 60,
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
  filterCard: {
    marginHorizontal: 24,
    marginBottom: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E0E0E0",
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
    height: 40,
    backgroundColor: "#F8FBF9",
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  rangeSep: {
    fontSize: 12,
    color: "#6C757D",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },

  itemCard: {
    flexDirection: "row",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 120,
  },

  itemImage: {
    width: 120,
    height: "100%",
    backgroundColor: "#F0F0F0",
  },
  itemInfo: {
    flex: 1,
    padding: 16,
    justifyContent: "space-between",
  },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  itemLabel: {
    fontSize: 18,
    fontWeight: "700",
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
    fontWeight: "800",
    textTransform: "uppercase",
  },
  itemVariety: {
    fontSize: 14,
    color: "#74C69D",
    fontWeight: "500",
    marginBottom: 8,
  },
  itemStats: {
    flexDirection: "row",
  },
  statLabel: {
    fontSize: 12,
    color: "#6C757D",
  },
  statValue: {
    fontWeight: "700",
    color: "#2D6A4F",
  },
  dateLabel: {
    fontSize: 11,
    color: "#999",
    fontWeight: "500",
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
