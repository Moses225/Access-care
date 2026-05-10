import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc } from "firebase/firestore";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { auth, db } from "../../firebase";
import { logAnalyticsEvent } from "../../utils/analytics";

const getFavoritesKey = (): string => {
  const uid = auth.currentUser?.uid;
  return uid ? `favorites_${uid}` : "favorites";
};

interface Provider {
  id: string;
  name: string;
  specialty: string;
  address: string;
  phone: string;
  rating: number;
  acceptsNewPatients?: boolean;
  acceptingNewPatients?: boolean;
  telehealth?: boolean;
  inPerson?: boolean;
  telehealthOnly?: boolean;
  insuranceAccepted: string[];
  location?: { latitude: number; longitude: number };
  latitude?: number;
  longitude?: number;
  city?: string;
  state?: string;
  verified?: boolean;
  profilePicture?: string;
  welcomeMessage?: string;
  aboutMe?: string;
  languages?: string;
  specialInterests?: string[];
  education?: { degree: string; school: string; year: number }[];
  languagesSpoken?: string[];
  boardCertifications?: string[];
  interviewConsult?: {
    offered: boolean;
    duration: number;
    price: number;
    description: string;
  };
  voucherParticipant?: boolean;
  communicationStyles?: string[];
  personalityTags?: string[];
  whoISee?: string[];
  visitApproach?: string[];
  typicalWaitDays?: number;
  typicalWaitHours?: number;
  avgVisitMinutes?: number;
  officeNotes?: string;
  reviewCount?: number;
  reviewAverage?: number;
  website?: string;
}

// ─── Tag color palettes ────────────────────────────────────────────────────────
const STYLE_TAG_COLORS: Record<string, string> = {
  "Direct & Clinical": "#3B82F6",
  "Warm & Conversational": "#10B981",
  "Great with Kids": "#F59E0B",
  "Patient with First-timers": "#8B5CF6",
  "Bilingual (Spanish)": "#EF4444",
  "Bilingual (Other)": "#EC4899",
  "Evidence-based": "#6366F1",
  "Holistic Approach": "#14B8A6",
  "Preventive Focus": "#22C55E",
  "Listens Carefully": "#F97316",
};

const WHO_I_SEE_COLORS: Record<string, string> = {
  "Adults only": "#0EA5E9",
  "Pediatric patients": "#F59E0B",
  "All ages": "#22C55E",
  "Geriatric focus": "#6366F1",
  "Women's health": "#EC4899",
};

const VISIT_APPROACH_COLORS: Record<string, string> = {
  "Thorough/detailed visits": "#8B5CF6",
  "Efficient/to the point": "#14B8A6",
  "Collaborative decision-making": "#F97316",
  "Education-focused": "#3B82F6",
};

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

// ─── Static Map Card ──────────────────────────────────────────────────────────
const StaticMapCard = ({
  location,
  name,
  colors,
  onDirections,
}: {
  location: { latitude: number; longitude: number };
  name: string;
  colors: any;
  onDirections: () => void;
}) => {
  const apiKey =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_STATIC_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const { latitude, longitude } = location;
  const mapUrl = apiKey
    ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=15&size=640x320&scale=2&markers=color:red%7C${latitude},${longitude}&key=${apiKey}`
    : null;

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View style={styles.mapHeaderRow}>
        <Text
          style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}
        >
          Location
        </Text>
        <TouchableOpacity
          style={[styles.directionsButton, { backgroundColor: colors.primary }]}
          onPress={onDirections}
          accessibilityRole="button"
        >
          <Ionicons name="navigate" size={14} color="#fff" />
          <Text style={styles.directionsButtonText}>Directions</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.mapContainer}>
        {mapUrl ? (
          <Image
            source={{ uri: mapUrl }}
            style={styles.staticMap}
            resizeMode="cover"
            accessibilityLabel={`Map showing location of ${name}`}
          />
        ) : (
          <TouchableOpacity
            style={[
              styles.mapPlaceholder,
              { backgroundColor: colors.background },
            ]}
            onPress={onDirections}
          >
            <Ionicons name="map-outline" size={36} color={colors.subtext} />
            <Text
              style={[styles.mapPlaceholderText, { color: colors.subtext }]}
            >
              Tap Directions to open in Maps
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Pricing Card ─────────────────────────────────────────────────────────────
// Shows honest pricing info — no static amounts.
// Real co-pay data requires EHR/insurance verification (roadmap Month 3-6).
const PricingCard = ({ colors }: { colors: any }) => (
  <View style={[styles.section, { backgroundColor: colors.card }]}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>
      Pricing & Co-pay
    </Text>
    <View
      style={[
        styles.pricingInfoBox,
        { backgroundColor: colors.background, borderColor: colors.border },
      ]}
    >
      <Ionicons
        name="information-circle-outline"
        size={20}
        color={colors.primary}
      />
      <Text style={[styles.pricingInfoText, { color: colors.text }]}>
        Pricing and co-pay information will be available once insurance
        verification is live. Contact the provider`&apos;`s office directly for
        cost estimates.
      </Text>
    </View>
    <Text style={[styles.pricingNote, { color: colors.subtext }]}>
      Most SoonerCare and Medicaid plans have $0 co-pay for primary care visits.
      Always confirm with your provider.
    </Text>
  </View>
);

// ─── Wait Time Card ───────────────────────────────────────────────────────────
const WaitTimeCard = ({
  typicalWaitDays,
  typicalWaitHours,
  avgVisitMinutes,
  colors,
}: {
  typicalWaitDays?: number;
  typicalWaitHours?: number;
  avgVisitMinutes?: number;
  colors: any;
}) => {
  const hasWait =
    typicalWaitDays !== undefined || typicalWaitHours !== undefined;

  const waitDisplay = !hasWait
    ? "—"
    : (typicalWaitDays ?? 0) > 0 && (typicalWaitHours ?? 0) > 0
      ? `${typicalWaitDays}d ${typicalWaitHours}h`
      : (typicalWaitDays ?? 0) > 0
        ? `${typicalWaitDays}d`
        : `${typicalWaitHours}h`;

  const visitDisplay =
    avgVisitMinutes === undefined
      ? "—"
      : avgVisitMinutes < 60
        ? `${avgVisitMinutes}m`
        : avgVisitMinutes % 60 === 0
          ? `${avgVisitMinutes / 60}h`
          : `${Math.floor(avgVisitMinutes / 60)}h ${avgVisitMinutes % 60}m`;

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Wait Time & Visit Length
      </Text>
      <View style={styles.waitTimeGrid}>
        <View
          style={[styles.waitTimeItem, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.waitTimeValue, { color: colors.primary }]}>
            {waitDisplay}
          </Text>
          <Text style={[styles.waitTimeLabel, { color: colors.subtext }]}>
            Avg wait for appt
          </Text>
        </View>
        <View
          style={[styles.waitTimeItem, { backgroundColor: colors.background }]}
        >
          <Text style={[styles.waitTimeValue, { color: colors.primary }]}>
            {visitDisplay}
          </Text>
          <Text style={[styles.waitTimeLabel, { color: colors.subtext }]}>
            Avg visit length
          </Text>
        </View>
      </View>
      {!hasWait && (
        <Text style={[styles.waitTimePlaceholder, { color: colors.subtext }]}>
          This provider has not yet configured wait time information.
        </Text>
      )}
    </View>
  );
};

// ─── Communication Style Card ─────────────────────────────────────────────────
const CommunicationStyleCard = ({
  communicationStyles,
  personalityTags,
  whoISee,
  visitApproach,
  colors,
}: {
  communicationStyles?: string[];
  personalityTags?: string[];
  whoISee?: string[];
  visitApproach?: string[];
  colors: any;
}) => {
  const styleTags = [
    ...(communicationStyles || []),
    ...(personalityTags || []),
  ];
  const whoTags = whoISee || [];
  const approachTags = visitApproach || [];
  const hasAny =
    styleTags.length > 0 || whoTags.length > 0 || approachTags.length > 0;

  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View style={styles.sectionHeader}>
        <Text
          style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}
        >
          Communication Style
        </Text>
        <View
          style={[
            styles.providerConfigBadge,
            { backgroundColor: colors.border },
          ]}
        >
          <Text style={[styles.providerConfigText, { color: colors.subtext }]}>
            Provider reported
          </Text>
        </View>
      </View>
      {hasAny ? (
        <View style={{ gap: 12 }}>
          {styleTags.length > 0 && (
            <View style={styles.tagGrid}>
              {styleTags.map((tag) => {
                const color = STYLE_TAG_COLORS[tag] || colors.primary;
                return (
                  <View
                    key={tag}
                    style={[
                      styles.styleTag,
                      {
                        backgroundColor: color + "20",
                        borderColor: color + "40",
                      },
                    ]}
                  >
                    <Text style={[styles.styleTagText, { color }]}>{tag}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {whoTags.length > 0 && (
            <>
              <Text style={[styles.tagGroupLabel, { color: colors.subtext }]}>
                WHO I SEE
              </Text>
              <View style={styles.tagGrid}>
                {whoTags.map((tag) => {
                  const color = WHO_I_SEE_COLORS[tag] || "#0EA5E9";
                  return (
                    <View
                      key={tag}
                      style={[
                        styles.styleTag,
                        {
                          backgroundColor: color + "20",
                          borderColor: color + "40",
                        },
                      ]}
                    >
                      <Text style={[styles.styleTagText, { color }]}>
                        {tag}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
          {approachTags.length > 0 && (
            <>
              <Text style={[styles.tagGroupLabel, { color: colors.subtext }]}>
                VISIT APPROACH
              </Text>
              <View style={styles.tagGrid}>
                {approachTags.map((tag) => {
                  const color = VISIT_APPROACH_COLORS[tag] || "#8B5CF6";
                  return (
                    <View
                      key={tag}
                      style={[
                        styles.styleTag,
                        {
                          backgroundColor: color + "20",
                          borderColor: color + "40",
                        },
                      ]}
                    >
                      <Text style={[styles.styleTagText, { color }]}>
                        {tag}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : (
        <Text style={[styles.waitTimePlaceholder, { color: colors.subtext }]}>
          This provider has not yet added their communication style.
        </Text>
      )}
    </View>
  );
};

// ─── Reviews Card ─────────────────────────────────────────────────────────────
const ReviewsCard = ({
  reviewCount,
  reviewAverage,
  colors,
  onBooking,
}: {
  reviewCount?: number;
  reviewAverage?: number;
  colors: any;
  onBooking: () => void;
}) => {
  const hasReviews = reviewCount !== undefined && reviewCount >= 3;
  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Patient Reviews
      </Text>
      {hasReviews ? (
        <View style={styles.reviewSummary}>
          <Text style={[styles.reviewAvgNumber, { color: colors.text }]}>
            {reviewAverage?.toFixed(1)}
          </Text>
          <View style={styles.reviewStars}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Ionicons
                key={star}
                name={
                  star <= Math.round(reviewAverage || 0)
                    ? "star"
                    : "star-outline"
                }
                size={18}
                color="#F59E0B"
              />
            ))}
            <Text style={[styles.reviewCount, { color: colors.subtext }]}>
              ({reviewCount} reviews)
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.reviewPlaceholder}>
          <Text style={styles.reviewPlaceholderIcon}>⭐</Text>
          <Text style={[styles.reviewPlaceholderTitle, { color: colors.text }]}>
            No reviews yet
          </Text>
          <Text
            style={[styles.reviewPlaceholderText, { color: colors.subtext }]}
          >
            Reviews appear after patients complete verified bookings. Book an
            appointment to be the first.
          </Text>
          <TouchableOpacity
            style={[styles.reviewBookBtn, { borderColor: colors.primary }]}
            onPress={onBooking}
          >
            <Text style={[styles.reviewBookBtnText, { color: colors.primary }]}>
              Book to Leave a Review
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── Interview Consult Card ───────────────────────────────────────────────────
const InterviewConsultCard = ({
  interviewConsult,
  colors,
  voucherParticipant,
  voucherEligible,
  voucherUsed,
  onBookVoucher,
}: {
  interviewConsult: Provider["interviewConsult"];
  colors: any;
  voucherParticipant?: boolean;
  voucherEligible?: boolean;
  voucherUsed?: boolean;
  onBookVoucher?: () => void;
}) => {
  if (!interviewConsult?.offered) return null;
  const showFreeVoucher = voucherParticipant && voucherEligible && !voucherUsed;
  return (
    <View style={[styles.section, { backgroundColor: colors.card }]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Text
          style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}
        >
          Meet & Greet Available
        </Text>
        {showFreeVoucher && (
          <View
            style={{
              backgroundColor: "#00BCD4",
              borderRadius: 99,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
              FREE with voucher
            </Text>
          </View>
        )}
      </View>
      <View style={[styles.consultBox, { backgroundColor: colors.background }]}>
        <View style={styles.consultHeader}>
          <Text style={[styles.consultPrice, { color: colors.primary }]}>
            {showFreeVoucher
              ? "Free"
              : interviewConsult.price > 0
                ? `$${interviewConsult.price}`
                : "Free"}
          </Text>
          <Text style={[styles.consultDuration, { color: colors.subtext }]}>
            {interviewConsult.duration} minutes
          </Text>
        </View>
        <Text style={[styles.consultDescription, { color: colors.text }]}>
          {interviewConsult.description ||
            "Schedule a brief consultation to meet the provider and discuss your healthcare needs."}
        </Text>
        {showFreeVoucher && onBookVoucher && (
          <TouchableOpacity
            onPress={onBookVoucher}
            style={{
              marginTop: 12,
              backgroundColor: "#00BCD4",
              borderRadius: 10,
              padding: 12,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
              Book Free Meet & Greet
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

// ─── Unverified Disclaimer Banner ─────────────────────────────────────────────
// Shows on profiles that haven't been claimed by the provider yet.
// Protects Morava legally — data is from public sources, may be outdated.
const UnverifiedDisclaimer = ({ colors }: { colors: any }) => (
  <View
    style={[
      styles.unverifiedBanner,
      { backgroundColor: "#F59E0B15", borderColor: "#F59E0B40" },
    ]}
  >
    <Ionicons name="alert-circle-outline" size={18} color="#F59E0B" />
    <Text style={[styles.unverifiedText, { color: "#92400E" }]}>
      This profile has not been claimed by the provider. Information is sourced
      from public records and may be outdated. Verify details directly with the
      provider before booking.
    </Text>
  </View>
);

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ProviderDetailScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const { user } = useAuth();
  const [provider, setProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [voucherEligible, setVoucherEligible] = useState(false);
  const [voucherUsed, setVoucherUsed] = useState(false);

  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const loadProvider = useCallback(async () => {
    try {
      if (!id || typeof id !== "string") {
        Alert.alert("Error", "Invalid provider ID");
        router.back();
        return;
      }
      setLoading(true);
      const docSnap = await getDoc(doc(db, "providers", id));
      if (!docSnap.exists()) {
        Alert.alert(
          "Provider Not Found",
          "This provider could not be loaded.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const data = docSnap.data();

      let safeRating = 0;
      if (typeof data.rating === "number") safeRating = data.rating;
      else if (typeof data.rating === "string") {
        const p = parseFloat(data.rating);
        safeRating = isNaN(p) ? 0 : p;
      }

      const safeLatitude =
        typeof data.latitude === "number" ? data.latitude : 35.4676;
      const safeLongitude =
        typeof data.longitude === "number" ? data.longitude : -97.5164;

      let safeInsurance: string[] = [];
      if (Array.isArray(data.insuranceAccepted))
        safeInsurance = data.insuranceAccepted;
      else if (typeof data.insuranceAccepted === "string")
        safeInsurance = [data.insuranceAccepted];

      let resolvedLanguages = "";
      if (typeof data.languages === "string" && data.languages) {
        resolvedLanguages = data.languages;
      } else if (
        Array.isArray(data.languagesSpoken) &&
        data.languagesSpoken.length > 0
      ) {
        resolvedLanguages = data.languagesSpoken.join(", ");
      }

      setProvider({
        id: docSnap.id,
        name: typeof data.name === "string" ? data.name : "Unknown Provider",
        specialty:
          typeof data.specialty === "string" ? data.specialty : "General",
        address: typeof data.address === "string" ? data.address : "",
        phone: typeof data.phone === "string" ? data.phone : "",
        rating: safeRating,
        acceptsNewPatients:
          data.acceptingNewPatients ?? data.acceptsNewPatients ?? true,
        telehealth: data.telehealth === true,
        inPerson: data.inPerson !== false,
        telehealthOnly: data.telehealthOnly === true,
        insuranceAccepted: safeInsurance,
        location: { latitude: safeLatitude, longitude: safeLongitude },
        latitude: safeLatitude,
        longitude: safeLongitude,
        city: typeof data.city === "string" ? data.city : "",
        state: typeof data.state === "string" ? data.state : "Oklahoma",
        verified: data.verified === true,
        profilePicture:
          typeof data.profilePicture === "string" ? data.profilePicture : "",
        welcomeMessage:
          typeof data.welcomeMessage === "string" ? data.welcomeMessage : "",
        aboutMe:
          typeof data.bio === "string" && data.bio
            ? data.bio
            : typeof data.aboutMe === "string"
              ? data.aboutMe
              : "",
        languages: resolvedLanguages,
        specialInterests: Array.isArray(data.specialInterests)
          ? data.specialInterests
          : [],
        education: Array.isArray(data.education) ? data.education : [],
        languagesSpoken: Array.isArray(data.languagesSpoken)
          ? data.languagesSpoken
          : [],
        boardCertifications: Array.isArray(data.boardCertifications)
          ? data.boardCertifications
          : [],
        interviewConsult: data.interviewConsult || null,
        voucherParticipant: data.voucherParticipant === true,
        communicationStyles: Array.isArray(data.communicationStyles)
          ? data.communicationStyles
          : [],
        personalityTags: Array.isArray(data.personalityTags)
          ? data.personalityTags
          : [],
        whoISee: Array.isArray(data.whoISee) ? data.whoISee : [],
        visitApproach: Array.isArray(data.visitApproach)
          ? data.visitApproach
          : [],
        typicalWaitDays:
          typeof data.typicalWaitDays === "number"
            ? data.typicalWaitDays
            : undefined,
        typicalWaitHours:
          typeof data.typicalWaitHours === "number"
            ? data.typicalWaitHours
            : undefined,
        avgVisitMinutes:
          typeof data.avgVisitMinutes === "number"
            ? data.avgVisitMinutes
            : undefined,
        officeNotes:
          typeof data.officeNotes === "string" ? data.officeNotes : "",
        reviewCount:
          typeof data.reviewCount === "number" ? data.reviewCount : undefined,
        reviewAverage:
          typeof data.reviewAverage === "number"
            ? data.reviewAverage
            : undefined,
        website:
          typeof data.website === "string" && data.website ? data.website : "",
      });
      logAnalyticsEvent("provider_viewed", {
        providerId: typeof id === "string" ? id : "",
        specialty: data.specialty || "",
        verified: data.verified ?? false,
      });
    } catch (error) {
      if (__DEV__) console.error("Error loading provider:", error);
      Alert.alert("Error", "Could not load provider details", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  const checkIfFavorite = useCallback(async () => {
    try {
      const key = getFavoritesKey();
      const favs = await AsyncStorage.getItem(key);
      if (favs) setIsFavorite(JSON.parse(favs).includes(id));
    } catch {
      /* non-critical */
    }
  }, [id]);

  const fetchVoucherStatus = useCallback(async () => {
    if (!user || user.isAnonymous) return;
    try {
      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setVoucherEligible(data.voucherEligible === true);
        setVoucherUsed(data.voucherUsed === true);
      }
    } catch (e) {
      if (__DEV__) console.warn("Voucher fetch failed:", e);
    }
  }, [user]);

  useEffect(() => {
    loadProvider();
    checkIfFavorite();
    fetchVoucherStatus();
  }, [loadProvider, checkIfFavorite, fetchVoucherStatus]);

  const handleCall = () => {
    if (provider?.phone) Linking.openURL(`tel:${provider.phone}`);
  };

  const handleDirections = async () => {
    if (!provider?.location) return;
    const { latitude, longitude } = provider.location;
    const nativeUrl =
      Platform.OS === "ios"
        ? `maps://?daddr=${latitude},${longitude}`
        : `geo:${latitude},${longitude}?q=${latitude},${longitude}`;
    const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      Linking.openURL(canOpen ? nativeUrl : webFallback);
    } catch {
      Linking.openURL(webFallback);
    }
  };

  const toggleFavorite = async () => {
    try {
      const key = getFavoritesKey();
      const favs = await AsyncStorage.getItem(key);
      let favorites = favs ? JSON.parse(favs) : [];
      favorites = isFavorite
        ? favorites.filter((f: string) => f !== id)
        : [...favorites, id];
      await AsyncStorage.setItem(key, JSON.stringify(favorites));
      setIsFavorite(!isFavorite);
    } catch {
      /* non-critical */
    }
  };

  const handleBooking = () => {
    if (id) router.push(`/booking/${id}` as any);
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
          Loading provider...
        </Text>
      </View>
    );
  }

  if (!provider) {
    return (
      <View
        style={[
          styles.container,
          styles.centerContainer,
          { backgroundColor: colors.background },
        ]}
      >
        <Text style={[styles.errorText, { color: colors.text }]}>
          Provider not found
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const hasSoonerCare =
    provider.insuranceAccepted.includes("SoonerCare") ||
    provider.insuranceAccepted.includes("Medicaid");
  const acceptingPatients =
    provider.acceptsNewPatients ?? provider.acceptingNewPatients ?? true;
  const isTelehealthOnly = provider.telehealthOnly === true;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          {provider.profilePicture?.startsWith("http") ? (
            <Image
              source={{ uri: provider.profilePicture }}
              style={styles.profilePic}
            />
          ) : (
            <View
              style={[
                styles.placeholderPic,
                { backgroundColor: colors.primary },
              ]}
            >
              <Text style={styles.placeholderText}>
                {normalizeProviderName(provider.name).charAt(0)}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <View style={styles.nameRow}>
              <Text
                style={[styles.name, { color: colors.text }]}
                numberOfLines={2}
              >
                {normalizeProviderName(provider.name)}
              </Text>
            </View>

            {/* Verified badge — prominent row below name */}
            {provider.verified ? (
              <View style={styles.verifiedRow}>
                <View
                  style={[
                    styles.verifiedBadgeLarge,
                    { backgroundColor: colors.success },
                  ]}
                >
                  <Ionicons name="checkmark-circle" size={14} color="#fff" />
                  <Text style={styles.verifiedTextLarge}>
                    Verified Provider
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.verifiedRow}>
                <View
                  style={[
                    styles.unverifiedBadge,
                    { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" },
                  ]}
                >
                  <Ionicons
                    name="alert-circle-outline"
                    size={13}
                    color="#F59E0B"
                  />
                  <Text
                    style={[styles.unverifiedBadgeText, { color: "#92400E" }]}
                  >
                    Profile not yet claimed
                  </Text>
                </View>
              </View>
            )}

            <Text style={[styles.specialty, { color: colors.primary }]}>
              {provider.specialty}
            </Text>
            <View style={styles.badgeRow}>
              {isTelehealthOnly ? (
                <View
                  style={[styles.visitBadge, { backgroundColor: "#3B82F615" }]}
                >
                  <Ionicons name="videocam-outline" size={11} color="#3B82F6" />
                  <Text style={[styles.visitBadgeText, { color: "#3B82F6" }]}>
                    Virtual Care Only
                  </Text>
                </View>
              ) : (
                <>
                  {provider.inPerson !== false && (
                    <View
                      style={[
                        styles.visitBadge,
                        { backgroundColor: colors.primary + "20" },
                      ]}
                    >
                      <Ionicons
                        name="business-outline"
                        size={11}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.visitBadgeText,
                          { color: colors.primary },
                        ]}
                      >
                        In-Person
                      </Text>
                    </View>
                  )}
                  {provider.telehealth === true && (
                    <View
                      style={[
                        styles.visitBadge,
                        { backgroundColor: "#6366F120" },
                      ]}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={11}
                        color="#6366F1"
                      />
                      <Text
                        style={[styles.visitBadgeText, { color: "#6366F1" }]}
                      >
                        Telehealth
                      </Text>
                    </View>
                  )}
                </>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity onPress={toggleFavorite} style={styles.favoriteBtn}>
          <Ionicons
            name={isFavorite ? "heart" : "heart-outline"}
            size={28}
            color={isFavorite ? colors.error : colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Unverified disclaimer — shown below header for unclaimed profiles */}
      {!provider.verified && <UnverifiedDisclaimer colors={colors} />}

      {/* Virtual Care Only banner */}
      {isTelehealthOnly && (
        <View
          style={[
            styles.telehealthOnlyBanner,
            {
              backgroundColor: "#3B82F615",
              borderColor: "#3B82F640",
            },
          ]}
        >
          <Ionicons name="videocam" size={18} color="#3B82F6" />
          <Text style={[styles.telehealthOnlyText, { color: "#3B82F6" }]}>
            This provider offers virtual care only. In-person visits are not
            available.
          </Text>
        </View>
      )}

      {/* Office notes */}
      {!!provider.officeNotes && (
        <View
          style={[styles.section, { backgroundColor: colors.primary + "15" }]}
        >
          <Text style={[styles.officeNotesTitle, { color: colors.primary }]}>
            📌 From the Office
          </Text>
          <Text style={[styles.officeNotesText, { color: colors.text }]}>
            {provider.officeNotes}
          </Text>
        </View>
      )}

      {/* Welcome message */}
      {!!provider.welcomeMessage && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.welcomeMessage, { color: colors.text }]}>
            {provider.welcomeMessage}
          </Text>
        </View>
      )}

      {/* About */}
      {!!provider.aboutMe && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            About
          </Text>
          <Text style={[styles.aboutText, { color: colors.text }]}>
            {provider.aboutMe}
          </Text>
        </View>
      )}

      <CommunicationStyleCard
        communicationStyles={provider.communicationStyles}
        personalityTags={provider.personalityTags}
        whoISee={provider.whoISee}
        visitApproach={provider.visitApproach}
        colors={colors}
      />

      <WaitTimeCard
        typicalWaitDays={provider.typicalWaitDays}
        typicalWaitHours={provider.typicalWaitHours}
        avgVisitMinutes={provider.avgVisitMinutes}
        colors={colors}
      />

      <ReviewsCard
        reviewCount={provider.reviewCount}
        reviewAverage={provider.reviewAverage}
        colors={colors}
        onBooking={handleBooking}
      />

      {provider.specialInterests && provider.specialInterests.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Special Interests
          </Text>
          <View style={styles.interestsContainer}>
            {provider.specialInterests.map((interest, index) => (
              <View
                key={index}
                style={[
                  styles.interestChip,
                  { backgroundColor: colors.primary },
                ]}
              >
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {provider.education && provider.education.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Education
          </Text>
          {provider.education.map((edu, index) => (
            <View key={index} style={styles.educationItem}>
              <Text style={[styles.degree, { color: colors.text }]}>
                {edu.degree}
              </Text>
              <Text style={[styles.school, { color: colors.subtext }]}>
                {edu.school} • {edu.year}
              </Text>
            </View>
          ))}
        </View>
      )}

      {!!provider.languages && (
        <View style={[styles.section, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Languages Spoken
          </Text>
          <Text style={[styles.languages, { color: colors.text }]}>
            {provider.languages}
          </Text>
        </View>
      )}

      {provider.boardCertifications &&
        provider.boardCertifications.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Board Certifications
            </Text>
            {provider.boardCertifications.map((cert, index) => (
              <Text
                key={index}
                style={[styles.certification, { color: colors.text }]}
              >
                • {cert}
              </Text>
            ))}
          </View>
        )}

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primary }]}
          onPress={handleCall}
          accessibilityRole="button"
        >
          <Ionicons name="call" size={20} color="#fff" />
          <Text style={styles.actionText}>Call Provider</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Contact Information
        </Text>
        {!!provider.address && (
          <View style={styles.infoRow}>
            <Ionicons name="location" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {provider.address}
            </Text>
          </View>
        )}
        {!!provider.phone && (
          <View style={styles.infoRow}>
            <Ionicons name="call" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.text }]}>
              {provider.phone}
            </Text>
          </View>
        )}

        {isTelehealthOnly && (
          <View style={styles.infoRow}>
            <Ionicons name="videocam" size={20} color="#3B82F6" />
            <Text style={[styles.infoText, { color: "#3B82F6" }]}>
              Virtual care only — no in-person visits
            </Text>
          </View>
        )}
        {!isTelehealthOnly && provider.telehealth === true && (
          <View style={styles.infoRow}>
            <Ionicons name="videocam" size={20} color="#6366F1" />
            <Text style={[styles.infoText, { color: colors.text }]}>
              Telehealth / Virtual visits available
            </Text>
          </View>
        )}
        {!!provider.website && (
          <TouchableOpacity
            style={styles.infoRow}
            onPress={() =>
              Linking.openURL(
                provider.website!.startsWith("http")
                  ? provider.website!
                  : `https://${provider.website!}`,
              )
            }
          >
            <Ionicons name="globe-outline" size={20} color={colors.primary} />
            <Text
              style={[styles.infoText, { color: colors.primary }]}
              numberOfLines={1}
            >
              {provider.website}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.card }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Insurance Accepted
        </Text>
        {hasSoonerCare && (
          <View
            style={[
              styles.soonerCareHighlight,
              { backgroundColor: colors.success },
            ]}
          >
            <Text style={styles.soonerCareText}>
              ✓ Accepts SoonerCare / Medicaid
            </Text>
          </View>
        )}
        {provider.insuranceAccepted.length > 0 && (
          <Text style={[styles.insuranceList, { color: colors.text }]}>
            {provider.insuranceAccepted.join(", ")}
          </Text>
        )}
      </View>

      {/* Pricing — no static amounts, honest info only */}
      <PricingCard colors={colors} />

      <InterviewConsultCard
        interviewConsult={provider.interviewConsult}
        colors={colors}
        voucherParticipant={provider.voucherParticipant}
        voucherEligible={voucherEligible}
        voucherUsed={voucherUsed}
        onBookVoucher={handleBooking}
      />

      {acceptingPatients ? (
        <View
          style={[styles.section, { backgroundColor: colors.success + "20" }]}
        >
          <Text style={[styles.acceptingText, { color: colors.success }]}>
            ✓ Currently Accepting New Patients
          </Text>
        </View>
      ) : (
        <View style={[styles.section, { backgroundColor: colors.border }]}>
          <Text style={[styles.acceptingText, { color: colors.subtext }]}>
            Not Currently Accepting New Patients
          </Text>
        </View>
      )}

      {provider.location && !isTelehealthOnly && (
        <StaticMapCard
          location={provider.location}
          name={provider.name}
          colors={colors}
          onDirections={handleDirections}
        />
      )}

      <View style={styles.bookContainer}>
        <TouchableOpacity
          style={[
            styles.bookButton,
            {
              backgroundColor: acceptingPatients
                ? colors.primary
                : colors.border,
            },
          ]}
          disabled={!acceptingPatients}
          activeOpacity={0.7}
          onPress={handleBooking}
        >
          <Text style={styles.bookButtonText}>
            {acceptingPatients
              ? "Book Appointment"
              : "Not Accepting New Patients"}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorText: { fontSize: 18, marginBottom: 20 },
  backButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: { padding: 8, marginRight: 8 },
  headerContent: { flex: 1, flexDirection: "row", alignItems: "center" },
  profilePic: { width: 70, height: 70, borderRadius: 35, marginRight: 12 },
  placeholderPic: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: { color: "#fff", fontSize: 28, fontWeight: "bold" },
  headerText: { flex: 1 },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  name: { fontSize: 18, fontWeight: "bold", flex: 1 },
  // ── Verified / Unverified badges ─────────────────────────────────────────
  verifiedRow: { marginBottom: 4 },
  verifiedBadgeLarge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedTextLarge: { color: "#fff", fontSize: 12, fontWeight: "700" },
  unverifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  unverifiedBadgeText: { fontSize: 11, fontWeight: "600" },
  // ── Unverified disclaimer banner ─────────────────────────────────────────
  unverifiedBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  unverifiedText: { flex: 1, fontSize: 13, lineHeight: 18 },
  specialty: { fontSize: 14, fontWeight: "600", marginBottom: 6 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  visitBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  visitBadgeText: { fontSize: 11, fontWeight: "600" },
  favoriteBtn: { padding: 8 },
  telehealthOnlyBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  telehealthOnlyText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  officeNotesTitle: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  officeNotesText: { fontSize: 14, lineHeight: 20 },
  section: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: "bold", marginBottom: 12 },
  providerConfigBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  providerConfigText: { fontSize: 10, fontWeight: "600" },
  // ── Pricing card ─────────────────────────────────────────────────────────
  pricingInfoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
  },
  pricingInfoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  pricingNote: { fontSize: 12, lineHeight: 17, fontStyle: "italic" },
  waitTimeGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 4,
    marginTop: 4,
  },
  waitTimeItem: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  waitTimeValue: { fontSize: 28, fontWeight: "bold", marginBottom: 4 },
  waitTimeLabel: { fontSize: 11, textAlign: "center", lineHeight: 14 },
  waitTimePlaceholder: {
    fontSize: 13,
    lineHeight: 18,
    fontStyle: "italic",
    marginTop: 4,
  },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagGroupLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  styleTag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  styleTagText: { fontSize: 12, fontWeight: "600" },
  reviewSummary: { flexDirection: "row", alignItems: "center", gap: 12 },
  reviewAvgNumber: { fontSize: 40, fontWeight: "bold" },
  reviewStars: { flexDirection: "row", alignItems: "center", gap: 2 },
  reviewCount: { fontSize: 13, marginLeft: 4 },
  reviewPlaceholder: { alignItems: "center", paddingVertical: 16 },
  reviewPlaceholderIcon: { fontSize: 36, marginBottom: 8 },
  reviewPlaceholderTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  reviewPlaceholderText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 16,
  },
  reviewBookBtn: {
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  reviewBookBtnText: { fontSize: 14, fontWeight: "600" },
  mapHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  directionsButtonText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  mapContainer: { borderRadius: 10, overflow: "hidden", height: 180 },
  staticMap: { width: "100%", height: "100%" },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  mapPlaceholderText: { fontSize: 14 },
  welcomeMessage: { fontSize: 15, lineHeight: 22, fontStyle: "italic" },
  aboutText: { fontSize: 15, lineHeight: 22 },
  interestsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  interestText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  educationItem: { marginBottom: 12 },
  degree: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  school: { fontSize: 14 },
  languages: { fontSize: 15 },
  certification: { fontSize: 14, marginBottom: 6 },
  actionsContainer: { paddingHorizontal: 16, marginTop: 16 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionText: { color: "#fff", fontSize: 15, fontWeight: "600" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  infoText: { fontSize: 14, flex: 1 },
  soonerCareHighlight: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 12,
  },
  soonerCareText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  insuranceList: { fontSize: 14, lineHeight: 20 },
  consultBox: { padding: 16, borderRadius: 8 },
  consultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  consultPrice: { fontSize: 24, fontWeight: "bold" },
  consultDuration: { fontSize: 14 },
  consultDescription: { fontSize: 14, lineHeight: 20 },
  acceptingText: { fontSize: 15, fontWeight: "bold", textAlign: "center" },
  bookContainer: { paddingHorizontal: 16, marginTop: 16 },
  bookButton: { paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  bookButtonText: { color: "#fff", fontSize: 17, fontWeight: "bold" },
});
