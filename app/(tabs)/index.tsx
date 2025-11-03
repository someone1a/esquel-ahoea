import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, TrendingDown } from 'lucide-react-native';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  or
} from 'firebase/firestore';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { ProductWithPrice, Product, Price, Store } from '@/types/database';

export default function HomeScreen() {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<ProductWithPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<ProductWithPrice[]>([]);

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      // Get verified prices
      const pricesQuery = query(
        collection(db, 'prices'),
        where('verificado', '==', true),
        orderBy('fecha_registro', 'desc'),
        limit(10)
      );
      
      const pricesSnapshot = await getDocs(pricesQuery);
      const prices = pricesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha_registro: doc.data().fecha_registro?.toDate() || new Date(),
      })) as Price[];

      // Get unique product IDs
      const productIds = [...new Set(prices.map(p => p.producto_id).filter(Boolean))];
      
      if (productIds.length === 0) {
        setFeaturedProducts([]);
        return;
      }

      // Get products
      const productsData: ProductWithPrice[] = [];
      
      for (const productId of productIds.slice(0, 5)) {
        try {
          const productQuery = query(
            collection(db, 'products'),
            where('__name__', '==', productId)
          );
          const productSnapshot = await getDocs(productQuery);
          
          if (!productSnapshot.empty) {
            const productDoc = productSnapshot.docs[0];
            const product = {
              id: productDoc.id,
              ...productDoc.data(),
              fecha_creacion: productDoc.data().fecha_creacion?.toDate() || new Date(),
            } as Product;

            // Find lowest price for this product
            const productPrices = prices.filter(p => p.producto_id === productId);
            const lowestPrice = Math.min(...productPrices.map(p => p.precio));
            const lowestPriceData = productPrices.find(p => p.precio === lowestPrice);

            // Get store name
            let storeName = 'Comercio desconocido';
            if (lowestPriceData?.comercio_id) {
              try {
                const storeQuery = query(
                  collection(db, 'stores'),
                  where('__name__', '==', lowestPriceData.comercio_id)
                );
                const storeSnapshot = await getDocs(storeQuery);
                if (!storeSnapshot.empty) {
                  storeName = storeSnapshot.docs[0].data().nombre;
                }
              } catch (error) {
                console.error('Error fetching store:', error);
              }
            }

            productsData.push({
              ...product,
              lowest_price: lowestPrice,
              store_name: storeName,
            });
          }
        } catch (error) {
          console.error('Error fetching product:', error);
        }
      }

      setFeaturedProducts(productsData);
    } catch (error) {
      console.error('Error fetching featured products:', error);
      const err: any = error;
      if (err?.code === 'permission-denied' || err?.message?.includes('Missing or insufficient permissions')) {
        Alert.alert('Permisos', 'No tienes permiso para leer los datos destacados. Revisa las reglas de seguridad de Firestore en Firebase Console.');
      }
    }
  };

  const searchProducts = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Por favor ingresa un término de búsqueda');
      return;
    }

    setLoading(true);
    try {
      // Search products by name, brand, or barcode
      const productsQuery = query(
        collection(db, 'products'),
        limit(20)
      );
      
      const productsSnapshot = await getDocs(productsQuery);
      const allProducts = productsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha_creacion: doc.data().fecha_creacion?.toDate() || new Date(),
      })) as Product[];

      // Filter products locally (Firebase doesn't support complex text search)
      const filteredProducts = allProducts.filter(product => 
        product.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.marca.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.codigo_barras === searchQuery
      );

      // Get prices for filtered products
      const productsWithPrices: ProductWithPrice[] = [];
      
      for (const product of filteredProducts) {
        try {
          const pricesQuery = query(
            collection(db, 'prices'),
            where('producto_id', '==', product.id),
            where('verificado', '==', true)
          );
          
          const pricesSnapshot = await getDocs(pricesQuery);
          const prices = pricesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            fecha_registro: doc.data().fecha_registro?.toDate() || new Date(),
          })) as Price[];

          if (prices.length > 0) {
            const lowestPrice = Math.min(...prices.map(p => p.precio));
            const lowestPriceData = prices.find(p => p.precio === lowestPrice);

            // Get store name
            let storeName = 'Comercio desconocido';
            if (lowestPriceData?.comercio_id) {
              try {
                const storeQuery = query(
                  collection(db, 'stores'),
                  where('__name__', '==', lowestPriceData.comercio_id)
                );
                const storeSnapshot = await getDocs(storeQuery);
                if (!storeSnapshot.empty) {
                  storeName = storeSnapshot.docs[0].data().nombre;
                }
              } catch (error) {
                console.error('Error fetching store:', error);
              }
            }

            productsWithPrices.push({
              ...product,
              lowest_price: lowestPrice,
              store_name: storeName,
            });
          }
        } catch (error) {
          console.error('Error fetching prices for product:', error);
        }
      }

      setProducts(productsWithPrices);
    } catch (error) {
      console.error('Error searching products:', error);
      Alert.alert('Error', 'No se pudieron buscar los productos');
    } finally {
      setLoading(false);
    }
  };

  const ProductCard = ({ product }: { product: ProductWithPrice }) => (
    <TouchableOpacity
      style={styles.productCard}
      onPress={() => router.push(`/product/${product.id}`)}
    >
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{product.nombre}</Text>
        <Text style={styles.productBrand}>{product.marca}</Text>
        <Text style={styles.productCategory}>{product.categoria}</Text>
      </View>
      <View style={styles.priceInfo}>
        {product.lowest_price && (
          <>
            <Text style={styles.price}>${product.lowest_price}</Text>
            <Text style={styles.storeName}>{product.store_name}</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Esquel Ahorra</Text>
        <Text style={styles.subtitle}>
          ¡Hola {profile?.nombre || 'Usuario'}! 👋
        </Text>
        <Text style={styles.points}>Puntos: {profile?.puntos || 0}</Text>
      </View>

      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={20} color={Colors.placeholder} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar productos..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={Colors.placeholder}
          />
        </View>
        <TouchableOpacity 
          style={styles.searchButton}
          onPress={searchProducts}
          disabled={loading}
        >
          <Text style={styles.searchButtonText}>
            {loading ? 'Buscando...' : 'Buscar'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {products.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Resultados de búsqueda</Text>
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.featuredHeader}>
              <TrendingDown size={24} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Mejores ofertas</Text>
            </View>
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </View>
        )}

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💡 Consejos para ahorrar</Text>
          <Text style={styles.tip}>• Escanea productos para comparar precios</Text>
          <Text style={styles.tip}>• Contribuye con precios para ganar puntos</Text>
          <Text style={styles.tip}>• Verifica las ofertas más cercanas a ti</Text>
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
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  points: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '600',
  },
  searchSection: {
    padding: 16,
    backgroundColor: Colors.white,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: Colors.text,
  },
  searchButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  featuredHeader: {
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
  productCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  productBrand: {
    fontSize: 14,
    color: Colors.placeholder,
    marginBottom: 2,
  },
  productCategory: {
    fontSize: 12,
    color: Colors.primary,
    textTransform: 'capitalize',
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  storeName: {
    fontSize: 12,
    color: Colors.placeholder,
    marginTop: 2,
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
    marginBottom: 6,
    lineHeight: 20,
  },
});