import PropertyDetailSkeleton from '@/components/property/PropertyDetailSkeleton';
import { PropertyDetailActionsSheet } from '@/components/property/detail/PropertyDetailActionsSheet';
import { PropertyDetailBody } from '@/components/property/detail/PropertyDetailBody';
import { PropertyDetailFooter } from '@/components/property/detail/PropertyDetailFooter';
import { PropertyDetailMapHero } from '@/components/property/detail/PropertyDetailMapHero';
import { PropertyDetailMissing } from '@/components/property/detail/PropertyDetailMissing';
import { PropertyDetailTopBar } from '@/components/property/detail/PropertyDetailTopBar';
import {
  blockedListingTitle,
  buildAmenities,
  CTA_SCROLL_THRESHOLD,
} from '@/components/property/detail/constants';
import { colors } from '@/constants/theme';
import { fetchCatalogProperty } from '@/lib/catalog';
import { isFavorite, toggleFavorite } from '@/lib/favorites';
import { getErrorMessage } from '@/lib/feedback';
import { getPropertyGallery } from '@/lib/mock-properties';
import {
  buildPropertyDetailRows,
  getNeighborhoodPlaces,
} from '@/lib/neighborhood';
import { resolvePropertyFeatures } from '@/lib/property-features';
import { propertyMapViewPath } from '@/lib/property-map-views';
import {
  isConversionBlocked,
  listingStatusLabel,
  propertyPriceLabel,
  propertyStatusLabel,
  resolvePropertyMapViews,
  type Property,
  type PropertyMapView,
} from '@/types/property';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  Share,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function PropertyScreen(): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const propertyId = String(id ?? '');
  const [property, setProperty] = useState<Property | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [showCta, setShowCta] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [activeMapView, setActiveMapView] =
    useState<PropertyMapView>('neighborhood');
  const ctaVisibleRef = useRef(false);
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void (async () => {
        if (!propertyId) return;
        setLoading(true);
        setLoadError(null);
        try {
          const row = await fetchCatalogProperty(propertyId);
          if (active) setProperty(row);
        } catch (err) {
          if (active) {
            setProperty(null);
            setLoadError(
              getErrorMessage(err, 'Impossible de charger ce bien'),
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [propertyId]),
  );

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
    if (!propertyId) return;
    let cancelled = false;
    void isFavorite(propertyId).then((value) => {
      if (!cancelled) setFavorited(value);
    });
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const handleScroll = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ): void => {
    const next = event.nativeEvent.contentOffset.y >= CTA_SCROLL_THRESHOLD;
    if (next === ctaVisibleRef.current) return;
    ctaVisibleRef.current = next;
    setShowCta(next);
  };

  if (loading) {
    return <PropertyDetailSkeleton />;
  }

  if (!property) {
    return <PropertyDetailMissing loadError={loadError} />;
  }

  const statusLabel = propertyStatusLabel(property);
  const priceLabel = propertyPriceLabel(property);
  const statusBadge = listingStatusLabel(property);
  const available = !isConversionBlocked(property);
  const previewPhotos = gallery.slice(0, 4);
  const ctaLabel =
    property.mode === 'RENT_SHORT' ? 'Réserver' : 'Réserver une visite';
  const blockedTitle = blockedListingTitle(property.listingStatus);

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

  return (
    <View style={styles.screen}>
      <PropertyDetailTopBar
        favorited={favorited}
        onShare={() => void handleShare()}
        onToggleFavorite={handleToggleFavorite}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <PropertyDetailMapHero
          property={property}
          priceLabel={priceLabel}
          statusLabel={statusLabel}
          statusBadge={statusBadge}
          amenities={amenities}
          mapViews={mapViews}
          activeMapView={activeMapView}
          onMapViewPress={handleMapViewPress}
        />

        <PropertyDetailBody
          propertyId={property.id}
          property={property}
          description={property.description}
          descriptionExpanded={descriptionExpanded}
          onToggleDescription={() => setDescriptionExpanded((v) => !v)}
          gallery={gallery}
          previewPhotos={previewPhotos}
          mediaItems={property.mediaItems}
          features={features}
          detailRows={detailRows}
          neighborhood={neighborhood}
        />
      </ScrollView>

      <PropertyDetailFooter
        showCta={showCta}
        ctaAnim={ctaAnim}
        available={available}
        ctaLabel={ctaLabel}
        blockedTitle={blockedTitle}
        statusBadge={statusBadge}
        onCtaPress={handleCtaPress}
        onOpenActions={() => setActionsOpen(true)}
      />

      <PropertyDetailActionsSheet
        visible={actionsOpen}
        property={property}
        available={available}
        favorited={favorited}
        onClose={() => setActionsOpen(false)}
        onShare={() => void handleShare()}
        onToggleFavorite={handleToggleFavorite}
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
});
