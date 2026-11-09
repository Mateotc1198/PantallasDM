import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeToggle } from '../src/components/ThemeToggle';
import { BookingProvider } from '../src/context/BookingContext';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <BookingProvider>
          <AppShell />
        </BookingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Va separado de RootLayout porque un componente no puede consumir el
 * contexto que él mismo monta: useTheme tiene que ejecutarse por debajo del
 * proveedor, no a su lado.
 */
function AppShell() {
  const { name, colors } = useTheme();

  const screenOptions = useMemo(
    () =>
      ({
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }) as const,
    [colors.bg],
  );

  return (
    <View style={styles.root}>
      {/*
        La barra de estado la pinta el sistema y no sabe nada de nuestros
        colores: hay que decirle si sus iconos van claros u oscuros, o
        desaparecen contra el fondo al cambiar de tema.
      */}
      <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={screenOptions} />
      {/*
        Fuera del Stack y después de él: así queda por encima de cualquier
        pantalla, sobrevive a las transiciones sin animarse con ellas, y las
        pantallas que todavía no existen lo tendrán sin hacer nada.
      */}
      <ThemeToggle />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
