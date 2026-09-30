import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase
import { Funcion, CrearFuncionDTO, Sala } from '../models/funcion.model';

@Injectable({
  providedIn: 'root',
})
export class FuncionesService {

  /**
   * Obtiene todas las funciones registradas con datos de película y sala
   */
  async getFunciones(): Promise<Funcion[]> {
    const { data, error } = await supabase
      .from('funciones')
      .select(`
        *,
        peliculas ( nombre ),
        salas ( nombre )
      `)
      .order('fecha_inicio', { ascending: true }); // 👈 Agregamos el ordenamiento cronológico

    if (error) {
      console.error('Error al obtener funciones:', error.message);
      throw error;
    }

    return (data as Funcion[]) || [];
  }

  async getFuncionPorId(id: string | number): Promise<any> {
    const { data, error } = await supabase
      .from('funciones')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Error al obtener la función: ${error.message}`);
    }
    return data;
  }

  async getFuncionesPorPelicula(peliculaId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('funciones')
      .select(`
        *,
        salas ( nombre ) 
      `) // 👈 Agregamos la relación para traer el nombre de la sala
      .eq('pelicula_id', peliculaId)
      .order('fecha_inicio', { ascending: true }); // Ordenadas por fecha

    if (error) {
      throw error;
    }
    
    return data || [];
  }

  async actualizarFuncion(id: string | number, dto: any): Promise<void> {
    const { error } = await supabase
      .from('funciones')
      .update({
        pelicula_id: dto.pelicula_id,
        formato: dto.formato,
        fecha_inicio: dto.fecha_inicio,
        precio_pesos: dto.precio_pesos,
        precio_puntos: dto.precio_puntos
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Error al actualizar la función: ${error.message}`);
    }
  }

  /**
   * Crea una función asignando automáticamente una sala libre del formato solicitado
   * y garantizando 30 minutos de separación entre funciones.
   */
  async crearFuncion(dto: CrearFuncionDTO): Promise<Funcion> {
    // 1. Obtener la duración de la película para calcular fecha_fin
    const { data: pelicula, error: errorPelicula } = await supabase
      .from('peliculas')
      .select('duracion')
      .eq('id', dto.pelicula_id)
      .single();

    if (errorPelicula || !pelicula) {
      throw new Error('Película no encontrada.');
    }

    

    // 2. Calcular horario de inicio y fin
    const inicio = new Date(dto.fecha_inicio);
    const fin = new Date(inicio.getTime() + pelicula.duracion * 60000);

    // 3. Buscar salas de ese formato (2D, 3D, 4D o 5D)
    const { data: salasCandidatas, error: errorSalas } = await supabase
      .from('salas')
      .select('*')
      .eq('formato', dto.formato);

    if (errorSalas || !salasCandidatas || salasCandidatas.length === 0) {
      throw new Error(`No hay salas registradas para el formato ${dto.formato}.`);
    }

    // 4. Evaluar qué sala tiene los 30 minutos libres antes y después
    let salaDisponibleId: string | null = null;

    for (const sala of salasCandidatas as Sala[]) {
      const disponible = await this.validarDisponibilidadSala(sala.id, inicio, fin);
      if (disponible) {
        salaDisponibleId = sala.id;
        break; // Asigna la primera sala compatible disponible
      }
    }

    if (!salaDisponibleId) {
      throw new Error(
        `No hay salas ${dto.formato} disponibles en este horario. Se requieren al menos 30 minutos de separación entre funciones.`
      );
    }

    // 5. Insertar la función en Supabase
    const nuevaFuncion = {
      pelicula_id: dto.pelicula_id,
      sala_id: salaDisponibleId,
      formato: dto.formato,
      fecha_inicio: inicio.toISOString(),
      fecha_fin: fin.toISOString(),
      precio_pesos: dto.precio_pesos,
      precio_puntos: dto.precio_puntos,
    };

    const { data, error } = await supabase
      .from('funciones')
      .insert([nuevaFuncion])
      .select()
      .single();

    if (error) {
      throw new Error(`Error al guardar la función: ${error.message}`);
    }

    return data as Funcion;
  }

  async eliminarFuncion(id: string | number): Promise<void> {
    const { error } = await supabase
      .from('funciones')
      .delete()
      .eq('id', id);

    if (error) {
      // Si la base de datos rechaza el borrado por tener entradas vinculadas (Foreign Key constraint)
      if (error.code === '23503') {
        throw new Error('No se puede eliminar la función porque ya tiene entradas vendidas.');
      }
      throw new Error(`Error al eliminar: ${error.message}`);
    }
  }

  /**
   * Verifica si una sala específica está libre para la franja horaria + 30 min de margen
   */
  private async validarDisponibilidadSala(
    salaId: string,
    nuevoInicio: Date,
    nuevoFin: Date
  ): Promise<boolean> {
    const { data: funcionesExistentes, error } = await supabase
      .from('funciones')
      .select('fecha_inicio, fecha_fin')
      .eq('sala_id', salaId);

    if (error || !funcionesExistentes) return true;

    const MARGEN_MS = 30 * 60000; // 30 minutos en milisegundos

    for (const f of funcionesExistentes) {
      const existInicio = new Date(f.fecha_inicio).getTime();
      const existFinConMargen = new Date(f.fecha_fin).getTime() + MARGEN_MS;

      const inicioPropuesto = nuevoInicio.getTime();
      const finPropuestoConMargen = nuevoFin.getTime() + MARGEN_MS;

      // Solapamiento considerando el margen de 30 minutos
      const haySolapamiento =
        inicioPropuesto < existFinConMargen && finPropuestoConMargen > existInicio;

      if (haySolapamiento) {
        return false; // Sala ocupada
      }
    }

    return true; // Sala disponible
  }
}