import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Edit2, TrendingDown } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { Product, Price, Store } from '@/types/database';

interface PriceWithStore {
  price: Price;
  storeName: string;
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [prices, setPrices] = useState<PriceWithStore[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);

      const productDoc = await getDoc(doc(db, 'products', id as string));
      if (productDoc.exists()) {
        const productData = {
          id: productDoc.id,
          ...productDoc.data(),
          fecha_creacion: productDoc.data().fecha_creacion?.toDate() || new Date(),
        } as Product;
        setProduct(productData);

        const pricesQuery = query(
          collection(db, 'prices'),
          where('producto_id', '==', id as string),
          where('verificado', '==', true)
        );

        const pricesSnapshot = await getDocs(pricesQuery);
        const pricesData: PriceWithStore[] = [];

        for (const priceDoc of pricesSnapshot.docs) {
          const priceData = {
            id: priceDoc.id,
            ...priceDoc.data(),
            fecha_registro: priceDoc.data().fecha_registro?.toDate() || new Date(),
          } as Price;

          let storeName = 'Comercio desconocido';
          if (priceData.comercio_id) {
            try {
              const storeDoc = await getDoc(doc(db, 'stores', priceData.comercio_id));
              if (storeDoc.exists()) {
                storeName = storeDoc.data().nombre;
              }
            } catch (error) {
              console.error('Error fetching store:', error);
            }
          }

          pricesData.push({
            price: priceData,
            storeName,
          });
        }

        pricesData.sort((a, b) => a.price.precio - b.price.precio);
        setPrices(pricesData);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      Alert.alert('Error', 'No se pudo cargar los detalles del producto');
    } finally {
      setLoading(false);
    }
  };

  const handleAddPrice = () => {
    if (!user) {
      Alert.alert('Inicia sesión', 'Debes iniciar sesión para agregar precios', [
        { text: 'Ir a login', onPress: () => router.push('/(auth)/login') },
        { text: 'Cancelar', style: 'cancel' },
      ]);
      return;
    }
    router.push(`/add-product?productId=${id}`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Detalles del Producto</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!product) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.title}>Detalles del Producto</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Producto no encontrado</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.title}>Detalles del Producto</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.productHeader}>
          <Text style={styles.productName}>{product.nombre}</Text>
          <Text style={styles.productBrand}>{product.marca}</Text>
          <View style={styles.productMeta}>
            <Text style={styles.category}>{product.categoria}</Text>
            <Text style={styles.barcode}>{product.codigo_barras}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TrendingDown size={24} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Precios</Text>
          </View>

          {prices.length > 0 ? (
            <>
              {prices.map((item, index) => (
                <View key={index} style={styles.priceCard}>
                  <View style={styles.priceInfo}>
                    <Text style={styles.storeName}>{item.storeName}</Text>
                    <Text style={styles.priceDate}>
                      {new Date(item.price.fecha_registro).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.price}>${item.price.precio}</Text>
                </View>
              ))}

              {prices.length > 0 && (
                <View style={styles.lowestPriceCard}>
                  <Text style={styles.lowestPriceLabel}>Mejor precio:</Text>
                  <Text style={styles.lowestPrice}>${prices[0].price.precio}</Text>
                  <Text style={styles.lowestPriceStore}>{prices[0].storeName}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.noPricesContainer}>
              <Text style={styles.noPricesText}>
                No hay precios registrados para este producto
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity style={styles.addPriceButton} onPress={handleAddPrice}>
          <Edit2 size={20} color={Colors.white} />
          <Text style={styles.addPriceButtonText}>Agregar o Corregir Precio</Text>
        </TouchableOpacity>

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💡 Información</Text>
          <Text style={styles.tip}>• Los precios son verificados antes de mostrarse</Text>
          <Text style={styles.tip}>• Contribuye con precios actualizados</Text>
          <Text style={styles.tip}>• Ganarás puntos por cada precio aportado</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 40,
  },
  backButton: {
    marginRight: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  productHeader: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  productName: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 16,
    color: Colors.placeholder,
    marginBottom: 12,
  },
  productMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  category: {
    fontSize: 12,
    color: Colors.primary,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  barcode: {
    fontSize: 12,
    color: Colors.placeholder,
    fontFamily: 'monospace',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginLeft: 8,
  },
  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceInfo: {
    flex: 1,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  priceDate: {
    fontSize: 12,
    color: Colors.placeholder,
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  noPricesContainer: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  noPricesText: {
    fontSize: 16,
    color: Colors.placeholder,
    textAlign: 'center',
  },
  lowestPriceCard: {
    backgroundColor: Colors.secondary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  lowestPriceLabel: {
    fontSize: 14,
    color: Colors.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  lowestPrice: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
  },
  lowestPriceStore: {
    fontSize: 12,
    color: Colors.white,
    opacity: 0.8,
    marginTop: 4,
  },
  addPriceButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  addPriceButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  tips: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  tip: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 8,
    lineHeight: 20,
  },
});
