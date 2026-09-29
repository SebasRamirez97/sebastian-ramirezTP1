export interface Resena {
  id?: string;
  pelicula_id: string;
  cliente_id: string;
  puntaje: number; // De 1 a 5
  comentario: string;
  created_at?: string;
}

export interface Pelicula {
  id?: string;
  nombre: string;
  fecha_estreno: string;
  imagen: string; // URL de la imagen
  duracion: number; // En minutos
  sinopsis: string;
  puntaje?: number;
  resenas?: Resena[];
}