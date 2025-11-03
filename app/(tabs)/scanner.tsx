import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { Camera, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Product } from '@/types/database';

export default function ScannerScreen() {
  const { user } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleBarCodeScanned = async ({ type, data }: any) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);
    setCameraActive(false);

    try {
      console.log('Barcode scanned:', data);

      const productQuery = query(
        collection(db, 'products'),
        where('codigo_barras', '==', data)
      );

      const productSnapshot = await getDocs(productQuery);
      console.log('Products found:', productSnapshot.size);

      const existingProduct = productSnapshot.empty ? null : {
        id: productSnapshot.docs[0].id,
        ...productSnapshot.docs[0].data(),
        fecha_creacion: productSnapshot.docs[0].data().fecha_creacion?.toDate() || new Date(),
      } as Product;

      if (existingProduct) {
        console.log('Product found:', existingProduct.nombre);
        Alert.alert(
          'Producto encontrado',
          `${existingProduct.nombre} - ${existingProduct.marca}`,
          [
            {
              text: 'Ver producto',
              onPress: () => router.push(`/product/${existingProduct.id}`),
            },
            {
              text: 'Escanear otro',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
                setCameraActive(true);
              },
            },
          ]
        );
      } else {
        console.log('Product not found, barcode:', data);
        Alert.alert(
          'Producto no encontrado',
          'Este producto no está en nuestra base de datos. ¿Quieres agregarlo?',
          [
              user ? {
                text: 'Agregar producto',
                onPress: () => router.push(`/add-product?barcode=${data}`),
              } : {
                text: 'Iniciar sesión',
                onPress: () => router.push('/(auth)/login'),
              },
            {
              text: 'Escanear otro',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
                setCameraActive(true);
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Error checking product:', error);
      console.error('Error code:', error?.code);
      console.error('Error message:', error?.message);

      const errorMessage = error?.message || 'Error desconocido';

      if (error?.code === 'unavailable' || errorMessage.includes('offline')) {
        Alert.alert(
          'Sin conexión',
          'No hay conexión a internet. Por favor verifica tu conexión e intenta nuevamente.',
          [
            {
              text: 'Reintentar',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
                setCameraActive(true);
              },
            },
            {
              text: 'Cancelar',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              },
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          'Error',
          `No se pudo procesar el código de barras: ${errorMessage}`,
          [
            {
              text: 'Reintentar',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
                setCameraActive(true);
              },
            },
            {
              text: 'Cancelar',
              onPress: () => {
                setScanned(false);
                setIsProcessing(false);
              },
              style: 'cancel',
            },
          ]
        );
      }
    }
  };

  const startScanning = () => {
    setScanned(false);
    setIsProcessing(false);
    setCameraActive(true);
  };

  const stopScanning = () => {
    setCameraActive(false);
    setScanned(false);
    setIsProcessing(false);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Solicitando permiso para usar la cámara...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.message}>Necesitamos permiso para usar la cámara</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Conceder permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Escanear Producto</Text>
        <Text style={styles.subtitle}>
          Apunta la cámara al código de barras del producto
        </Text>
      </View>

      {cameraActive ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'pdf417', 'ean13', 'ean8', 'code128', 'code39'],
            }}
          />
          
          <View style={styles.overlay}>
            <View style={styles.scanArea} />
          </View>

          <TouchableOpacity style={styles.closeButton} onPress={stopScanning}>
            <X size={24} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.instructions}>
            <Text style={styles.instructionsText}>
              Coloca el código de barras dentro del marco
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.scanPrompt}>
            <Camera size={80} color={Colors.primary} />
            <Text style={styles.promptTitle}>¡Listo para escanear!</Text>
            <Text style={styles.promptText}>
              Presiona el botón para activar la cámara y escanear códigos de barras
            </Text>
          </View>

          <TouchableOpacity style={styles.scanButton} onPress={startScanning}>
            <Text style={styles.scanButtonText}>Iniciar Escáner</Text>
          </TouchableOpacity>

          <View style={styles.tips}>
            <Text style={styles.tipsTitle}>📋 Consejos</Text>
            <Text style={styles.tip}>• Mantén el teléfono estable</Text>
            <Text style={styles.tip}>• Asegúrate de tener buena iluminación</Text>
            <Text style={styles.tip}>• Coloca el código de barras dentro del marco</Text>
            <Text style={styles.tip}>• Si el producto no existe, podrás agregarlo</Text>
          </View>
        </View>
      )}
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
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanPrompt: {
    alignItems: 'center',
    marginBottom: 40,
  },
  promptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 12,
  },
  promptText: {
    fontSize: 16,
    color: Colors.placeholder,
    textAlign: 'center',
    lineHeight: 22,
  },
  scanButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  scanButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 150,
    borderWidth: 2,
    borderColor: Colors.secondary,
    borderRadius: 12,
    backgroundColor: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 20,
    padding: 10,
  },
  instructions: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  instructionsText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  message: {
    fontSize: 18,
    color: Colors.text,
    textAlign: 'center',
    margin: 20,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  tips: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 20,
    width: '100%',
  },
  tipsTitle: {
    fontSize: 18,
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