import { CircleIconButton } from '@/components/ui/CircleIconButton';
import { AgentRow } from '@/components/agency/AgentRow';
import { APP_MAP_USER_INTERFACE_STYLE } from '@/constants/maps';
import { colors, radii, spacing } from '@/constants/theme';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { getAgency } from '@/lib/mock-agencies';
import {
  getPropertyById,
  getPropertyGallery,
} from '@/lib/mock-properties';
import {
  buildPropertyDetailRows,
  formatDistance,
  getNeighborhoodPlaces,
  NEIGHBORHOOD_KIND_META
} from '@/lib/neighborhood';
import { resolvePropertyFeatures } from '@/lib/property-features';
import { propertyMapViewPath } from '@/lib/property-map-views';
import {
  propertyPriceLabel,
  propertyStatusLabel,
  resolvePropertyMapViews,
  type Property,
  type PropertyMapView,
} from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAP_HEIGHT = 400;
/** Show footer CTAs once the user has scrolled past most of the map hero. */
const CTA_SCROLL_THRESHOLD = MAP_HEIGHT * 0.4;
const DESCRIPTION_PREVIEW_LINES = 4;
const NEIGHBORHOOD_MAP_HEIGHT = 200;

const MAP_VIEW_META: Record<
  PropertyMapView,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    pinIcon: keyof typeof Ionicons.glyphMap;
  }
> = {
  neighborhood: {
    label: 'Voisinage',
    icon: 'map-outline',
    pinIcon: 'location-outline',
  },
  streetView: {
    label: 'Street View',
    icon: 'scan-outline',
    pinIcon: 'navigate-outline',
  },
  tour360: {
    label: 'Visite 360°',
    icon: 'globe-outline',
    pinIcon: 'eye-outline',
  },
};

function buildAmenities(property: Property): Array<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}> {
  const amenities: Array<{
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }> = [];
  if (property.floor) {
    amenities.push({ icon: 'business-outline', label: property.floor });
  }
  if (property.bedrooms != null) {
    amenities.push({
      icon: 'bed-outline',
      label: `${property.bedrooms} ch.`,
    });
  }
  if (property.bathrooms != null) {
    amenities.push({
      icon: 'water-outline',
      label: `${property.bathrooms} sdb`,
    });
  }
  if (property.surface) {
    amenities.push({ icon: 'resize-outline', label: property.surface });
  }
  return amenities.slice(0, 3);
}

export default function PropertyScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [favorited, setFavorited] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMapView, setActiveMapView] =
    useState<PropertyMapView>('neighborhood');
  const ctaVisibleRef = useRef(false);
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const scrollYOffsetRef = useRef(0);

  const property = useMemo(() => getPropertyById(String(id ?? '')), [id]);
  const gallery = useMemo(
    () => (property ? getPropertyGallery(property) : []),
    [property],
  );
  const amenities = useMemo(
    () => (property ? buildAmenities(property) : []),
    [property],
  );
  const features = useMemo(
    () => resolvePropertyFeatures(property?.features),
    [property],
  );
  const detailRows = useMemo(
    () => (property ? buildPropertyDetailRows(property) : []),
    [property],
  );
  const neighborhood = useMemo(
    () => (property ? getNeighborhoodPlaces(property) : []),
    [property],
  );
  const mapViews = useMemo(
    () => (property ? resolvePropertyMapViews(property) : []),
    [property],
  );

  useEffect(() => {
    if (mapViews.length === 0) return;
    if (!mapViews.includes(activeMapView)) {
      setActiveMapView(mapViews[0]!);
    }
  }, [activeMapView, mapViews]);

  useEffect(() => {
    Animated.timing(ctaAnim, {
      toValue: showCta ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [ctaAnim, showCta]);

  useEffect(() => {
    const propertyId = String(id ?? '');
    if (!propertyId) return;
    let cancelled = false;
    void isFavorite(propertyId).then((value) => {
      if (!cancelled) setFavorited(value);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ): void => {
    const y = event.nativeEvent.contentOffset.y;
    scrollYOffsetRef.current = y;
    const next = y >= CTA_SCROLL_THRESHOLD;
    if (next === ctaVisibleRef.current) return;
    ctaVisibleRef.current = next;
    setShowCta(next);
  };

  if (!property) {
    return (
      <View style={[styles.missing, { paddingTop: insets.top + spacing.lg }]}>
        <Text style={styles.missingTitle}>Bien introuvable</Text>
        <Pressable
          onPress={() => router.back()}
          style={styles.missingBtn}
          accessibilityRole="button"
        >
          <Text style={styles.missingBtnText}>Retour</Text>
        </Pressable>
      </View>
    );
  }

  const statusLabel = propertyStatusLabel(property);
  const priceLabel = propertyPriceLabel(property);
  const previewPhotos = gallery.slice(0, 4);
  const isShortStay = property.mode === 'RENT_SHORT';
  const ctaLabel = isShortStay ? 'Réserver' : 'Réserver une visite';

  const handleCtaPress = (): void => {
    if (property.mode === 'RENT_SHORT') {
      router.push(`/property/${property.id}/book`);
      return;
    }
    router.push(`/property/${property.id}/visit`);
  };

  const handleToggleFavorite = (): void => {
    const next = !favorited;
    setFavorited(next);
    void toggleFavorite(property.id).catch(() => {
      setFavorited(!next);
    });
  };

  const handleShare = async (): Promise<void> => {
    try {
      await Share.share({
        message: `${property.title} — ${priceLabel}\n${property.location ?? ''}`,
      });
    } catch {
      // user dismissed
    }
  };

  const handleMapViewPress = (view: PropertyMapView): void => {
    setActiveMapView(view);
    router.push(propertyMapViewPath(property.id, view));
  };

  const handleSeeAllPhotos = (startIndex = 0): void => {
    router.push({
      pathname: '/property/[id]/gallery',
      params: { id: property.id, index: String(startIndex) },
    });
  };

  const activeMapMeta = MAP_VIEW_META[activeMapView];

  return (
    <View style={styles.screen}>
      <View
        style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}
        pointerEvents="box-none"
      >
        <CircleIconButton
          onPress={() => router.back()}
          accessibilityLabel="Retour"
        >
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </CircleIconButton>

        <View style={styles.topActions}>
          <CircleIconButton
            onPress={() => void handleShare()}
            accessibilityLabel="Partager"
          >
            <Ionicons
              name="share-social"
              size={23}
              color={colors.ink}
              style={{ marginRight: 2, marginTop: 2 }}
            />
          </CircleIconButton>
          <CircleIconButton
            onPress={handleToggleFavorite}
            accessibilityLabel={
              favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'
            }
          >
            <Ionicons
              name={favorited ? 'heart' : 'heart-outline'}
              size={24}
              color={favorited ? colors.danger : colors.ink}
            />
          </CircleIconButton>
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + (showCta ? 100 : 32),
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.mapHero}>
          <View style={[styles.mapFrame, { height: MAP_HEIGHT + insets.top }]}>
            <MapView
              style={StyleSheet.absoluteFill}
              initialRegion={{
                latitude: property.lat,
                longitude: property.lng,
                latitudeDelta: 0.012,
                longitudeDelta: 0.012,
              }}
              userInterfaceStyle={APP_MAP_USER_INTERFACE_STYLE}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              pointerEvents="none"
            />

            <LinearGradient
              colors={[
                'rgba(247, 247, 253, 0.25)',
                'rgba(247, 247, 253, 0.55)',
                colors.bg,
              ]}
              locations={[0, 0.45, 1]}
              style={styles.mapGradient}
              pointerEvents="none"
            />

            <View style={styles.mapCenterChrome} pointerEvents="box-none">
              <View style={styles.mapPinOuter}>
                <View style={styles.mapPinInner}>
                  <Ionicons
                    name={activeMapMeta.pinIcon}
                    size={20}
                    color={colors.ink}
                  />
                </View>
              </View>
              {mapViews.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.mapViewScroll}
                  contentContainerStyle={styles.mapViewRow}
                >
                  {mapViews.map((view) => {
                    const meta = MAP_VIEW_META[view];
                    const active = activeMapView === view;
                    return (
                      <Pressable
                        key={view}
                        onPress={() => handleMapViewPress(view)}
                        style={[
                          styles.mapViewChip,
                          active && styles.mapViewChipActive,
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityLabel={meta.label}
                      >
                        <Ionicons
                          name={meta.icon}
                          size={15}
                          color={active ? colors.ink : colors.surface}
                        />
                        <Text
                          style={[
                            styles.mapViewChipText,
                            active && styles.mapViewChipTextActive,
                          ]}
                        >
                          {meta.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
            </View>
          </View>

          <View style={styles.overlayContent}>
            <View style={styles.metaRow}>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={15} color={colors.primary} />
                <Text style={styles.location} numberOfLines={1}>
                  {property.location ?? 'Congo'}
                </Text>
              </View>
              <Text style={styles.price}>{priceLabel}</Text>
            </View>

            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={2}>
                {property.title}
              </Text>
              <View style={styles.brandMark}>
                <Image
                  source={require('@/assets/logo-paradis-immo.png')}
                  style={styles.brandLogo}
                  resizeMode="contain"
                />
              </View>
            </View>

            <View style={styles.trustRow}>
              <View style={styles.statusBadge}>
                <Text style={styles.statusBadgeText}>{statusLabel}</Text>
              </View>
              <View style={styles.verifiedChip}>
                <Ionicons
                  name="checkmark-circle"
                  size={16}
                  color={colors.success}
                />
                <Text style={styles.verifiedText}>
                  Annonce vérifiée ·{' '}
                  {getAgency(property.agencyId)?.shortName ?? 'Agence'}
                </Text>
              </View>
            </View>

            {amenities.length > 0 ? (
              <View style={styles.featureRow}>
                {amenities.map((item) => (
                  <View key={item.label} style={styles.featureCard}>
                    <Ionicons
                      name={item.icon}
                      size={20}
                      color={colors.primary}
                    />
                    <Text style={styles.featureLabel}>{item.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.belowContent}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <View style={styles.gallery}>
            <View style={styles.galleryLandscapeCol}>
              {previewPhotos[0] ? (
                <Pressable
                  onPress={() => handleSeeAllPhotos(0)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Voir la photo 1"
                >
                  <GalleryImage source={previewPhotos[0]} />
                </Pressable>
              ) : null}
              {previewPhotos[1] ? (
                <Pressable
                  onPress={() => handleSeeAllPhotos(1)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Voir la photo 2"
                >
                  <GalleryImage source={previewPhotos[1]} />
                </Pressable>
              ) : null}
            </View>
            <View style={styles.gallerySquareCol}>
              {previewPhotos[2] ? (
                <Pressable
                  onPress={() => handleSeeAllPhotos(2)}
                  accessibilityRole="imagebutton"
                  accessibilityLabel="Voir la photo 3"
                >
                  <GalleryImage source={previewPhotos[2]} square />
                </Pressable>
              ) : null}
              <Pressable
                style={styles.gallerySquareCell}
                onPress={() => handleSeeAllPhotos(3)}
                accessibilityRole="button"
                accessibilityLabel={`Tout afficher (${gallery.length})`}
              >
                {previewPhotos[3] ? (
                  <Image
                    source={previewPhotos[3]}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      StyleSheet.absoluteFill,
                      styles.galleryPlaceholder,
                    ]}
                  />
                )}
                <View style={styles.galleryMoreOverlay}>
                  <Text style={styles.galleryMoreText}>
                    Tout afficher ({gallery.length})
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {property.description ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text
                style={styles.description}
                numberOfLines={
                  descriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES
                }
              >
                {property.description}
              </Text>
              {property.description.length > 140 ? (
                <Pressable
                  onPress={() => setDescriptionExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    descriptionExpanded
                      ? 'Réduire la description'
                      : 'Lire toute la description'
                  }
                  hitSlop={8}
                >
                  <Text style={styles.descriptionToggle}>
                    {descriptionExpanded ? 'Réduire' : 'Lire la suite'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {features.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Équipements</Text>
              <Text style={styles.sectionSubtitle}>
                Ce que propose ce bien
              </Text>
              <View style={styles.featuresGrid}>
                {features.map((item) => (
                  <View key={item.id} style={styles.featureItem}>
                    <View style={styles.featureIconWrap}>
                      <Ionicons
                        name={item.icon}
                        size={18}
                        color={colors.primary}
                      />
                    </View>
                    <Text style={styles.featureItemLabel} numberOfLines={2}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {detailRows.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Détails du bien</Text>
              <Text style={styles.sectionSubtitle}>
                Informations techniques et administratives
              </Text>
              <View style={styles.detailsCard}>
                {detailRows.map((row, index) => (
                  <View
                    key={row.key}
                    style={[
                      styles.detailRow,
                      index < detailRows.length - 1 && styles.detailRowBorder,
                    ]}
                  >
                    <View style={styles.detailLeft}>
                      <Ionicons
                        name={row.icon}
                        size={16}
                        color={colors.primary}
                      />
                      <Text style={styles.detailLabel}>{row.label}</Text>
                    </View>
                    <Text style={styles.detailValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {neighborhood.length > 0 ? (
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionTitle}>Voisinage</Text>
              <Text style={styles.sectionSubtitle}>
                Services et lieux à proximité
              </Text>

              <View style={styles.neighborhoodList}>
                {neighborhood.map((place) => {
                  const meta = NEIGHBORHOOD_KIND_META[place.kind];
                  return (
                    <View key={place.id} style={styles.neighborhoodItem}>
                      <View style={styles.neighborhoodIcon}>
                        <Ionicons
                          name={meta.icon}
                          size={18}
                          color={colors.primary}
                        />
                      </View>
                      <View style={styles.neighborhoodBody}>
                        <Text style={styles.neighborhoodName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text style={styles.neighborhoodKind}>
                          {meta.label}
                        </Text>
                      </View>
                      <View style={styles.neighborhoodMeta}>
                        <Text style={styles.neighborhoodDistance}>
                          {formatDistance(place.distanceMeters)}
                        </Text>
                        <Text style={styles.neighborhoodTime}>
                          {place.walkMinutes} min
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Animated.View
        pointerEvents={showCta ? 'auto' : 'none'}
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            opacity: ctaAnim,
            transform: [
              {
                translateY: ctaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [72, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.ctaPrimary,
            pressed && styles.ctaPrimaryPressed,
          ]}
          onPress={handleCtaPress}
          accessibilityRole="button"
          accessibilityLabel={ctaLabel}
        >
          <Text style={styles.ctaPrimaryText}>{ctaLabel}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.ctaSecondary,
            pressed && styles.ctaSecondaryPressed,
          ]}
          onPress={() => setActionsOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Actions supplémentaires"
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={colors.primary} />
        </Pressable>
      </Animated.View>

      <Modal
        visible={actionsOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setActionsOpen(false)}
      >
        <View style={styles.actionsBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setActionsOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          />
          <View
            style={[
              styles.actionsSheet,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.actionsHandle} />
            <Text style={styles.actionsTitle}>Actions</Text>

            <View style={styles.actionsAgent}>
              <AgentRow
                agentId={property.agentId}
                compact
                showAgencyLink
                onPressAgency={() => {
                  setActionsOpen(false);
                  router.push(`/agency/${property.agencyId}`);
                }}
              />
            </View>

            {property.mode === 'SALE' ? (
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  setActionsOpen(false);
                  router.push(`/property/${property.id}/sale-inquiry`);
                }}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <Ionicons name="home-outline" size={20} color={colors.primary} />
                </View>
                <Text style={styles.actionLabel}>Faire une demande d’achat</Text>
              </Pressable>
            ) : null}

            {property.mode === 'RENT_SHORT' ? (
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  setActionsOpen(false);
                  router.push(`/property/${property.id}/visit`);
                }}
                accessibilityRole="button"
              >
                <View style={styles.actionIcon}>
                  <Ionicons
                    name="calendar-outline"
                    size={20}
                    color={colors.primary}
                  />
                </View>
                <Text style={styles.actionLabel}>Réserver une visite</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={styles.actionRow}
              onPress={() => {
                setActionsOpen(false);
                void handleShare();
              }}
              accessibilityRole="button"
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name="share-social-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.actionLabel}>Partager</Text>
            </Pressable>

            <Pressable
              style={styles.actionRow}
              onPress={() => {
                setActionsOpen(false);
                handleToggleFavorite();
              }}
              accessibilityRole="button"
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name={favorited ? 'heart' : 'heart-outline'}
                  size={20}
                  color={favorited ? colors.danger : colors.primary}
                />
              </View>
              <Text style={styles.actionLabel}>
                {favorited ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              </Text>
            </Pressable>

            <Pressable
              style={styles.actionsCancel}
              onPress={() => setActionsOpen(false)}
              accessibilityRole="button"
            >
              <Text style={styles.actionsCancelText}>Annuler</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const GALLERY_GAP = 8;
const GALLERY_CELL = 130;
const GALLERY_HEIGHT = GALLERY_CELL * 2 + GALLERY_GAP;

function GalleryImage({
  source,
  square = false,
}: {
  source: ImageSourcePropType;
  square?: boolean;
}): React.JSX.Element {
  return (
    <View style={square ? styles.gallerySquareCell : styles.galleryLandscapeCell}>
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  mapHero: {
    backgroundColor: colors.bg,
  },
  mapFrame: {
    position: 'relative',
    backgroundColor: colors.primarySoft,
  },
  mapGradient: {
    ...StyleSheet.absoluteFill,
  },
  mapCenterChrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '26%',
    zIndex: 10,
    alignItems: 'center',
    gap: 14,
  },
  mapPinOuter: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: 'rgba(108, 114, 127, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPinInner: {
    width: 38,
    height: 38,
    borderRadius: radii.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 30,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  mapViewScroll: {
    flexGrow: 0,
    maxWidth: '100%',
  },
  mapViewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  mapViewChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radii.full,
    backgroundColor: 'rgba(28, 28, 30, 0.55)',
  },
  mapViewChipActive: {
    backgroundColor: colors.surface,
  },
  mapViewChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.surface,
  },
  mapViewChipTextActive: {
    color: colors.ink,
  },
  overlayContent: {
    marginTop: -132,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 10,
    zIndex: 5,
  },
  belowContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bg,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  locationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minWidth: 0,
  },
  location: {
    flexShrink: 1,
    fontSize: 14,
    color: colors.muted,
    fontWeight: '600',
  },
  price: {
    flexShrink: 0,
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.success,
  },
  featureRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  featureCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 16,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.2,
  },
  sectionBlock: {
    gap: 10,
    marginTop: spacing.md,
  },
  sectionSubtitle: {
    marginTop: -4,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  description: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.ink,
    fontWeight: '400',
    opacity: 0.82,
  },
  descriptionToggle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureItem: {
    width: '47.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureItemLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.ink,
  },
  detailsCard: {
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  detailRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    maxWidth: '46%',
  },
  neighborhoodMapWrap: {
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  neighborhoodMap: {
    width: '100%',
    height: NEIGHBORHOOD_MAP_HEIGHT,
  },
  neighborhoodMapLegend: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: radii.full,
  },
  legendDotProperty: {
    backgroundColor: colors.primary,
  },
  legendDotPlace: {
    backgroundColor: colors.muted,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.muted,
  },
  neighborhoodList: {
    gap: 8,
  },
  neighborhoodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  neighborhoodIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  neighborhoodBody: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  neighborhoodName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
  },
  neighborhoodKind: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  neighborhoodMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  neighborhoodDistance: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
  },
  neighborhoodTime: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
  },
  gallery: {
    flexDirection: 'row',
    gap: GALLERY_GAP,
    padding: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  galleryLandscapeCol: {
    flex: 1,
    minWidth: 0,
    gap: GALLERY_GAP,
  },
  gallerySquareCol: {
    width: GALLERY_CELL,
    gap: GALLERY_GAP,
  },
  galleryLandscapeCell: {
    height: GALLERY_CELL,
    width: '100%',
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  gallerySquareCell: {
    width: GALLERY_CELL,
    height: GALLERY_CELL,
    overflow: 'hidden',
    borderRadius: radii.lg,
    backgroundColor: colors.primarySoft,
  },
  galleryPlaceholder: {
    backgroundColor: colors.primaryMuted,
  },
  galleryMoreOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(16, 10, 85, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  galleryMoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.surface,
    textAlign: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: 10,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaPrimary: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaPrimaryPressed: {
    backgroundColor: colors.primaryHover,
  },
  ctaPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.surface,
  },
  ctaSecondary: {
    width: 54,
    height: 54,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.navy,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  ctaSecondaryPressed: {
    opacity: 0.85,
  },
  actionsBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(16, 10, 85, 0.35)',
  },
  actionsSheet: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    gap: 4,
  },
  actionsHandle: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: '#D1D5DB',
    marginBottom: 8,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  actionsAgent: {
    marginBottom: 8,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  actionRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
    borderRadius: radii.md,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
    backgroundColor: colors.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.ink,
  },
  actionsCancel: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: radii.full,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionsCancelText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.muted,
  },
  missing: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  missingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
  },
  missingBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
  },
  missingBtnText: {
    color: colors.surface,
    fontWeight: '700',
  },
});
