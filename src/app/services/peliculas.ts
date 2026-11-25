import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase
import { Pelicula } from '../models/pelicula.model';
import { formatearFechaLocal, obtenerHoyLocal } from '../utils/fechas.util';

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
      .order('nombre', { ascending: true });

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

  // 🔹 Incrementa `cantidad_veces_vendida` sumando los asientos aprobados de la orden
  async incrementarCantidadVendida(peliculaId: string, cantidad: number): Promise<void> {
    if (!peliculaId || !cantidad || cantidad <= 0) return;

    const { data: pelicula, error: errorConsulta } = await supabase
      .from('peliculas')
      .select('cantidad_veces_vendida')
      .eq('id', peliculaId)
      .single();

    if (errorConsulta || !pelicula) {
      console.error(`Error al consultar cantidad_veces_vendida para película ${peliculaId}:`, errorConsulta?.message);
      return;
    }

    const actual = Number(pelicula.cantidad_veces_vendida) || 0;
    const nuevoTotal = actual + Number(cantidad);

    const { error: errorUpdate } = await supabase
      .from('peliculas')
      .update({ cantidad_veces_vendida: nuevoTotal })
      .eq('id', peliculaId);

    if (errorUpdate) {
      console.error(`Error al actualizar cantidad_veces_vendida para película ${peliculaId}:`, errorUpdate.message);
    }
  }

  // 🔹 Subir imagen a Supabase Storage y retornar su URL pública
  async subirImagen(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = fileName;

    const { error: uploadError } = await supabase.storage.from('posters').upload(filePath, file);

    if (uploadError) {
      console.error('Error al subir imagen:', uploadError.message);
      throw uploadError;
    }

    const { data } = supabase.storage.from('posters').getPublicUrl(filePath);

    return data.publicUrl;
  }

  // 🔹 Obtener las N películas con mayor cantidad de ventas
  async getTopPeliculas(limite: number = 3): Promise<Pelicula[]> {
    const { data, error } = await supabase
      .from('peliculas')
      .select('*')
      .order('cantidad_veces_vendida', { ascending: false })
      .limit(limite);

    if (error) {
      console.error('Error al obtener películas más vendidas:', error.message);
      throw error;
    }

    return (data as Pelicula[]) || [];
  }

  // 🔹 Obtener películas próximas a estrenarse (fecha_estreno posterior a hoy)
  async getPeliculasProximamente(): Promise<Pelicula[]> {
    const hoyLocal = obtenerHoyLocal();

    const { data, error } = await supabase
      .from('peliculas')
      .select('*')
      .gt('fecha_estreno', hoyLocal)
      .order('fecha_estreno', { ascending: true });

    if (error) {
      console.error('Error al obtener películas próximamente:', error.message);
      throw error;
    }

    return (data as Pelicula[]) || [];
  }

  // 🔹 Verifica si hoy está dentro de la ventana válida de preventa de la película
  estaEnPreventaActiva(pelicula: Pelicula): boolean {
    if (!pelicula?.fecha_estreno) return false;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(pelicula.fecha_estreno);
    if (!estreno || hoy >= estreno) return false;

    if (!pelicula.preventa_activa) return false;

    const diasPreventa = Number(pelicula.dias_preventa ?? 7);
    const [anio, mes, dia] = estreno.split('-').map(Number);
    const fechaInicioPreventa = formatearFechaLocal(
      new Date(anio, mes - 1, dia - diasPreventa),
    );

    return hoy >= fechaInicioPreventa && hoy < estreno;
  }

  // 🔹 Determina si la película corresponde mostrarla en cartelera
  esVisibleEnCartelera(pelicula: Pelicula): boolean {
    if (!pelicula?.fecha_estreno) return true;

    const hoy = obtenerHoyLocal();
    const estreno = formatearFechaLocal(pelicula.fecha_estreno);
    if (!estreno) return true;

    if (hoy >= estreno) return true;

    return this.estaEnPreventaActiva(pelicula);
  }
}