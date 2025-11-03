import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Check, X, Clock, Eye } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc, 
  increment,
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { PendingPrice, Price, Product, Store, UserProfile } from '@/types/database';

export default function SupervisorScreen() {
  const { profile } = useAuth();
  const { loading: authLoading } = useAuth();
  const [pendingPrices, setPendingPrices] = useState<PendingPrice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.rol === 'supervisor' || profile?.rol === 'admin') {
      fetchPendingPrices();
    }
  }, [profile]);

  const fetchPendingPrices = async () => {
    try {
      const pricesQuery = query(
        collection(db, 'prices'),
        where('estado', '==', 'pendiente'),
        orderBy('fecha_registro', 'desc')
      );
      
      const pricesSnapshot = await getDocs(pricesQuery);
      const prices = pricesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        fecha_registro: doc.data().fecha_registro?.toDate() || new Date(),
      })) as Price[];

      // Fetch related data for each price
      const pendingPricesWithData: PendingPrice[] = [];
      
      for (const price of prices) {
        const pendingPrice: PendingPrice = { ...price };
        
        // Fetch product data
        if (price.producto_id) {
          try {
            const productQuery = query(
              collection(db, 'products'),
              where('__name__', '==', price.producto_id)
            );
            const productSnapshot = await getDocs(productQuery);
            if (!productSnapshot.empty) {
              pendingPrice.product = {
                id: productSnapshot.docs[0].id,
                ...productSnapshot.docs[0].data(),
                fecha_creacion: productSnapshot.docs[0].data().fecha_creacion?.toDate() || new Date(),
              } as Product;
            }
          } catch (error) {
            console.error('Error fetching product:', error);
          }
        }
        
        // Fetch store data
        if (price.comercio_id) {
          try {
            const storeQuery = query(
              collection(db, 'stores'),
              where('__name__', '==', price.comercio_id)
            );
            const storeSnapshot = await getDocs(storeQuery);
            if (!storeSnapshot.empty) {
              pendingPrice.store = {
                id: storeSnapshot.docs[0].id,
                ...storeSnapshot.docs[0].data(),
                fecha_registro: storeSnapshot.docs[0].data().fecha_registro?.toDate() || new Date(),
              } as Store;
            }
          } catch (error) {
            console.error('Error fetching store:', error);
          }
        }
        
        // Fetch user data
        if (price.usuario_id) {
          try {
            const userQuery = query(
              collection(db, 'users'),
              where('__name__', '==', price.usuario_id)
            );
            const userSnapshot = await getDocs(userQuery);
            if (!userSnapshot.empty) {
              pendingPrice.user = {
                id: userSnapshot.docs[0].id,
                ...userSnapshot.docs[0].data(),
                fecha_registro: userSnapshot.docs[0].data().fecha_registro?.toDate() || new Date(),
              } as UserProfile;
            }
          } catch (error) {
            console.error('Error fetching user:', error);
          }
        }
        
        pendingPricesWithData.push(pendingPrice);
      }
      
      setPendingPrices(pendingPricesWithData);
    } catch (error) {
      console.error('Error fetching pending prices:', error);
      Alert.alert('Error', 'No se pudieron cargar los precios pendientes');
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePrice = async (priceId: string, action: 'approve' | 'reject') => {
    try {
      const newStatus = action === 'approve' ? 'verificado' : 'rechazado';
      
      // Update price status
      await updateDoc(doc(db, 'prices', priceId), {
        estado: newStatus,
        verificado: action === 'approve',
        supervisor_id: profile?.id,
      });

      // Create validation record
      await addDoc(collection(db, 'validations'), {
        precio_id: priceId,
        supervisor_id: profile?.id,
        estado: action === 'approve' ? 'aprobado' : 'rechazado',
        fecha_validacion: serverTimestamp(),
      });

      // Award points to user if approved
      if (action === 'approve') {
        const price = pendingPrices.find(p => p.id === priceId);
        if (price?.usuario_id) {
          await updateDoc(doc(db, 'users', price.usuario_id), {
            puntos: increment(10)
          });
        }
      }

      Alert.alert(
        'Éxito',
        `Precio ${action === 'approve' ? 'aprobado' : 'rechazado'} correctamente`
      );

      // Refresh list
      fetchPendingPrices();
    } catch (error) {
      console.error('Error validating price:', error);
      Alert.alert('Error', 'No se pudo procesar la validación');
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // If auth state still loading, show a loader so profile can be fetched
  if (authLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profile?.rol !== 'supervisor' && profile?.rol !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unauthorizedContainer}>
          <Text style={styles.unauthorizedText}>
            No tienes permisos para acceder a esta sección
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Panel Supervisor</Text>
        <Text style={styles.subtitle}>
          {pendingPrices.length} precios pendientes de validación
        </Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Cargando...</Text>
          </View>
        ) : pendingPrices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Check size={48} color={Colors.primary} />
            <Text style={styles.emptyText}>
              ¡Excelente! No hay precios pendientes de validación
            </Text>
          </View>
        ) : (
          pendingPrices.map((price) => (
            <View key={price.id} style={styles.priceCard}>
              <View style={styles.priceHeader}>
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>
                    {price.product?.nombre || 'Producto desconocido'}
                  </Text>
                  <Text style={styles.productBrand}>
                    {price.product?.marca} • {price.product?.categoria}
                  </Text>
                </View>
                <Text style={styles.price}>${price.precio}</Text>
              </View>

              <View style={styles.priceDetails}>
                <Text style={styles.detailText}>
                  📍 {price.store?.nombre || 'Comercio desconocido'}
                </Text>
                <Text style={styles.detailText}>
                  👤 {price.user?.nombre || 'Usuario desconocido'}
                </Text>
                <Text style={styles.detailText}>
                  📅 {formatDate(price.fecha_registro)}
                </Text>
              </View>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => handleValidatePrice(price.id, 'approve')}
                >
                  <Check size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Aprobar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => handleValidatePrice(price.id, 'reject')}
                >
                  <X size={20} color={Colors.white} />
                  <Text style={styles.actionButtonText}>Rechazar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.white,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 18,
    color: Colors.placeholder,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    marginTop: 16,
  },
  priceCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  priceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
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
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  priceDetails: {
    marginBottom: 16,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: Colors.primary,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  unauthorizedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  unauthorizedText: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
  },
});