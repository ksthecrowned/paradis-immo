import { colors } from '@/constants/theme';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageStyle,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type UserAvatarProps = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

function initialsFrom(props: {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}): string {
  const name = props.name?.trim();
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  }
  if (props.email?.trim()) {
    return props.email.trim().slice(0, 2).toUpperCase();
  }
  if (props.phone) return props.phone.replace(/\D/g, '').slice(-2) || 'PI';
  return 'PI';
}

function isRemoteUrl(url?: string | null): url is string {
  return Boolean(url && /^https?:\/\//i.test(url));
}

export function UserAvatar({
  name,
  phone,
  email,
  avatarUrl,
  size = 68,
  style,
  imageStyle,
}: UserAvatarProps): React.JSX.Element {
  const radius = size / 2;
  const initials = initialsFrom({ name, phone, email });

  if (isRemoteUrl(avatarUrl)) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[
          styles.image,
          { width: size, height: size, borderRadius: radius },
          imageStyle,
        ]}
        resizeMode="cover"
        accessibilityLabel={name ?? initials}
      />
    );
  }

  return (
    <View
      style={[
        styles.placeholder,
        { width: size, height: size, borderRadius: radius },
        style,
      ]}
      accessibilityLabel={name ?? initials}
    >
      <Text style={[styles.initials, { fontSize: Math.max(12, size * 0.34) }]}>
        {initials}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  placeholder: {
    backgroundColor: colors.primaryMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.primary,
    fontWeight: '700',
  },
});
