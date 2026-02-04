import { useAuth } from "@/context/auth";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { supabase } from "@/lib/supabase";
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
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

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
    const filtered = items.filter(
      (item) =>
        item.label?.toLowerCase().includes(search.toLowerCase()) ||
        item.variety?.toLowerCase().includes(search.toLowerCase()),
    );
    setFilteredItems(filtered);
  }, [search, items]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInventory();
  };

  const renderItem = ({ item }: { item: WatermelonItem }) => (
    <TouchableOpacity
      style={[
        styles.itemCard,
        { backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF" },
      ]}
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
          <Text
            style={[
              styles.itemLabel,
              { color: isDark ? "#FFFFFF" : "#1B4332" },
            ]}
          >
            {item.label}
          </Text>
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
              {item.status.replace("_", " ")}
            </Text>
          </View>
        </View>
        <Text style={styles.itemVariety}>{item.variety}</Text>
        <View style={styles.itemStats}>
          <Text style={styles.statLabel}>
            Sweetness:{" "}
            <Text style={styles.statValue}>
              {item.last_sweetness || "--"} °Bx
            </Text>
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
        <Text style={[styles.title, { color: isDark ? "#FFFFFF" : "#1B4332" }]}>
          Watermelon Inventory
        </Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push("/management/add-edit" as any)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
              color: isDark ? "#FFFFFF" : "#000000",
              borderColor: isDark ? "#333333" : "#E0E0E0",
            },
          ]}
          placeholder="Search watermelons..."
          placeholderTextColor="#999"
          value={search}
          onChangeText={setSearch}
        />
      </View>

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
  },
  addButton: {
    width: 44,
    height: 44,
    backgroundColor: "#2D6A4F",
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#2D6A4F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonText: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
  },
  searchContainer: {
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  searchInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
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
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  itemImage: {
    width: 100,
    height: 100,
  },
  itemInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
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
