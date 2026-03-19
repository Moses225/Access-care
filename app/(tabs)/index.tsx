import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { collection, doc, getDoc, getDocs, query } from "firebase/firestore";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";
import { logAnalyticsEvent } from "../../utils/analytics";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COMPACT_CARD_WIDTH = SCREEN_WIDTH * 0.45;
const COMPACT_SPACING = 12;
const PAGE_SIZE = 10;

const CATEGORY_CONFIG: Record<
  string,
  { icon: string; color: string; searchTerms: string[] }
> = {
  "Primary Care": {
    icon: "👨‍⚕️",
    color: "#4CAF50",
    searchTerms: [
      "primary care",
      "family medicine",
      "general practice",
      "internal medicine",
    ],
  },
  "Urgent Care": {
    icon: "🚑",
    color: "#F44336",
    searchTerms: ["urgent care", "emergency", "walk-in"],
  },
  Cardiology: {
    icon: "❤️",
    color: "#E91E63",
    searchTerms: ["cardiology", "cardiologist", "heart"],
  },
  "Mental Health": {
    icon: "🧠",
    color: "#9C27B0",
    searchTerms: [
      "mental health",
      "psychiatry",
      "psychology",
      "therapist",
      "counselor",
      "behavioral",
    ],
  },
  "Women's Health": {
    icon: "🤰",
    color: "#FF4081",
    searchTerms: [
      "obgyn",
      "gynecology",
      "obstetrics",
      "women's health",
      "ob/gyn",
    ],
  },
  Pediatrics: {
    icon: "👶",
    color: "#FF9800",
    searchTerms: ["pediatric", "pediatrics", "children", "kids"],
  },
  Dental: {
    icon: "🦷",
    color: "#00BCD4",
    searchTerms: ["dental", "dentist", "orthodontic"],
  },
  Vision: {
    icon: "👁️",
    color: "#607D8B",
    searchTerms: ["vision", "optometry", "ophthalmology", "eye"],
  },
  Dermatology: {
    icon: "🩺",
    color: "#795548",
    searchTerms: ["dermatology", "dermatologist", "skin"],
  },
  Orthopedics: {
    icon: "🦴",
    color: "#3F51B5",
    searchTerms: ["orthopedic", "orthopedics", "bone", "joint"],
  },
};
const OKLAHOMA_FACILITIES = [
  { name: "OU Medical Center", city: "Oklahoma City", region: "okc" },
  { name: "Mercy Hospital OKC", city: "Oklahoma City", region: "okc" },
  {
    name: "Integris Baptist Medical Center",
    city: "Oklahoma City",
    region: "okc",
  },
  { name: "SSM Health St. Anthony", city: "Oklahoma City", region: "okc" },
  { name: "Oklahoma Heart Hospital", city: "Oklahoma City", region: "okc" },
  { name: "Lakeside Women's Hospital", city: "Oklahoma City", region: "okc" },
  { name: "Saint Francis Health System", city: "Tulsa", region: "tulsa" },
  { name: "Hillcrest Medical Center", city: "Tulsa", region: "tulsa" },
  { name: "Ascension St. John", city: "Tulsa", region: "tulsa" },
  { name: "OSU Medical Center", city: "Tulsa", region: "tulsa" },
  { name: "Norman Regional Health System", city: "Norman", region: "other" },
  { name: "Classen Medical Complex", city: "Norman", region: "other" },
  {
    name: "Cherokee Nation Health Services",
    city: "Statewide",
    region: "tribal",
  },
  {
    name: "Choctaw Nation Health Services",
    city: "Statewide",
    region: "tribal",
  },
  {
    name: "Community Health Centers Inc.",
    city: "Oklahoma City",
    region: "fqhc",
  },
  { name: "Community Health Connection", city: "Tulsa", region: "fqhc" },
];

function normalizeProviderName(name: string): string {
  if (!name) return "";
  if (name === name.toUpperCase()) {
    return name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  }
  if (name === name.toLowerCase()) {
    return name.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return name;
}

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  insuranceAccepted: string[];
  category?: string;
  categories?: string[];
  city?: string;
  state?: string;
  verified?: boolean;
  hospitalAffiliation?: string;
}

interface CategoryData {
  id: string;
  name: string;
  icon: string;
  color: string;
  searchTerms: string[];
  count: number;
}

type LatLng = { lat: number; lng: number };

// ─── Pure distance helper (outside component — stable, never recreated) ───────
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getDistanceToProvider(p: Provider, loc: LatLng | null): number | null {
  if (!loc || !p.latitude || !p.longitude) return null;
  return haversineDistance(loc.lat, loc.lng, p.latitude, p.longitude);
}

// ─── Compact Category Carousel ────────────────────────────────────────────────
const CompactCategoryCarousel = ({
  categories,
  onSelectCategory,
  colors,
}: {
  categories: CategoryData[];
  onSelectCategory: (searchTerm: string, categoryName: string) => void;
  colors: any;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || categories.length === 0) return;
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % categories.length;
      scrollViewRef.current?.scrollTo({
        x: nextIndex * (COMPACT_CARD_WIDTH + COMPACT_SPACING),
        animated: true,
      });
      setCurrentIndex(nextIndex);
    }, 4000);
    return () => clearInterval(interval);
  }, [currentIndex, isPaused, categories.length]);

  if (categories.length === 0) return null;

  return (
    <View style={styles.compactCategoriesWrapper}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.compactCategoriesScroll}
        nestedScrollEnabled={true}
        onScrollBeginDrag={() => setIsPaused(true)}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(
            e.nativeEvent.contentOffset.x /
              (COMPACT_CARD_WIDTH + COMPACT_SPACING),
          );
          setCurrentIndex(newIndex);
          setTimeout(() => setIsPaused(false), 8000);
        }}
      >
        {categories.map((category, index) => {
          const isActive = index === currentIndex;
          return (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.compactCategoryCard,
                {
                  width: COMPACT_CARD_WIDTH,
                  backgroundColor: colors.card,
                  borderColor: isActive ? category.color : colors.border,
                  borderWidth: isActive ? 2 : 1,
                },
              ]}
              onPress={() => {
                setIsPaused(true);
                onSelectCategory(category.searchTerms[0], category.name);
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.compactIconContainer,
                  { backgroundColor: category.color + "20" },
                ]}
              >
                <Text style={styles.compactIcon}>{category.icon}</Text>
              </View>
              <Text
                style={[styles.compactCategoryName, { color: colors.text }]}
                numberOfLines={1}
              >
                {category.name}
              </Text>
              <Text
                style={[styles.compactProviderCount, { color: colors.subtext }]}
              >
                {category.count} providers
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={styles.compactPagination}>
        {categories.slice(0, 5).map((_, index) => (
          <View
            key={index}
            style={[
              styles.compactPaginationDot,
              {
                backgroundColor:
                  index === currentIndex ? colors.primary : colors.border,
                width: index === currentIndex ? 16 : 6,
              },
            ]}
          />
        ))}
        {categories.length > 5 && (
          <Text style={[styles.moreIndicator, { color: colors.subtext }]}>
            +{categories.length - 5}
          </Text>
        )}
      </View>
    </View>
  );
};

// ─── Main Home Screen ─────────────────────────────────────────────────────────
export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [providers, setProviders] = useState<Provider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<Provider[]>([]);
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const lastLoadedAt = useRef<number>(0);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>("");

  // ── Insurance filter state ────────────────────────────────────────────────
  const [insuranceFilter, setInsuranceFilter] = useState<
    "soonercare" | "uninsured" | ""
  >("");
  const [patientInsuranceType, setPatientInsuranceType] = useState<
    "insured" | "uninsured" | ""
  >("");
  const [patientPlan, setPatientPlan] = useState("");

  const [userName, setUserName] = useState("");
  const [availableCategories, setAvailableCategories] = useState<string[]>([
    "all",
  ]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  const [disclaimerHeight] = useState(new Animated.Value(1));

  // ── Location state ────────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [showFacilityModal, setShowFacilityModal] = useState(false);
  const [facilitySearch, setFacilitySearch] = useState("");
  const [selectedFacility, setSelectedFacility] = useState("");
  const [searchLocation, setSearchLocation] = useState<LatLng | null>(null);
  const [radiusFilter, setRadiusFilter] = useState<number>(0);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortByDistance, setSortByDistance] = useState(false);

  // ── Load patient's saved insurance on every focus ─────────────────────────
  const loadPatientInsurance = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      const snap = await getDoc(doc(db, "insurance", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        const type = data.insuranceType || "";
        const plan = data.provider || "";
        setPatientInsuranceType(type);
        setPatientPlan(plan);
        if (type === "insured") {
          const isSoonerCare =
            plan.toLowerCase().includes("soonercare") ||
            plan.toLowerCase().includes("medicaid");
          if (isSoonerCare) setInsuranceFilter("soonercare");
        } else if (type === "uninsured") {
          setInsuranceFilter("uninsured");
        }
      }
    } catch {
      /* non-critical */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatientInsurance();
    }, [loadPatientInsurance]),
  );

  useEffect(() => {
    loadUserName();
    loadDisclaimerPreference();
  }, []);

  // ── Client-side filtering — runs after all state dependencies change ───────
  useEffect(() => {
    if (!providers.length) return;
    let filtered = [...providers];

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.specialty && p.specialty.toLowerCase().includes(q)) ||
          (p.address && p.address.toLowerCase().includes(q)) ||
          (p.city && p.city.toLowerCase().includes(q)),
      );
    }

    // Category filter
    if (selectedCategory && selectedCategory !== "all") {
      const matchingCategory = Object.entries(CATEGORY_CONFIG).find(
        ([, config]) =>
          config.searchTerms.some(
            (term) => term.toLowerCase() === selectedCategory.toLowerCase(),
          ),
      );
      if (matchingCategory) {
        const [, config] = matchingCategory;
        filtered = filtered.filter((p) => {
          const specialty = p.specialty.toLowerCase();
          const cat = p.category?.toLowerCase() || "";
          const cats = p.categories?.map((c) => c.toLowerCase()) || [];
          return config.searchTerms.some(
            (term) =>
              specialty.includes(term.toLowerCase()) ||
              cat.includes(term.toLowerCase()) ||
              cats.some((c) => c.includes(term.toLowerCase())),
          );
        });
      } else {
        filtered = filtered.filter(
          (p) =>
            p.category === selectedCategory ||
            (p.categories && p.categories.includes(selectedCategory)) ||
            (p.specialty &&
              p.specialty
                .toLowerCase()
                .includes(selectedCategory.toLowerCase())),
        );
      }
    }

    // Insurance filter
    if (insuranceFilter === "soonercare") {
      filtered = filtered.filter(
        (p) =>
          p.insuranceAccepted &&
          (p.insuranceAccepted.includes("SoonerCare") ||
            p.insuranceAccepted.includes("Medicaid") ||
            p.insuranceAccepted.some(
              (i) =>
                i.toLowerCase().includes("soonercare") ||
                i.toLowerCase().includes("medicaid"),
            )),
      );
    }

    // Facility filter
    if (selectedFacility) {
      filtered = filtered.filter(
        (p) =>
          p.hospitalAffiliation
            ?.toLowerCase()
            .includes(selectedFacility.toLowerCase()) ||
          p.address?.toLowerCase().includes(selectedFacility.toLowerCase()) ||
          p.name?.toLowerCase().includes(selectedFacility.toLowerCase()),
      );
    }

    // Distance filter
    const activeLoc = searchLocation ?? userLocation;
    if (activeLoc && radiusFilter > 0) {
      filtered = filtered.filter((p) => {
        const dist = getDistanceToProvider(p, activeLoc);
        return dist !== null && dist <= radiusFilter;
      });
    }

    // Sort by distance
    if (sortByDistance && activeLoc) {
      filtered = [...filtered].sort((a, b) => {
        const da = getDistanceToProvider(a, activeLoc) ?? 9999;
        const db2 = getDistanceToProvider(b, activeLoc) ?? 9999;
        return da - db2;
      });
    }

    setFilteredProviders(filtered);
    setDisplayCount(PAGE_SIZE);
  }, [
    providers,
    searchQuery,
    selectedCategory,
    insuranceFilter,
    searchLocation,
    userLocation,
    radiusFilter,
    sortByDistance,
    selectedFacility,
  ]);

  const loadDisclaimerPreference = async () => {
    try {
      const dismissed = await AsyncStorage.getItem("disclaimerDismissed");
      if (dismissed === "true") setShowDisclaimer(false);
    } catch {
      /* non-critical */
    }
  };

  const handleDismissDisclaimer = async () => {
    try {
      Animated.timing(disclaimerHeight, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }).start(() => setShowDisclaimer(false));
      await AsyncStorage.setItem("disclaimerDismissed", "true");
    } catch {
      /* non-critical */
    }
  };

  const loadUserName = async () => {
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) return;
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        if (data.firstName && typeof data.firstName === "string") {
          setUserName(data.firstName.trim());
        } else if (data.displayName && typeof data.displayName === "string") {
          setUserName(data.displayName.trim().split(" ")[0]);
        } else {
          const email = data.email || user.email;
          if (email) {
            const prefix = email.split("@")[0];
            setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
          }
        }
      } else if (user.email) {
        const prefix = user.email.split("@")[0];
        setUserName(prefix.charAt(0).toUpperCase() + prefix.slice(1));
      }
    } catch {
      /* non-critical */
    }
  };

  const loadProviders = useCallback(async () => {
    try {
      setLoading(true);
      const snapshot = await getDocs(query(collection(db, "providers")));

      const providersList: Provider[] = [];
      const specialtiesSet = new Set<string>();
      let skipped = 0;

      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!data.name || !data.specialty) {
          skipped++;
          return;
        }

        let safeRating = 0;
        if (typeof data.rating === "number") safeRating = data.rating;
        else if (typeof data.rating === "string") {
          const p = parseFloat(data.rating);
          safeRating = isNaN(p) ? 0 : p;
        }

        const safeLatitude =
          typeof data.latitude === "number" && data.latitude !== 0
            ? data.latitude
            : 35.4676;
        const safeLongitude =
          typeof data.longitude === "number" && data.longitude !== 0
            ? data.longitude
            : -97.5164;

        let safeInsurance: string[] = [];
        if (Array.isArray(data.insuranceAccepted))
          safeInsurance = data.insuranceAccepted;
        else if (typeof data.insuranceAccepted === "string")
          safeInsurance = [data.insuranceAccepted];

        let safeCategories: string[] = [];
        if (Array.isArray(data.categories)) safeCategories = data.categories;
        else if (data.category) safeCategories = [data.category];

        providersList.push({
          id: docSnap.id,
          name: data.name,
          specialty: data.specialty,
          address: data.address || "",
          phone: data.phone || "",
          rating: safeRating,
          acceptsNewPatients:
            data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
          location: { latitude: safeLatitude, longitude: safeLongitude },
          latitude: safeLatitude,
          longitude: safeLongitude,
          insuranceAccepted: safeInsurance,
          category: data.category || "",
          categories: safeCategories,
          city: data.city || "",
          state: data.state || "Oklahoma",
          verified: data.verified ?? false,
        });

        if (data.specialty) specialtiesSet.add(data.specialty);
      });

      if (__DEV__)
        console.log(
          `✅ Loaded ${providersList.length} providers, skipped ${skipped}`,
        );

      const categoriesWithCounts: CategoryData[] = [];
      Object.entries(CATEGORY_CONFIG).forEach(([categoryName, config]) => {
        const count = providersList.filter((p) => {
          const specialty = p.specialty.toLowerCase();
          const cat = p.category?.toLowerCase() || "";
          const cats = p.categories?.map((c) => c.toLowerCase()) || [];
          return config.searchTerms.some(
            (term) =>
              specialty.includes(term.toLowerCase()) ||
              cat.includes(term.toLowerCase()) ||
              cats.some((c) => c.includes(term.toLowerCase())),
          );
        }).length;
        if (count > 0) {
          categoriesWithCounts.push({
            id: categoryName.replace(/\s+/g, "-").toLowerCase(),
            name: categoryName,
            icon: config.icon,
            color: config.color,
            searchTerms: config.searchTerms,
            count,
          });
        }
      });

      categoriesWithCounts.sort((a, b) => b.count - a.count);
      setCategoryData(categoriesWithCounts);
      setAvailableCategories(
        ["all", ...Array.from(specialtiesSet)].slice(0, 8),
      );
      setProviders(providersList);
      setDisplayCount(PAGE_SIZE);
    } catch (error) {
      if (__DEV__) console.error("❌ Error loading providers:", error);
      Alert.alert(
        "Error",
        "Could not load providers. Please check your connection.",
        [
          { text: "Retry", onPress: () => loadProviders() },
          { text: "Cancel", style: "cancel" },
        ],
      );
    } finally {
      lastLoadedAt.current = Date.now();
      setLoading(false);
    }
  }, []);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayCount((prev) =>
        Math.min(prev + PAGE_SIZE, filteredProviders.length),
      );
      setLoadingMore(false);
    }, 150);
  };

  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const isStale = now - lastLoadedAt.current > 60_000;
      if (isStale) loadProviders();
    }, [loadProviders]),
  );

  const handleProviderPress = (providerId: string) => {
    try {
      if (!providerId || typeof providerId !== "string") {
        Alert.alert("Error", "Could not open provider details");
        return;
      }
      router.push(`/provider/${providerId}` as any);
    } catch {
      Alert.alert("Error", "Could not open provider details");
    }
  };

  const handleQuickSearch = (search: string) => {
    setSearchQuery(search);
    setSelectedCategory("all");
    setSelectedCategoryName("");
  };

  const handleCategorySelect = (searchTerm: string, categoryName: string) => {
    setSelectedCategory(searchTerm);
    setSelectedCategoryName(categoryName);
    setSearchQuery("");
  };

  const handleClearLocation = useCallback(() => {
    setLocationSearch("");
    setSearchLocation(null);
    setUserLocation(null);
    setSortByDistance(false);
    setRadiusFilter(0);
  }, []);

  const handleClearFilters = useCallback(() => {
    setSelectedCategory("all");
    setSelectedCategoryName("");
    setSearchQuery("");
    setInsuranceFilter("");
    handleClearLocation();
  }, [handleClearLocation]);

  const toggleInsuranceFilter = (type: "soonercare" | "uninsured") => {
    setInsuranceFilter((prev) => (prev === type ? "" : type));
    logAnalyticsEvent("insurance_filter", { type });
  };

  const handleUseMyLocation = async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Allow location access to find providers near you.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords: LatLng = {
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
      };
      setUserLocation(coords);
      setSearchLocation(coords);
      setSortByDistance(true);
      setLocationSearch("My location");
      logAnalyticsEvent("location_search", { method: "near_me" });
    } catch {
      Alert.alert(
        "Error",
        "Could not get your location. Try searching by city instead.",
      );
    } finally {
      setLocationLoading(false);
    }
  };

  const handleLocationSearch = async () => {
    const trimmed = locationSearch.trim();
    if (!trimmed || trimmed === "My location") return;
    setLocationLoading(true);
    try {
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) throw new Error("Maps API key not configured");
      const encoded = encodeURIComponent(trimmed + ", Oklahoma");
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${apiKey}`,
      );
      if (!res.ok) throw new Error("Geocoding request failed");
      const data = await res.json();
      if (data.results?.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        const inOklahoma =
          lat >= 33.6 && lat <= 37.0 && lng >= -103.0 && lng <= -94.4;
        if (!inOklahoma) {
          Alert.alert(
            "Outside Oklahoma",
            "AccessCare currently serves Oklahoma providers only. Try an Oklahoma city or ZIP code.",
          );
          setLocationLoading(false);
          return;
        }
        setSearchLocation({ lat, lng });
        setSortByDistance(true);
        logAnalyticsEvent("location_search", {
          method: "city_zip",
          query: trimmed,
        });
      } else {
        Alert.alert(
          "Not found",
          "Could not find that location. Try a city name or ZIP code.",
        );
      }
    } catch {
      Alert.alert(
        "Error",
        "Could not search that location. Check your connection.",
      );
    } finally {
      setLocationLoading(false);
    }
  };

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>
          Loading providers...
        </Text>
      </View>
    );
  }

  const visibleProviders = filteredProviders.slice(0, displayCount);
  const hasMore = displayCount < filteredProviders.length;
  const remainingCount = filteredProviders.length - displayCount;
  const activeLoc = searchLocation ?? userLocation;

  // ── Insurance chip helpers ────────────────────────────────────────────────
  const hasSavedSoonerCare =
    patientInsuranceType === "insured" &&
    (patientPlan.toLowerCase().includes("soonercare") ||
      patientPlan.toLowerCase().includes("medicaid"));
  const hasSavedInsurance = patientInsuranceType === "insured" && !!patientPlan;
  const isSavedUninsured = patientInsuranceType === "uninsured";

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {userName ? `Hi, ${userName} 👋` : "Find Care"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          {providers.length}+ providers in Oklahoma
        </Text>
      </View>

      {/* ── Insurance filter chips ───────────────────────────────────────── */}
      <View
        style={[
          styles.insuranceSection,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.insuranceSectionTitle, { color: colors.text }]}>
          Filter by coverage
        </Text>
        <View style={styles.insuranceChips}>
          <TouchableOpacity
            style={[
              styles.insuranceChip,
              {
                backgroundColor:
                  insuranceFilter === "soonercare"
                    ? colors.success
                    : colors.background,
                borderColor:
                  insuranceFilter === "soonercare"
                    ? colors.success
                    : colors.border,
                borderWidth: insuranceFilter === "soonercare" ? 2 : 1,
              },
            ]}
            onPress={() => toggleInsuranceFilter("soonercare")}
          >
            <Text style={styles.insuranceChipIcon}>💊</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.insuranceChipLabel,
                  {
                    color:
                      insuranceFilter === "soonercare" ? "#fff" : colors.text,
                  },
                ]}
                numberOfLines={1}
              >
                SoonerCare / Medicaid
              </Text>
              {hasSavedSoonerCare && (
                <Text
                  style={[
                    styles.insuranceChipSub,
                    {
                      color:
                        insuranceFilter === "soonercare"
                          ? "#fff"
                          : colors.success,
                    },
                  ]}
                >
                  Your saved plan
                </Text>
              )}
            </View>
            {insuranceFilter === "soonercare" && (
              <Text style={styles.insuranceChipCheck}>✓</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.insuranceChip,
              {
                backgroundColor:
                  insuranceFilter === "uninsured"
                    ? "#F59E0B"
                    : colors.background,
                borderColor:
                  insuranceFilter === "uninsured" ? "#F59E0B" : colors.border,
                borderWidth: insuranceFilter === "uninsured" ? 2 : 1,
              },
            ]}
            onPress={() => toggleInsuranceFilter("uninsured")}
          >
            <Text style={styles.insuranceChipIcon}>💵</Text>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.insuranceChipLabel,
                  {
                    color:
                      insuranceFilter === "uninsured" ? "#fff" : colors.text,
                  },
                ]}
              >
                No Insurance
              </Text>
              {isSavedUninsured && (
                <Text
                  style={[
                    styles.insuranceChipSub,
                    {
                      color:
                        insuranceFilter === "uninsured" ? "#fff" : "#F59E0B",
                    },
                  ]}
                >
                  {insuranceFilter === "uninsured"
                    ? "Active"
                    : "Your saved plan"}
                </Text>
              )}
            </View>
            {insuranceFilter === "uninsured" && (
              <Text style={styles.insuranceChipCheck}>✓</Text>
            )}
          </TouchableOpacity>
        </View>

        {hasSavedInsurance && !hasSavedSoonerCare && (
          <View
            style={[
              styles.savedPlanNote,
              {
                backgroundColor: colors.primary + "10",
                borderColor: colors.primary + "30",
              },
            ]}
          >
            <Text style={[styles.savedPlanNoteText, { color: colors.primary }]}>
              💊 Your saved plan:{" "}
              <Text style={{ fontWeight: "700" }}>{patientPlan}</Text>
            </Text>
          </View>
        )}

        {insuranceFilter === "uninsured" && (
          <View
            style={[
              styles.uninsuredNote,
              { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" },
            ]}
          >
            <Text style={[styles.uninsuredNoteText, { color: "#F59E0B" }]}>
              ℹ️ Showing all providers. Contact each directly to confirm cash
              pay and sliding scale availability.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.manageInsuranceLink}
          onPress={() => router.push("/(tabs)/insurance" as any)}
        >
          <Text
            style={[styles.manageInsuranceLinkText, { color: colors.primary }]}
          >
            {patientInsuranceType
              ? "Update insurance settings →"
              : "Save your insurance for faster filtering →"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Keyword search ───────────────────────────────────────────────── */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name, specialty, or location..."
            placeholderTextColor={colors.subtext}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Location search ──────────────────────────────────────────────── */}
      <View
        style={[
          styles.locationSection,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.locationRow}>
          <TouchableOpacity
            style={[
              styles.myLocationBtn,
              {
                borderColor: colors.primary,
                backgroundColor:
                  activeLoc && locationSearch === "My location"
                    ? colors.primary
                    : "transparent",
              },
            ]}
            onPress={handleUseMyLocation}
            disabled={locationLoading}
          >
            {locationLoading && locationSearch !== "My location" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[
                  styles.myLocationBtnText,
                  {
                    color:
                      activeLoc && locationSearch === "My location"
                        ? "#fff"
                        : colors.primary,
                  },
                ]}
              >
                📍 Near me
              </Text>
            )}
          </TouchableOpacity>

          <View
            style={[
              styles.locationInput,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.locationInputText, { color: colors.text }]}
              placeholder="Search near city or ZIP..."
              placeholderTextColor={colors.subtext}
              value={locationSearch === "My location" ? "" : locationSearch}
              onChangeText={(v) => {
                setLocationSearch(v);
                setSortByDistance(false);
                setSearchLocation(null);
              }}
              onSubmitEditing={handleLocationSearch}
              returnKeyType="search"
            />
            {locationLoading && locationSearch !== "My location" && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginRight: 4 }}
              />
            )}
            {locationSearch.length > 0 &&
              locationSearch !== "My location" &&
              !locationLoading && (
                <TouchableOpacity onPress={handleClearLocation}>
                  <Text
                    style={{ color: colors.subtext, fontSize: 16, padding: 4 }}
                  >
                    ✕
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        </View>

        {activeLoc && (
          <View style={styles.radiusRow}>
            <Text style={[styles.radiusLabel, { color: colors.subtext }]}>
              Radius:
            </Text>
            {[5, 10, 25, 50, 0].map((r) => (
              <TouchableOpacity
                key={r}
                style={[
                  styles.radiusPill,
                  {
                    backgroundColor:
                      radiusFilter === r ? colors.primary : colors.background,
                    borderColor:
                      radiusFilter === r ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setRadiusFilter(r)}
              >
                <Text
                  style={[
                    styles.radiusPillText,
                    { color: radiusFilter === r ? "#fff" : colors.text },
                  ]}
                >
                  {r === 0 ? "Any" : `${r} mi`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {activeLoc && (
          <View style={styles.locationBadge}>
            <Text
              style={[styles.locationBadgeText, { color: colors.primary }]}
              numberOfLines={1}
            >
              📍 Near {locationSearch || "your search"}
              {radiusFilter > 0
                ? ` · within ${radiusFilter} mi`
                : " · sorted by distance"}
            </Text>
            <TouchableOpacity onPress={handleClearLocation}>
              <Text style={{ color: colors.subtext, fontSize: 12 }}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── Facility search button ──────────────────────────────────────── */}
      <TouchableOpacity
        style={[
          styles.facilityBtn,
          {
            backgroundColor: selectedFacility ? colors.primary : colors.card,
            borderColor: selectedFacility ? colors.primary : colors.border,
          },
        ]}
        onPress={() => setShowFacilityModal(true)}
      >
        <Text style={{ fontSize: 16 }}>🏥</Text>
        <Text
          style={[
            styles.facilityBtnText,
            {
              color: selectedFacility ? "#fff" : colors.text,
            },
          ]}
        >
          {selectedFacility
            ? `Hospital: ${selectedFacility}`
            : "Find by hospital or facility"}
        </Text>
        {selectedFacility ? (
          <TouchableOpacity onPress={() => setSelectedFacility("")}>
            <Text style={{ color: "#fff", fontSize: 16, paddingHorizontal: 4 }}>
              ✕
            </Text>
          </TouchableOpacity>
        ) : (
          <Text style={{ color: colors.subtext, fontSize: 16 }}>›</Text>
        )}
      </TouchableOpacity>

      {selectedCategoryName && selectedCategory !== "all" && (
        <View style={styles.filterBadgeContainer}>
          <View
            style={[styles.filterBadge, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.filterBadgeText}>
              Filtered by: {selectedCategoryName}
            </Text>
            <TouchableOpacity onPress={handleClearFilters}>
              <Ionicons name="close" size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showDisclaimer && (
        <Animated.View
          style={[
            styles.disclaimerContainer,
            {
              backgroundColor: colors.card,
              opacity: disclaimerHeight,
              transform: [{ scaleY: disclaimerHeight }],
            },
          ]}
        >
          <View style={styles.disclaimerContent}>
            <Text style={styles.disclaimerIcon}>ℹ️</Text>
            <Text style={[styles.disclaimerText, { color: colors.subtext }]}>
              Provider info from public sources. Always verify insurance
              acceptance before booking.
            </Text>
            <TouchableOpacity onPress={handleDismissDisclaimer}>
              <Text style={styles.disclaimerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {!searchQuery &&
        selectedCategory === "all" &&
        categoryData.length > 0 && (
          <View style={styles.categoriesSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              🔥 Browse by Category
            </Text>
            <CompactCategoryCarousel
              categories={categoryData}
              onSelectCategory={handleCategorySelect}
              colors={colors}
            />
          </View>
        )}

      {!searchQuery && selectedCategory === "all" && (
        <View style={styles.quickSearches}>
          <Text style={[styles.quickSearchTitle, { color: colors.text }]}>
            🔥 Popular Searches
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickSearchScroll}
            nestedScrollEnabled={true}
          >
            {[
              { label: "Internal Medicine", query: "internal medicine" },
              { label: "Oklahoma City", query: "oklahoma city" },
              { label: "Family Medicine", query: "family" },
              { label: "Pediatrics", query: "pediatric" },
            ].map(({ label, query: q }) => (
              <TouchableOpacity
                key={label}
                style={[
                  styles.quickSearchChip,
                  { backgroundColor: colors.primary },
                ]}
                onPress={() => handleQuickSearch(q)}
              >
                <Text style={styles.quickSearchText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
          nestedScrollEnabled={true}
        >
          {availableCategories.map((category) => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    selectedCategory === category
                      ? colors.primary
                      : colors.card,
                  borderColor: colors.border,
                },
              ]}
              onPress={() => {
                setSelectedCategory(category);
                setSelectedCategoryName(category === "all" ? "" : category);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  {
                    color: selectedCategory === category ? "#fff" : colors.text,
                  },
                ]}
              >
                {category === "all" ? "All Specialties" : category}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {(searchQuery.trim() ||
        selectedCategory !== "all" ||
        insuranceFilter ||
        activeLoc) && (
        <Text style={[styles.resultsCount, { color: colors.subtext }]}>
          {filteredProviders.length} result
          {filteredProviders.length !== 1 ? "s" : ""}
          {filteredProviders.length > displayCount
            ? ` · showing ${displayCount}`
            : ""}
          {activeLoc && sortByDistance ? " · sorted by distance" : ""}
        </Text>
      )}

      <View style={styles.list}>
        {visibleProviders.length > 0 ? (
          <>
            {visibleProviders.map((item) => {
              if (!item?.id) return null;
              const hasSoonerCare =
                item.insuranceAccepted.includes("SoonerCare") ||
                item.insuranceAccepted.includes("Medicaid");
              const acceptingPatients =
                item.acceptsNewPatients ?? item.acceptingNewPatients ?? true;
              const isVerified = item.verified ?? false;
              const dist = getDistanceToProvider(item, activeLoc);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.providerCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => handleProviderPress(item.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardLeft}>
                      <View
                        style={[
                          styles.avatar,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <Text style={styles.avatarText}>
                          {item.name
                            ? normalizeProviderName(item.name).charAt(0)
                            : "P"}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.cardContent}>
                      <View style={styles.nameRow}>
                        <Text
                          style={[styles.providerName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {normalizeProviderName(item.name)}
                        </Text>
                        {isVerified && (
                          <View
                            style={[
                              styles.verifiedBadge,
                              { backgroundColor: colors.success },
                            ]}
                          >
                            <Text style={styles.verifiedBadgeText}>✓</Text>
                          </View>
                        )}
                      </View>
                      <Text
                        style={[styles.specialty, { color: colors.primary }]}
                        numberOfLines={1}
                      >
                        {item.specialty}
                      </Text>
                      {acceptingPatients && (
                        <View
                          style={[
                            styles.availableBadge,
                            { backgroundColor: colors.success },
                          ]}
                        >
                          <Text style={styles.availableText}>
                            ✅ Accepting patients
                          </Text>
                        </View>
                      )}
                      {hasSoonerCare && (
                        <View
                          style={[
                            styles.soonerCareBadge,
                            { backgroundColor: "#E8F5E9" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.soonerCareText,
                              { color: colors.success },
                            ]}
                          >
                            💊 SoonerCare
                          </Text>
                        </View>
                      )}
                      {dist !== null && (
                        <Text
                          style={[
                            styles.distanceText,
                            { color: colors.subtext },
                          ]}
                        >
                          📍{" "}
                          {dist < 1
                            ? `${(dist * 5280).toFixed(0)} ft away`
                            : `${dist.toFixed(1)} mi away`}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.chevron, { color: colors.subtext }]}>
                      ›
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {hasMore && (
              <TouchableOpacity
                style={[styles.loadMoreButton, { borderColor: colors.primary }]}
                onPress={handleLoadMore}
                disabled={loadingMore}
                activeOpacity={0.7}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text
                    style={[styles.loadMoreText, { color: colors.primary }]}
                  >
                    Load {Math.min(remainingCount, PAGE_SIZE)} More
                    {remainingCount > PAGE_SIZE
                      ? ` (${remainingCount} remaining)`
                      : ""}
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {!hasMore && filteredProviders.length > PAGE_SIZE && (
              <Text style={[styles.endText, { color: colors.subtext }]}>
                All {filteredProviders.length} providers shown
              </Text>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No Providers Found
            </Text>
            <Text style={[styles.emptyText, { color: colors.subtext }]}>
              {activeLoc && radiusFilter > 0
                ? `No providers within ${radiusFilter} miles. Try a larger radius.`
                : searchQuery
                  ? `No results for "${searchQuery}"`
                  : "Try adjusting your filters"}
            </Text>
            <TouchableOpacity
              style={[styles.clearButton, { backgroundColor: colors.primary }]}
              onPress={handleClearFilters}
            >
              <Text style={styles.clearButtonText}>Clear All Filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      {/* ── Facility Search Modal ────────────────────────────────────────── */}
      {showFacilityModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View
              style={[styles.modalHandle, { backgroundColor: colors.border }]}
            />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Find by Hospital or Facility
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>
              Search for a hospital, clinic, or health center in Oklahoma
            </Text>

            <View
              style={[
                styles.facilitySearchBar,
                {
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                style={[{ flex: 1, fontSize: 14, color: colors.text }]}
                placeholder="Search hospitals and clinics..."
                placeholderTextColor={colors.subtext}
                value={facilitySearch}
                onChangeText={setFacilitySearch}
                autoFocus
              />
              {facilitySearch.length > 0 && (
                <TouchableOpacity onPress={() => setFacilitySearch("")}>
                  <Text style={{ color: colors.subtext, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
            >
              {[
                {
                  label: "OKC Area",
                  facilities: OKLAHOMA_FACILITIES.filter(
                    (f) => f.region === "okc",
                  ),
                },
                {
                  label: "Tulsa Area",
                  facilities: OKLAHOMA_FACILITIES.filter(
                    (f) => f.region === "tulsa",
                  ),
                },
                {
                  label: "Other Cities",
                  facilities: OKLAHOMA_FACILITIES.filter(
                    (f) => f.region === "other",
                  ),
                },
                {
                  label: "Tribal Health",
                  facilities: OKLAHOMA_FACILITIES.filter(
                    (f) => f.region === "tribal",
                  ),
                },
                {
                  label: "Community Health Centers",
                  facilities: OKLAHOMA_FACILITIES.filter(
                    (f) => f.region === "fqhc",
                  ),
                },
              ]
                .map((group) => ({
                  ...group,
                  facilities: group.facilities.filter(
                    (f) =>
                      !facilitySearch ||
                      f.name
                        .toLowerCase()
                        .includes(facilitySearch.toLowerCase()) ||
                      f.city
                        .toLowerCase()
                        .includes(facilitySearch.toLowerCase()),
                  ),
                }))
                .filter((group) => group.facilities.length > 0)
                .map((group) => (
                  <View key={group.label} style={{ marginBottom: 16 }}>
                    <Text
                      style={[
                        styles.facilityGroupLabel,
                        { color: colors.subtext },
                      ]}
                    >
                      {group.label.toUpperCase()}
                    </Text>
                    {group.facilities.map((facility) => {
                      const isSelected = selectedFacility === facility.name;
                      return (
                        <TouchableOpacity
                          key={facility.name}
                          style={[
                            styles.facilityOption,
                            {
                              backgroundColor: isSelected
                                ? colors.primary + "15"
                                : colors.background,
                              borderColor: isSelected
                                ? colors.primary
                                : colors.border,
                              borderWidth: isSelected ? 2 : 1,
                            },
                          ]}
                          onPress={() => {
                            setSelectedFacility(
                              isSelected ? "" : facility.name,
                            );
                            setShowFacilityModal(false);
                            setFacilitySearch("");
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.facilityOptionName,
                                {
                                  color: isSelected
                                    ? colors.primary
                                    : colors.text,
                                },
                              ]}
                            >
                              {facility.name}
                            </Text>
                            <Text
                              style={[
                                styles.facilityOptionCity,
                                { color: colors.subtext },
                              ]}
                            >
                              {facility.city}
                            </Text>
                          </View>
                          {isSelected && (
                            <Text
                              style={{
                                color: colors.primary,
                                fontSize: 18,
                                fontWeight: "bold",
                              }}
                            >
                              ✓
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              {facilitySearch.length > 0 &&
                OKLAHOMA_FACILITIES.filter(
                  (f) =>
                    f.name
                      .toLowerCase()
                      .includes(facilitySearch.toLowerCase()) ||
                    f.city.toLowerCase().includes(facilitySearch.toLowerCase()),
                ).length === 0 && (
                  <View style={{ padding: 24, alignItems: "center" }}>
                    <Text style={{ fontSize: 32, marginBottom: 8 }}>🏥</Text>
                    <Text
                      style={[
                        { fontSize: 15, fontWeight: "600", marginBottom: 6 },
                        { color: colors.text },
                      ]}
                    >
                      Not in our list yet
                    </Text>
                    <Text
                      style={[
                        { fontSize: 13, textAlign: "center", lineHeight: 18 },
                        { color: colors.subtext },
                      ]}
                    >
                      Try searching by provider name or city instead. We are
                      adding more facilities regularly.
                    </Text>
                  </View>
                )}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalCloseBtn, { borderColor: colors.border }]}
              onPress={() => {
                setShowFacilityModal(false);
                setFacilitySearch("");
              }}
            >
              <Text
                style={[
                  { fontSize: 15, fontWeight: "600" },
                  { color: colors.subtext },
                ]}
              >
                Close
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  header: { paddingTop: 60, paddingBottom: 12, paddingHorizontal: 20 },
  title: { fontSize: 28, fontWeight: "bold", marginBottom: 2 },
  subtitle: { fontSize: 13 },
  insuranceSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  insuranceSectionTitle: { fontSize: 13, fontWeight: "700", marginBottom: 10 },
  insuranceChips: { flexDirection: "row", gap: 10, marginBottom: 4 },
  insuranceChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  insuranceChipIcon: { fontSize: 20 },
  insuranceChipLabel: {
    fontSize: 11,
    fontWeight: "700",
    lineHeight: 14,
    flexShrink: 1,
  },
  insuranceChipSub: { fontSize: 10, fontWeight: "500", marginTop: 1 },
  insuranceChipCheck: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginLeft: "auto",
  },
  savedPlanNote: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginBottom: 4,
  },
  savedPlanNoteText: { fontSize: 12, lineHeight: 17 },
  uninsuredNote: { borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  uninsuredNoteText: { fontSize: 12, lineHeight: 17 },
  manageInsuranceLink: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  manageInsuranceLinkText: { fontSize: 12, fontWeight: "600" },
  searchContainer: { paddingHorizontal: 16, marginBottom: 10 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  searchIcon: { fontSize: 18, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14 },
  clearIcon: { fontSize: 18, color: "#999", padding: 4 },
  locationSection: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  myLocationBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  myLocationBtnText: { fontSize: 12, fontWeight: "700" },
  locationInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 36,
  },
  locationInputText: { flex: 1, fontSize: 13 },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    flexWrap: "wrap",
  },
  radiusLabel: { fontSize: 12, fontWeight: "600" },
  radiusPill: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  radiusPillText: { fontSize: 12, fontWeight: "600" },
  locationBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
  },
  locationBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
    marginRight: 8,
  },
  distanceText: { fontSize: 11, marginBottom: 2 },
  filterBadgeContainer: { paddingHorizontal: 16, marginBottom: 12 },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  filterBadgeText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  disclaimerContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 10,
    overflow: "hidden",
  },
  disclaimerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
  },
  disclaimerIcon: { fontSize: 16, marginRight: 8 },
  disclaimerText: { flex: 1, fontSize: 11, lineHeight: 14 },
  disclaimerClose: { fontSize: 18, color: "#999", padding: 4 },
  categoriesSection: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  compactCategoriesWrapper: { marginBottom: 8, paddingVertical: 4 },
  compactCategoriesScroll: { paddingHorizontal: 16, gap: 12 },
  compactCategoryCard: { borderRadius: 12, padding: 12, alignItems: "center" },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  compactIcon: { fontSize: 20 },
  compactCategoryName: {
    fontSize: 13,
    fontWeight: "bold",
    marginBottom: 4,
    textAlign: "center",
  },
  compactProviderCount: { fontSize: 10 },
  compactPagination: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    gap: 4,
  },
  compactPaginationDot: { height: 6, borderRadius: 3 },
  moreIndicator: { fontSize: 10, marginLeft: 4 },
  quickSearches: { paddingHorizontal: 16, marginBottom: 10 },
  quickSearchTitle: { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  quickSearchScroll: { flexDirection: "row" },
  quickSearchChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  quickSearchText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  filtersContainer: { marginBottom: 10 },
  filtersScroll: { paddingHorizontal: 16, gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
  },
  filterChipText: { fontSize: 13, fontWeight: "600" },
  resultsCount: { fontSize: 12, paddingHorizontal: 20, marginBottom: 8 },
  list: { padding: 16, paddingTop: 0 },
  providerCard: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  cardHeader: { flexDirection: "row", alignItems: "center" },
  cardLeft: { marginRight: 12 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  cardContent: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 3,
  },
  providerName: { fontSize: 16, fontWeight: "bold", flex: 1 },
  verifiedBadge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  verifiedBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  specialty: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  availableBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 4,
  },
  availableText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  soonerCareBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  soonerCareText: { fontSize: 10, fontWeight: "bold" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  star: { fontSize: 14 },
  rating: { fontSize: 14, fontWeight: "600" },
  chevron: { fontSize: 24, marginLeft: 8 },
  loadMoreButton: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  loadMoreText: { fontSize: 15, fontWeight: "600" },
  endText: { textAlign: "center", fontSize: 13, paddingVertical: 16 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 8 },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 24,
  },
  clearButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  facilityBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  facilityBtnText: { flex: 1, fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
    zIndex: 100,
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 6 },
  modalSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 16 },
  facilitySearchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 16,
  },
  facilityGroupLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  facilityOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
  facilityOptionName: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  facilityOptionCity: { fontSize: 12 },
  modalCloseBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
});
