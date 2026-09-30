export type FormatoSala = '2D' | '3D' | '4D' | '5D';

export interface Sala {
  id: string;
  nombre: string;       // Ej: "Sala 1", "Sala 5"
  formato: FormatoSala; // '2D' | '3D' | '4D' | '5D'
  capacidad: number;    // 532 asientos
}

export interface Funcion {
  id?: string;
  pelicula_id: string;
  sala_id: string;
  formato: FormatoSala;
  fecha_inicio: string; // Formato ISO 8601 (ej: "2026-10-15T18:00:00.000Z")
  fecha_fin: string;    // Calculado: fecha_inicio + duración de la película
  precio_pesos: number;
  precio_puntos: number;
  created_at?: string;

  // Propiedades opcionales para binding directo en vistas (mediante JOIN en Supabase)
  pelicula_nombre?: string;
  sala_nombre?: string;
}

/**
 * Datos requeridos para que el Admin cree una función.
 * La sala_id y la fecha_fin se calculan automáticamente en el servicio.
 */
export interface CrearFuncionDTO {
  pelicula_id: string;
  formato: FormatoSala;
  fecha_inicio: string; // Formato de input datetime-local
  precio_pesos: number;
  precio_puntos: number;
}