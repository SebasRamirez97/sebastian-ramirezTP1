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
  duracion: number;
  sinopsis: string;
  genero: string[] | string;        // 👈 Nueva
  limite_edad: string;    // 👈 Nueva
  puntaje?: number;
  created_at?: string;
  cantidad_veces_vendida?: number;
}