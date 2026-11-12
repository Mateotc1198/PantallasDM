/**
 * Devuelve a su estado inicial los dobles de uno o varios módulos.
 *
 * Existe en vez de jest.resetAllMocks() porque ese es global: también le
 * quita la implementación al almacenamiento en memoria de setup.ts, y sin
 * él ni el tema ni la sesión pueden arrancar.
 *
 * Se filtra con isMockFunction porque un módulo automockeado exporta además
 * la marca __esModule, que no es una función.
 */
export function reiniciarDobles(...modulos: object[]): void {
  for (const modulo of modulos) {
    for (const exportado of Object.values(modulo)) {
      if (jest.isMockFunction(exportado)) {
        exportado.mockReset();
      }
    }
  }
}
