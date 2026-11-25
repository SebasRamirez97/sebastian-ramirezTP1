import { Injectable,inject } from '@angular/core';
import { supabase } from './supabaseClient'; // Ajusta la ruta a tu cliente de Supabase
import { Funcion, CrearFuncionDTO, Sala } from '../models/funcion.model';
import { LogsService } from './logs.service';

@Injectable({
  providedIn: 'root',
})
export class FuncionesService {
  private logsService = inject(LogsService);

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
      .order('fecha_inicio', { ascending: true });

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
      `)
      .eq('pelicula_id', peliculaId)
      .order('fecha_inicio', { ascending: true });

    if (error) {
      throw error;
    }

    return data || [];
  }

  async actualizarFuncion(
    id: string | number,
    dto: any,
    usuarioActual?: { id?: string | null; email?: string | null },
  ): Promise<void> {
    // Obtenemos los valores previos para detectar cambios de precio y enriquecer el log
    const { data: funcionAnterior, error: errorPrev } = await supabase
      .from('funciones')
      .select('pelicula_id, formato, fecha_inicio, precio_pesos, precio_puntos, peliculas ( nombre )')
      .eq('id', id)
      .single();

    if (errorPrev || !funcionAnterior) {
      throw new Error(`Error al consultar la función antes de actualizar: ${errorPrev?.message || ''}`);
    }

    const { error } = await supabase
      .from('funciones')
      .update({
        pelicula_id: dto.pelicula_id,
        formato: dto.formato,
        fecha_inicio: dto.fecha_inicio,
        precio_pesos: dto.precio_pesos,
        precio_puntos: dto.precio_puntos,
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Error al actualizar la función: ${error.message}`);
    }

    const precioPesosAnterior = Number(funcionAnterior.precio_pesos);
    const precioPesosNuevo = Number(dto.precio_pesos);
    const precioPuntosAnterior = Number(funcionAnterior.precio_puntos);
    const precioPuntosNuevo = Number(dto.precio_puntos);

    const cambioPrecioPesos = precioPesosAnterior !== precioPesosNuevo;
    const cambioPrecioPuntos = precioPuntosAnterior !== precioPuntosNuevo;

    if (cambioPrecioPesos || cambioPrecioPuntos) {
      const nombrePelicula =
        (funcionAnterior as any)?.peliculas?.nombre || `Función ${id}`;

      const partesCambio: string[] = [];
      if (cambioPrecioPesos) {
        partesCambio.push(`precio $ de $${precioPesosAnterior} a $${precioPesosNuevo}`);
      }
      if (cambioPrecioPuntos) {
        partesCambio.push(`puntos de ${precioPuntosAnterior} a ${precioPuntosNuevo}`);
      }

      await this.logsService.registrarLog({
        accion: 'MODIFICAR_PRECIO',
        entidad: 'funcion',
        entidadId: id,
        detalle: `Modificó ${partesCambio.join(' y ')} en "${nombrePelicula}" (${dto.formato})`,
        usuarioId: usuarioActual?.id,
        usuarioEmail: usuarioActual?.email,
      });
    }
  }

  /**
   * Crea una función asignando automáticamente una sala libre del formato solicitado
   * y garantizando 30 minutos de separación entre funciones.
   */
  async crearFuncion(
    dto: CrearFuncionDTO,
    usuarioActual?: { id?: string | null; email?: string | null },
  ): Promise<Funcion> {
    const { data: pelicula, error: errorPelicula } = await supabase
      .from('peliculas')
      .select('id, nombre, duracion')
      .eq('id', dto.pelicula_id)
      .single();

    if (errorPelicula || !pelicula) {
      throw new Error('Película no encontrada.');
    }

    const inicio = new Date(dto.fecha_inicio);
    const fin = new Date(inicio.getTime() + pelicula.duracion * 60000);

    const { data: salasCandidatas, error: errorSalas } = await supabase
      .from('salas')
      .select('*')
      .eq('formato', dto.formato);

    if (errorSalas || !salasCandidatas || salasCandidatas.length === 0) {
      throw new Error(`No hay salas registradas para el formato ${dto.formato}.`);
    }

    let salaDisponibleId: string | null = null;
    let salaAsignadaNombre: string = '';

    for (const sala of salasCandidatas as Sala[]) {
      const disponible = await this.validarDisponibilidadSala(sala.id, inicio, fin);
      if (disponible) {
        salaDisponibleId = sala.id;
        salaAsignadaNombre = (sala as any).nombre || sala.id;
        break;
      }
    }

    if (!salaDisponibleId) {
      throw new Error(
        `No hay salas ${dto.formato} disponibles en este horario. Se requieren al menos 30 minutos de separación entre funciones.`,
      );
    }

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

    const fechaLegible = inicio.toLocaleString('es-AR', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    await this.logsService.registrarLog({
      accion: 'CREAR_FUNCION',
      entidad: 'funcion',
      entidadId: data.id,
      detalle: `Creó función de "${pelicula.nombre}" (${dto.formato}) en sala "${salaAsignadaNombre}" el ${fechaLegible} - $${dto.precio_pesos} / ${dto.precio_puntos} pts`,
      usuarioId: usuarioActual?.id,
      usuarioEmail: usuarioActual?.email,
    });

    return data as Funcion;
  }

  async eliminarFuncion(id: string | number): Promise<void> {
    const { error } = await supabase
      .from('funciones')
      .delete()
      .eq('id', id);

    if (error) {
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
    nuevoFin: Date,
  ): Promise<boolean> {
    const { data: funcionesExistentes, error } = await supabase
      .from('funciones')
      .select('fecha_inicio, fecha_fin')
      .eq('sala_id', salaId);

    if (error || !funcionesExistentes) return true;

    const MARGEN_MS = 30 * 60000;

    for (const f of funcionesExistentes) {
      const existInicio = new Date(f.fecha_inicio).getTime();
      const existFinConMargen = new Date(f.fecha_fin).getTime() + MARGEN_MS;

      const inicioPropuesto = nuevoInicio.getTime();
      const finPropuestoConMargen = nuevoFin.getTime() + MARGEN_MS;

      const haySolapamiento =
        inicioPropuesto < existFinConMargen && finPropuestoConMargen > existInicio;

      if (haySolapamiento) {
        return false;
      }
    }

    return true;
  }
}