import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarberChip } from '../../src/components/BarberChip';
import { Card } from '../../src/components/Card';
import { ErrorState } from '../../src/components/ErrorState';
import { LoadingState } from '../../src/components/LoadingState';
import { StepHeader } from '../../src/components/StepHeader';
import { useBooking } from '../../src/context/BookingContext';
import { getServices } from '../../src/data/services';
import { useAsync } from '../../src/hooks/useAsync';
import { useBookingNavigation } from '../../src/hooks/useBookingNavigation';
import { useRequireBooking } from '../../src/hooks/useRequireBooking';
import { spacing, typography, type Palette } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/ThemeContext';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Service } from '../../src/types/api';
import { formatCop } from '../../src/utils/money';

interface Grupo {
  categoria: string;
  servicios: Service[];
}

/**
 * Agrupa por categoría conservando el orden en que llegan.
 *
 * La API ya ordena por categoría y nombre, así que basta con cortar la lista
 * donde cambia la categoría: no hay que volver a ordenar nada aquí.
 */
function agruparPorCategoria(servicios: Service[]): Grupo[] {
  const grupos: Grupo[] = [];
  for (const servicio of servicios) {
    const ultimo = grupos.at(-1);
    if (ultimo !== undefined && ultimo.categoria === servicio.category) {
      ultimo.servicios.push(servicio);
    } else {
      grupos.push({ categoria: servicio.category, servicios: [servicio] });
    }
  }
  return grupos;
}

/**
 * Paso 3: qué se va a hacer el cliente.
 *
 * Va después de elegir barbero y antes de la fecha. El catálogo es el mismo
 * para todos los barberos, así que cambiar de barbero no obliga a volver a
 * elegir servicio.
 *
 * Tocar un servicio lo elige y avanza, igual que en el paso del barbero: un
 * botón "Continuar" aparte sería un toque más para decir lo mismo.
 */
export default function ServicioScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();
  const { goBack, changeBarber } = useBookingNavigation();
  const ready = useRequireBooking(['barber']);
  const { barber, service, setService } = useBooking();

  const catalogo = useAsync(() => getServices(), []);
  const grupos = useMemo(() => agruparPorCategoria(catalogo.data ?? []), [catalogo.data]);

  const elegir = useCallback(
    (elegido: Service) => {
      setService(elegido);
      router.push('/reserva/fecha');
    },
    [router, setService],
  );

  if (!ready || barber === null) {
    return null;
  }

  return (
    <SafeAreaView edges={['bottom', 'left', 'right']} style={styles.container}>
      <StepHeader step={3} label="Servicio" onBack={goBack} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={catalogo.refreshing}
            onRefresh={catalogo.reload}
            tintColor={colors.primaryText}
            colors={[colors.primary]}
          />
        }
      >
        <BarberChip barber={barber} onChange={changeBarber} />

        <View style={styles.heading}>
          <Text style={styles.title}>Elige el servicio</Text>
          <Text style={styles.subtitle}>Qué te vas a hacer en esta cita</Text>
        </View>

        {catalogo.loading && !catalogo.refreshing ? (
          <LoadingState label="Cargando los servicios..." slow={catalogo.slow} />
        ) : null}

        {catalogo.error !== null ? (
          <ErrorState error={catalogo.error} onRetry={catalogo.reload} />
        ) : null}

        {catalogo.data?.length === 0 ? (
          <Text style={styles.empty}>Todavía no hay servicios publicados.</Text>
        ) : null}

        {grupos.map((grupo) => (
          <View key={grupo.categoria} style={styles.grupo}>
            <Text style={styles.categoria}>{grupo.categoria}</Text>

            {grupo.servicios.map((item) => {
              const elegido = service?.id === item.id;
              return (
                <Card
                  key={item.id}
                  onPress={() => elegir(item)}
                  accessibilityLabel={`Elegir ${item.name}, ${formatCop(item.priceCop)}`}
                >
                  <View style={styles.row}>
                    <View style={styles.info}>
                      <Text style={styles.name}>{item.name}</Text>
                      {item.description.length > 0 ? (
                        <Text style={styles.description} numberOfLines={2}>
                          {item.description}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.price}>{formatCop(item.priceCop)}</Text>
                    <Ionicons
                      name={elegido ? 'checkmark-circle' : 'chevron-forward'}
                      size={20}
                      color={colors.primaryText}
                    />
                  </View>
                </Card>
              );
            })}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  title: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  empty: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  grupo: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  categoria: {
    ...typography.micro,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  price: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
});
