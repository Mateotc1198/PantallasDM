import { Platform, type TextStyle } from 'react-native';

/**
 * Design tokens.
 *
 * Los colores viven en dos paletas y se eligen en tiempo de ejecución; el
 * resto (espaciado, radios, tipografía) no depende del tema y es constante.
 *
 * No se exporta un objeto `colors` suelto a propósito: si existiera, un
 * componente podría importarlo y quedarse clavado en una paleta sin que
 * nadie lo notara. El único camino para obtener colores es useTheme().
 */

export type ThemeName = 'dark' | 'light';

export interface Palette {
  /** Fondo de la pantalla. */
  bg: string;
  /** Tarjetas y superficies elevadas. */
  surface: string;
  /** Barras y pies de página. */
  surfaceAlt: string;
  border: string;

  /**
   * Naranja de marca. NO cambia entre temas: la identidad visual no depende
   * de la preferencia del usuario. Se usa como relleno, no como texto.
   */
  primary: string;
  primaryDark: string;
  /**
   * El mismo acento, pero legible COMO TEXTO sobre el fondo.
   *
   * El naranja de marca sobre blanco da 2.2:1 de contraste, muy por debajo
   * del 4.5:1 que pide WCAG AA para texto. En claro se oscurece; en oscuro
   * el naranja ya contrasta de sobra y es idéntico a primary.
   */
  primaryText: string;
  /** Texto e iconos encima de un relleno primary. */
  onPrimary: string;
  primarySoft: string;

  free: string;
  freeText: string;
  busy: string;

  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  disabledBg: string;

  whatsapp: string;

  /**
   * El hero es una fotografía oscurecida en AMBOS temas, así que su texto
   * se mantiene claro siempre. Usar textPrimary ahí dejaría letras casi
   * negras sobre una foto oscura en cuanto se activara el modo claro.
   */
  heroOverlay: string;
  heroText: string;
  heroTextMuted: string;
}

export const darkPalette: Palette = {
  bg: '#121014',
  surface: '#1C191F',
  surfaceAlt: '#17161B',
  border: '#2A272F',

  primary: '#F5910E',
  primaryDark: '#D97C08',
  primaryText: '#F5910E',
  onPrimary: '#1A1A1A',
  primarySoft: 'rgba(245,145,14,0.15)',

  free: '#22C55E',
  freeText: '#4ADE80',
  busy: '#EF4444',

  textPrimary: '#FFFFFF',
  textSecondary: '#9B96A3',
  textMuted: '#6B6673',
  disabledBg: '#2C2A30',

  whatsapp: '#25D366',

  heroOverlay: 'rgba(0,0,0,0.6)',
  heroText: '#FFFFFF',
  heroTextMuted: '#D8D5DD',
};

/**
 * Paleta clara.
 *
 * Toma de referencia el diseño de Figma (#e0e0e0 en bordes, grises de
 * texto), pero cada color de texto se ajustó para superar 4.5:1 de
 * contraste sobre su fondo. El gris #7a7a7a del diseño se queda en 3.5:1 y
 * no pasa, así que aquí es más oscuro.
 */
export const lightPalette: Palette = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F6F5F7',
  border: '#E0E0E0',

  primary: '#F5910E',
  primaryDark: '#D97C08',
  primaryText: '#A85C07',
  onPrimary: '#1A1A1A',
  primarySoft: 'rgba(245,145,14,0.15)',

  free: '#16A34A',
  freeText: '#15803D',
  busy: '#DC2626',

  textPrimary: '#1A1A1A',
  textSecondary: '#5F5B66',
  textMuted: '#6E6A76',
  disabledBg: '#ECEAEF',

  whatsapp: '#25D366',

  heroOverlay: 'rgba(0,0,0,0.55)',
  heroText: '#FFFFFF',
  heroTextMuted: '#D8D5DD',
};

export const palettes: Record<ThemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

/**
 * Sans geométrica del sistema. Evita @expo-google-fonts para no sumar
 * dependencias ni un gate de carga de fuentes en el layout raíz.
 */
export const fontFamily = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

/**
 * Escala tipográfica. No depende del tema: cambia el color, no el tamaño.
 * Cada entrada se compone dentro de StyleSheet.create en los componentes,
 * nunca se aplica como estilo inline suelto.
 */
export const typography = {
  heroTitle: { fontFamily, fontSize: 34, fontWeight: '700', lineHeight: 41 },
  resultTitle: { fontFamily, fontSize: 26, fontWeight: '700' },
  screenTitle: { fontFamily, fontSize: 24, fontWeight: '700' },
  profileName: { fontFamily, fontSize: 22, fontWeight: '700' },
  cardTitle: { fontFamily, fontSize: 16, fontWeight: '700' },
  button: { fontFamily, fontSize: 16, fontWeight: '700' },
  body: { fontFamily, fontSize: 14, fontWeight: '400' },
  bodyStrong: { fontFamily, fontSize: 14, fontWeight: '700' },
  caption: { fontFamily, fontSize: 13, fontWeight: '400' },
  meta: { fontFamily, fontSize: 12, fontWeight: '400' },
  overline: {
    fontFamily,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  micro: {
    fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
} satisfies Record<string, TextStyle>;
