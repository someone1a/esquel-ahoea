import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/Colors';
import { Product, Store } from '@/types/database';

export default function AddPriceScreen() {
  const { productId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<Product | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [price, setPrice] = useState('');

  useEffect(() => {
    if (!user) {
      Alert.alert('Error', 'Debes iniciar sesión para reportar precios');
      router.replace('/(auth)/login');
      return;
    }

    const loadData = async () => {
      try {
        // Load product details
        const productDoc = await getDocs(
          query(collection(db, 'products'), where('id', '==', productId))
        );
        
        if (!productDoc.empty) {
          setProduct({
            id: productDoc.docs[0].id,
            ...productDoc.docs[0].data(),
            fecha_creacion: productDoc.docs[0].data().fecha_creacion?.toDate() || new Date(),
          } as Product);
        }

        // Load verified stores
        const storesSnapshot = await getDocs(
          query(collection(db, 'stores'), where('verificado', '==', true))
        );
        
        setStores(
          storesSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            fecha_registro: doc.data().fecha_registro?.toDate() || new Date(),
          })) as Store[]
        );

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        Alert.alert('Error', 'No se pudo cargar la información necesaria');
        router.back();
      }
    };

    loadData();
  }, [productId, user]);

  const handleSubmit = async () => {
    if (!selectedStore || !price || !product || !user) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    const priceNum = parseFloat(price.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      Alert.alert('Error', 'Por favor ingresa un precio válido');
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, 'prices'), {
        producto_id: product.id,
        comercio_id: selectedStore,
        usuario_id: user.uid,
        precio: priceNum,
        fecha_registro: new Date(),
        verificado: false,
        estado: 'pendiente',
      });

      Alert.alert(
        'Éxito',
        'El precio ha sido reportado y será verificado por un supervisor',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('Error submitting price:', error);
      Alert.alert('Error', 'No se pudo guardar el precio');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.container}>
        <Text>Producto no encontrado</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Reportar precio</Text>
        
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.nombre}</Text>
          <Text style={styles.productBrand}>{product.marca}</Text>
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Selecciona el comercio</Text>
          <ScrollView style={styles.storeList}>
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.storeItem,
                  selectedStore === store.id && styles.selectedStore,
                ]}
                onPress={() => setSelectedStore(store.id)}
              >
                <Text
                  style={[
                    styles.storeName,
                    selectedStore === store.id && styles.selectedText,
                  ]}
                >
                  {store.nombre}
                </Text>
                <Text style={styles.storeAddress}>{store.direccion}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.label}>Precio</Text>
          <TextInput
            style={styles.input}
            placeholder="Ingresa el precio"
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholderTextColor={Colors.text}
          />

          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Enviando...' : 'Reportar precio'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 20,
  },
  productInfo: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  productBrand: {
    fontSize: 16,
    color: Colors.text,
    opacity: 0.8,
  },
  inputContainer: {
    gap: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    fontSize: 16,
    color: Colors.text,
  },
  storeList: {
    maxHeight: 200,
  },
  storeItem: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  selectedStore: {
    backgroundColor: Colors.primary,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  selectedText: {
    color: 'white',
  },
  storeAddress: {
    fontSize: 14,
    color: Colors.text,
    opacity: 0.8,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});