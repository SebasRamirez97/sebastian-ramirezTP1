import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

export type EstadoPropuesta = 'pendiente' | 'aceptada' | 'rechazada';

export interface PropuestaPelicula {
  id: string;
  usuario_id: string;
  usuario_email?: string | null;
  titulo: string;
  descripcion: string;
  motivo: string;
  estado: EstadoPropuesta;
  respuesta_admin?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface CrearPropuestaDTO {
  titulo: string;
  descripcion: string;
  motivo: string;
}

@Injectable({
  providedIn: 'root',
})
export class PropuestasService {
  /**
   * Obtiene la propuesta activa ('pendiente') del usuario actual, si existe
   */
  async getPropuestaPendienteUsuario(usuarioId: string): Promise<PropuestaPelicula | null> {
    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .eq('estado', 'pendiente')
      .maybeSingle();

    if (error) {
      throw new Error(`Error al consultar propuesta pendiente: ${error.message}`);
    }

    return (data as PropuestaPelicula) || null;
  }

  /**
   * Lista el historial de propuestas de un usuario
   */
  async getMisPropuestas(usuarioId: string): Promise<PropuestaPelicula[]> {
    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al obtener tus propuestas: ${error.message}`);
    }

    return (data as PropuestaPelicula[]) || [];
  }

  /**
   * Crea una nueva propuesta verificando que no tenga otra 'pendiente'
   */
  async crearPropuesta(
    dto: CrearPropuestaDTO,
    usuarioId: string,
    usuarioEmail?: string | null,
  ): Promise<PropuestaPelicula> {
    const pendiente = await this.getPropuestaPendienteUsuario(usuarioId);
    if (pendiente) {
      throw new Error(
        'Ya tenés una propuesta pendiente de revisión. Solo podés tener una propuesta activa a la vez.',
      );
    }

    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .insert([
        {
          usuario_id: usuarioId,
          usuario_email: usuarioEmail ?? null,
          titulo: dto.titulo.trim(),
          descripcion: dto.descripcion.trim(),
          motivo: dto.motivo.trim(),
          estado: 'pendiente',
        },
      ])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Ya tenés una propuesta pendiente de revisión.');
      }
      throw new Error(`No se pudo enviar la propuesta: ${error.message}`);
    }

    return data as PropuestaPelicula;
  }

  /**
   * Obtiene todas las propuestas para el panel de administración
   */
  async getTodasLasPropuestas(): Promise<PropuestaPelicula[]> {
    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Error al cargar las propuestas: ${error.message}`);
    }

    return (data as PropuestaPelicula[]) || [];
  }

  /**
   * Marca una propuesta como 'aceptada'
   */
  async aceptarPropuesta(propuestaId: string, respuestaAdmin?: string): Promise<PropuestaPelicula> {
    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .update({
        estado: 'aceptada',
        respuesta_admin: respuestaAdmin?.trim() || 'Propuesta aceptada para evaluación en cartelera.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', propuestaId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al aceptar propuesta: ${error.message}`);
    }

    return data as PropuestaPelicula;
  }

  /**
   * Marca una propuesta como 'rechazada'
   */
  async rechazarPropuesta(propuestaId: string, respuestaAdmin?: string): Promise<PropuestaPelicula> {
    const { data, error } = await supabase
      .from('propuestas_peliculas')
      .update({
        estado: 'rechazada',
        respuesta_admin: respuestaAdmin?.trim() || 'No se puede programar por el momento.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', propuestaId)
      .select()
      .single();

    if (error) {
      throw new Error(`Error al rechazar propuesta: ${error.message}`);
    }

    return data as PropuestaPelicula;
  }
}