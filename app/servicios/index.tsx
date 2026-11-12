import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '../../src/components/ErrorState';
import { FilterChip } from '../../src/components/FilterChip';
import { FooterCta } from '../../src/components/FooterCta';
import { LoadingState } from '../../src/components/LoadingState';
import { TopBar } from '../../src/components/TopBar';
import { getServices } from '../../src/data/services';
import { useAsync } from '../../src/hooks/useAsync';
import { useTheme } from '../../src/theme/ThemeContext';
import { radius, spacing, typography, type Palette } from '../../src/theme/tokens';
import { useThemedStyles } from '../../src/theme/useThemedStyles';
import type { Service } from '../../src/types/api';
import { formatCop } from '../../src/utils/money';

/** Criterios de orden del selector del diseño. */
type Orden = 'nombre' | 'precio';

const SIGUIENTE_ORDEN: Record<Orden, Orden> = { nombre: 'precio', precio: 'nombre' };
const ETIQUETA_ORDEN: Record<Orden, string> = { nombre: 'Nombre', precio: 'Precio' };

export default function ServiciosScreen() {
  const styles = useThemedStyles(makeStyles);
  const { colors } = useTheme();
  const router = useRouter();

  const [categoria, setCategoria] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<Orden>('nombre');

  const catalogo = useAsync(() => getServices(), []);

  /** Las categorías salen de los datos: el admin puede inventar una nueva. */
  const categorias = useMemo(() => {
    const vistas = new Set((catalogo.data ?? []).map((servicio) => servicio.category));
    // Con comparador de idioma: el sort() a secas ordena por código de
    // carácter, así que "Árbol" quedaría después de "Zapato" y las
    // mayúsculas antes que todas las minúsculas.
    return [...vistas].sort((a, b) => a.localeCompare(b, 'es'));
  }, [catalogo.data]);

  const visibles = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtrados = (catalogo.data ?? []).filter((servicio) => {
      const porCategoria = categoria === null || servicio.category === categoria;
      const porTexto =
        texto.length === 0 ||
        servicio.name.toLowerCase().includes(texto) ||
        servicio.description.toLowerCase().includes(texto);
      return porCategoria && porTexto;
    });

    // La API ya ordena por categoría y nombre; aquí solo se reordena si el
    // usuario pide precio, para no deshacer gratis lo que vino bien.
    return orden === 'precio'
      ? [...filtrados].sort((a, b) => a.priceCop - b.priceCop)
      : filtrados;
  }, [busqueda, catalogo.data, categoria, orden]);

  const agendar = useCallback(() => {
    router.push('/reserva/barbero');
  }, [router]);

  const hayCatalogo = (catalogo.data ?? []).length > 0;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.topBarArea}>
        <TopBar onClose={() => router.replace('/')} />
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={catalogo.refreshing}
            onRefresh={catalogo.reload}
            tintColor={colors.primaryText}
            colors={[colors.primary]}
          />
        }
      >
        <View style={styles.encabezado}>
          <Text style={styles.titulo}>Nuestros Servicios</Text>
          <Text style={styles.subtitulo}>Servicios disponibles</Text>
        </View>

        {catalogo.loading && !catalogo.refreshing ? (
          <LoadingState label="Cargando el catálogo..." slow={catalogo.slow} />
        ) : null}

        {catalogo.error !== null ? (
          <ErrorState error={catalogo.error} onRetry={catalogo.reload} />
        ) : null}

        {hayCatalogo ? (
          <>
            <View style={styles.filtros} accessibilityRole="radiogroup">
              <FilterChip
                label="Todos"
                selected={categoria === null}
                onPress={() => setCategoria(null)}
              />
              {categorias.map((nombre) => (
                <FilterChip
                  key={nombre}
                  label={nombre}
                  selected={categoria === nombre}
                  onPress={() => setCategoria(nombre)}
                />
              ))}
            </View>

            <View style={styles.herramientas}>
              <View style={styles.buscador}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  value={busqueda}
                  onChangeText={setBusqueda}
                  placeholder="Buscar..."
                  placeholderTextColor={colors.textMuted}
                  autoCorrect={false}
                  accessibilityLabel="Buscar un servicio"
                  style={styles.buscadorInput}
                />
              </View>

              {/*
                El diseño muestra un desplegable de orden. Con dos criterios
                reales, un botón que alterna hace lo mismo sin montar un
                selector modal para elegir entre dos cosas.
              */}
              <Pressable
                onPress={() => setOrden(SIGUIENTE_ORDEN[orden])}
                accessibilityRole="button"
                accessibilityLabel={`Ordenar por ${ETIQUETA_ORDEN[SIGUIENTE_ORDEN[orden]]}`}
                style={({ pressed }) => [styles.orden, pressed && styles.pressed]}
              >
                <Text style={styles.ordenLabel}>{ETIQUETA_ORDEN[orden]}</Text>
                <Ionicons name="swap-vertical" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {visibles.length === 0 ? (
              <Text style={styles.vacio}>No encontramos servicios con ese filtro.</Text>
            ) : null}

            {visibles.map((servicio) => (
              <ServicioCard key={servicio.id} servicio={servicio} />
            ))}
          </>
        ) : null}

        {!catalogo.loading && catalogo.error === null && !hayCatalogo ? (
          <Text style={styles.vacio}>Todavía no hay servicios publicados.</Text>
        ) : null}

        <View style={styles.pie}>
          <FooterCta onAgendar={agendar} />
        </View>
      </ScrollView>
    </View>
  );
}

function ServicioCard({ servicio }: { servicio: Service }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.tarjetaTexto}>
        <Text style={styles.tarjetaNombre}>{servicio.name}</Text>
        {servicio.description.length > 0 ? (
          <Text style={styles.tarjetaDescripcion}>{servicio.description}</Text>
        ) : null}
        <Text style={styles.tarjetaCategoria}>{servicio.category}</Text>
      </View>
      <Text style={styles.tarjetaPrecio}>{formatCop(servicio.priceCop)}</Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBarArea: {
    backgroundColor: colors.surfaceAlt,
  },
  content: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  encabezado: {
    gap: spacing.xs,
    // Deja sitio al interruptor de tema, que flota arriba a la derecha.
    paddingRight: 56,
  },
  titulo: {
    ...typography.screenTitle,
    color: colors.textPrimary,
  },
  subtitulo: {
    ...typography.body,
    color: colors.textSecondary,
  },
  filtros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  herramientas: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.xs,
  },
  buscador: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  buscadorInput: {
    flex: 1,
    ...typography.body,
    color: colors.textPrimary,
  },
  orden: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 40,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ordenLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tarjeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tarjetaTexto: {
    flex: 1,
    gap: 2,
  },
  tarjetaNombre: {
    ...typography.cardTitle,
    color: colors.textPrimary,
  },
  tarjetaDescripcion: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  tarjetaCategoria: {
    ...typography.micro,
    color: colors.textMuted,
    paddingTop: spacing.xs,
  },
  tarjetaPrecio: {
    ...typography.bodyStrong,
    color: colors.primaryText,
  },
  vacio: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.xl,
  },
  pie: {
    marginTop: spacing.lg,
    marginHorizontal: -spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
});
