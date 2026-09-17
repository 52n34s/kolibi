import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { barcodeProductMetaHints } from '@/components/scan/barcode-product-meta-hints';
import { TEXT_SECONDARY, TEXT_TERTIARY } from '@/constants/brand';
import type { BarcodeProduct } from '@/services/barcode/OpenFoodFactsService';

type ProductIdentityCardProps = {
  product: BarcodeProduct;
};

export function ProductIdentityCard({ product }: ProductIdentityCardProps) {
  const { t, i18n } = useTranslation();
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const metaHints = barcodeProductMetaHints(product, t);
  const subtitle = [product.brand, product.quantityLabel].filter((value) => value != null).join(' · ');
  const date = new Intl.DateTimeFormat(i18n.resolvedLanguage ?? i18n.language).format(new Date());

  return (
    <View style={styles.card}>
      <View style={styles.identityRow}>
        {product.imageUrl != null ? (
          <Image source={{ uri: product.imageUrl }} style={styles.image} resizeMode="contain" />
        ) : null}
        <View style={styles.identityText}>
          <Text style={styles.name}>{product.productName}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {metaHints.map((hint) => (
            <Text key={hint} style={styles.metaHint}>
              {hint}
            </Text>
          ))}
        </View>
      </View>

      {product.ingredientsText != null ? (
        <View style={styles.ingredients}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: ingredientsExpanded }}
            style={styles.ingredientsToggle}
            onPress={() => setIngredientsExpanded((expanded) => !expanded)}>
            <Text style={styles.ingredientsLabel}>
              {t(`home.scan.barcode.product.${ingredientsExpanded ? 'hideIngredients' : 'showIngredients'}`)}
            </Text>
            <Ionicons
              name={ingredientsExpanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={TEXT_SECONDARY}
            />
          </Pressable>
          {ingredientsExpanded ? (
            <Text
              accessibilityLabel={t('home.scan.barcode.product.ingredientsTitle')}
              style={styles.ingredientsText}>
              {product.ingredientsText}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.source}>
        {t('home.scan.barcode.product.source', { date })}{' '}
        <Text
          accessibilityRole="link"
          style={styles.sourceLink}
          onPress={() => {
            void Linking.openURL(`https://world.openfoodfacts.org/product/${encodeURIComponent(product.barcode)}`)
              .catch((error: unknown) => console.error('[ProductIdentityCard] Could not open product page:', error));
          }}>
          {t('home.scan.barcode.product.sourceLink')}
        </Text>
      </Text>
      <Text style={styles.source}>{t('home.scan.barcode.product.disclaimer')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  image: { width: 56, height: 56, borderRadius: 12 },
  identityText: { flex: 1, gap: 4 },
  name: { fontSize: 15, fontWeight: '600', color: '#111827' },
  subtitle: { fontSize: 13, color: TEXT_SECONDARY },
  metaHint: { fontSize: 12, color: TEXT_SECONDARY },
  ingredients: { gap: 6 },
  ingredientsToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  ingredientsLabel: { flex: 1, fontSize: 13, color: TEXT_SECONDARY },
  ingredientsText: { fontSize: 13, lineHeight: 19, color: TEXT_SECONDARY },
  source: { fontSize: 11, color: TEXT_TERTIARY },
  sourceLink: { textDecorationLine: 'underline' },
});
