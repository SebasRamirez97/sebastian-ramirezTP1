import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

@Injectable({
  providedIn: 'root',
})
export class ResenasService {
  
  // Obtener reseñas de una película incluyendo el nombre y apellido del cliente
  async getResenasPorPelicula(peliculaId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('resenas')
      .select(`
        id,
        pelicula_id,
        cliente_id,
        puntaje,
        comentario,
        created_at,
        clientes (
          nombre,
          apellido
        )
      `)
      .eq('pelicula_id', peliculaId)
      .order('created_at', { ascending: false }); // Más reciente arriba

    if (error) {
      console.error('Error al obtener reseñas:', error.message);
      throw error;
    }
    return data || [];
  }

  // Guardar o actualizar la reseña del cliente (Una por película)
  async guardarResena(peliculaId: string, clienteId: string, puntaje: number, comentario: string): Promise<void> {
    // 1. Verificamos si ya existe una reseña de este cliente para esta película
    const { data: existente } = await supabase
      .from('resenas')
      .select('id')
      .eq('pelicula_id', peliculaId)
      .eq('cliente_id', clienteId)
      .maybeSingle();

    if (existente) {
      // Si ya existe, la actualizamos (Editar)
      const { error } = await supabase
        .from('resenas')
        .update({ puntaje, comentario, created_at: new Date().toISOString() }) // Actualiza fecha para subirla al tope si se edita
        .eq('id', existente.id);

      if (error) throw error;
    } else {
      // Si no existe, la creamos por primera vez
      const { error } = await supabase
        .from('resenas')
        .insert([{ pelicula_id: peliculaId, cliente_id: clienteId, puntaje, comentario }]);

      if (error) throw error;
    }

    // 2. Opcional: Recalcular y actualizar el promedio de puntaje en la tabla peliculas
    await this.actualizarPromedioPelicula(peliculaId);
  }

  private async actualizarPromedioPelicula(peliculaId: string): Promise<void> {
    const { data: resenas } = await supabase
      .from('resenas')
      .select('puntaje')
      .eq('pelicula_id', peliculaId);

    if (resenas && resenas.length > 0) {
      const suma = resenas.reduce((acc, r) => acc + (r.puntaje || 0), 0);
      const promedio = Number((suma / resenas.length).toFixed(2));

      await supabase
        .from('peliculas')
        .update({ puntaje: promedio })
        .eq('id', peliculaId);
    }
  }
}