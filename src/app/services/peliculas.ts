import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase
import { Pelicula } from '../models/pelicula.model';

@Injectable({
  providedIn: 'root',
})
export class PeliculasService {
  constructor() {}

  // 1. Obtener todas las películas de la cartelera
  async getPeliculas(): Promise<Pelicula[]> {
    const { data, error } = await supabase
      .from('peliculas')
      .select('*')
      .order('nombre', { ascending: true }); // 👈 Ordenar por nombre evita errores de columnas faltantes

    if (error) {
      console.error('Error al consultar la tabla peliculas:', error.message);
      throw error;
    }

    return (data as Pelicula[]) || [];
  }

  // 2. Obtener una sola película por su ID
  async getPeliculaPorId(id: string): Promise<Pelicula | null> {
    const { data, error } = await supabase.from('peliculas').select('*').eq('id', id).single();

    if (error) {
      console.error(`Error al obtener la película con ID ${id}:`, error);
      throw error;
    }

    return data;
  }

  // 3. Crear una nueva película (Admin)
  async agregarPelicula(pelicula: Omit<Pelicula, 'id'>): Promise<Pelicula> {
    const { data, error } = await supabase.from('peliculas').insert([pelicula]).select().single();

    if (error) {
      console.error('Error al insertar película:', error);
      throw error;
    }

    return data;
  }

  // 4. Actualizar los datos de una película existente (Admin)
  async actualizarPelicula(id: string, cambios: Partial<Pelicula>): Promise<Pelicula> {
    const { data, error } = await supabase
      .from('peliculas')
      .update(cambios)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error(`Error al actualizar la película con ID ${id}:`, error);
      throw error;
    }

    return data;
  }

  // 5. Eliminar una película por su ID (Admin)
  async eliminarPelicula(id: string): Promise<void> {
    const { error } = await supabase.from('peliculas').delete().eq('id', id);

    if (error) {
      console.error(`Error al eliminar la película con ID ${id}:`, error);
      throw error;
    }
  }

  // 🔹 Subir imagen a Supabase Storage y retornar su URL pública
  async subirImagen(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`; // Nombre único basado en timestamp
    const filePath = fileName;

    // 1. Subir archivo al bucket 'posters'
    const { error: uploadError } = await supabase.storage.from('posters').upload(filePath, file);

    if (uploadError) {
      console.error('Error al subir imagen:', uploadError.message);
      throw uploadError;
    }

    // 2. Obtener URL pública
    const { data } = supabase.storage.from('posters').getPublicUrl(filePath);

    return data.publicUrl;
  }

  // 🔹 Obtener las N películas con mayor puntaje (para el Home)
  async getTopPeliculas(limite: number = 3): Promise<Pelicula[]> {
  const { data, error } = await supabase
    .from('peliculas')
    .select('*')
    .order('cantidad_veces_vendida', { ascending: false }) // 👈 Cambiado: ordena de mayor a menor ventas
    .limit(limite); // Trae las primeras 3 (o el límite especificado)

  if (error) {
    console.error('Error al obtener películas más vendidas:', error.message);
    throw error;
  }

  return (data as Pelicula[]) || [];
}
}
