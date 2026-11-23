export interface Resena {
  id?: string;
  pelicula_id: string;
  cliente_id: string;
  cliente_nombre?: string;
  puntaje: number; // De 1 a 5
  comentario: string;
  created_at?: string;
}

export interface Pelicula {
  id: string;
  nombre: string;
  fecha_estreno: string;
  imagen: string;
  poster_url?: string;
  duracion: number;
  sinopsis: string;
  genero: string[] | string;
  limite_edad: string;
  puntaje?: number;
  created_at?: string;
  cantidad_veces_vendida?: number;

  // 🎟️ Configuración de preventa por película
  preventa_activa?: boolean;
  dias_preventa?: number; // Por defecto 7 días antes de fecha_estreno
  precio_preventa_pesos?: number | null;
  precio_preventa_puntos?: number | null;
}