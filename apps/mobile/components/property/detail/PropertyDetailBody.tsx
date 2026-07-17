import { colors, radii, spacing } from '@/constants/theme';
import {
  formatDistance,
  NEIGHBORHOOD_KIND_META,
  type NeighborhoodPlace,
  type PropertyDetailRow,
} from '@/lib/neighborhood';
import type { PropertyFeatureMeta } from '@/lib/property-features';
import type { PropertyMediaItem } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { DESCRIPTION_PREVIEW_LINES } from './constants';
import { PropertyDetailGalleryPreview } from './PropertyDetailGalleryPreview';

type Props = {
  propertyId: string;
  description?: string;
  descriptionExpanded: boolean;
  onToggleDescription: () => void;
  gallery: ImageSourcePropType[];
  previewPhotos: ImageSourcePropType[];
  mediaItems?: PropertyMediaItem[];
  features: PropertyFeatureMeta[];
  detailRows: PropertyDetailRow[];
  neighborhood: NeighborhoodPlace[];
};

export function PropertyDetailBody({
  propertyId,
  description,
  descriptionExpanded,
  onToggleDescription,
  gallery,
  previewPhotos,
  mediaItems,
  features,
  detailRows,
  neighborhood,
}: Props): React.JSX.Element {
  return (
    <View style={styles.belowContent}>
      <PropertyDetailGalleryPreview
        propertyId={propertyId}
        gallery={gallery}
        previewPhotos={previewPhotos}
        mediaItems={mediaItems}
      />

      {description ? (
        <View style={styles.sectionBlock}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text
            style={styles.description}
            numberOfLines={
              descriptionExpanded ? undefined : DESCRIPTION_PREVIEW_LINES
            }
          >
            {description}
          </Text>
          {description.length > 140 ? (
            <Pressable
              onPress={onToggleDescription}
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
          <Text style={styles.sectionSubtitle}>Ce que propose ce bien</Text>
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
                    <Text style={styles.neighborhoodKind}>{meta.label}</Text>
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
  );
}

const styles = StyleSheet.create({
  belowContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.bg,
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
    lineHeight: 22,
    fontWeight: '500',
    color: colors.ink,
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
    width: '47%',
    flexGrow: 1,
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
    borderRadius: radii.full,
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  detailRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  detailLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.muted,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'right',
    flexShrink: 0,
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
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  neighborhoodIcon: {
    width: 40,
    height: 40,
    borderRadius: radii.full,
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
});
