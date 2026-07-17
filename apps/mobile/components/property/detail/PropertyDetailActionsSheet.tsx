import { AgentRow } from '@/components/agency/AgentRow';
import { colors, radii, spacing } from '@/constants/theme';
import { formatDate } from '@/lib/format';
import type { Property } from '@/types/property';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  property: Property;
  available: boolean;
  favorited: boolean;
  onClose: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
};

export function PropertyDetailActionsSheet({
  visible,
  property,
  available,
  favorited,
  onClose,
  onShare,
  onToggleFavorite,
}: Props): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.actionsBackdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
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

          {property.updatedAt ? (
            <Text style={styles.updatedLabel}>
              Mis à jour le {formatDate(property.updatedAt)}
            </Text>
          ) : null}

          <View style={styles.actionsAgent}>
            <AgentRow
              agentId={property.agentId}
              fallbackName={property.agentName}
              fallbackPhone={property.agentPhone}
              fallbackAgencyId={property.agencyId}
              compact
              showAgencyLink
              onPressAgency={() => {
                onClose();
                router.push(`/agency/${property.agencyId}`);
              }}
            />
          </View>

          {available && property.mode === 'SALE' ? (
            <Pressable
              style={styles.actionRow}
              onPress={() => {
                onClose();
                router.push(`/property/${property.id}/sale-inquiry`);
              }}
              accessibilityRole="button"
            >
              <View style={styles.actionIcon}>
                <Ionicons
                  name="home-outline"
                  size={20}
                  color={colors.primary}
                />
              </View>
              <Text style={styles.actionLabel}>Faire une demande d’achat</Text>
            </Pressable>
          ) : null}

          {available && property.mode === 'RENT_SHORT' ? (
            <Pressable
              style={styles.actionRow}
              onPress={() => {
                onClose();
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
              onClose();
              onShare();
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
              onClose();
              onToggleFavorite();
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
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text style={styles.actionsCancelText}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  updatedLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.muted,
    paddingHorizontal: 4,
    marginBottom: 4,
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
});
