import { Injectable } from '@angular/core';
import { supabase } from './supabaseClient';

export type AccionLog = 'CREAR_FUNCION' | 'MODIFICAR_PRECIO' | 'VALIDAR_QR';

export interface RegistrarLogParams {
  accion: AccionLog;
  entidad: 'funcion' | 'orden' | 'producto';
  entidadId: string | number;
  detalle: string;
  usuarioId?: string | null;
  usuarioEmail?: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class LogsService {
  private async resolverUsuarioActual(
    usuarioId?: string | null,
    usuarioEmail?: string | null,
  ): Promise<{ id: string | null; email: string | null }> {
    if (usuarioId || usuarioEmail) {
      return {
        id: usuarioId ?? null,
        email: usuarioEmail ?? null,
      };
    }

    const { data } = await supabase.auth.getUser();
    return {
      id: data?.user?.id ?? null,
      email: data?.user?.email ?? null,
    };
  }

  async registrarLog(params: RegistrarLogParams): Promise<void> {
    const usuario = await this.resolverUsuarioActual(params.usuarioId, params.usuarioEmail);

    const { error } = await supabase.from('logs_actividad').insert([
      {
        usuario_id: usuario.id,
        usuario_email: usuario.email,
        accion: params.accion,
        entidad: params.entidad,
        entidad_id: String(params.entidadId),
        detalle: params.detalle,
      },
    ]);

    if (error) {
      console.error('Error al registrar log de actividad:', error.message);
    }
  }

  async obtenerLogs(limite: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('logs_actividad')
      .select('*')
      .order('fecha_hora', { ascending: false })
      .limit(limite);

    if (error) {
      throw new Error(`Error al consultar logs de actividad: ${error.message}`);
    }

    return data || [];
  }
}