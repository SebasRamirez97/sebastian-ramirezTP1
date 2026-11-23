import { Injectable, inject, signal } from '@angular/core';
import { supabase } from './supabaseClient';
import { PeliculasService } from './peliculas';
import { Pelicula } from '../models/pelicula.model';

@Injectable({
  providedIn: 'root',
})
export class ProximamenteService {
  private peliculasService = inject(PeliculasService);

  alertasActivasIds = signal<Set<string>>(new Set());
  avisosDisponibles = signal<any[]>([]);

  async solicitarPermisoPushSiNecesario(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    if (Notification.permission === 'granted') {
      return true;
    }
    if (Notification.permission !== 'denied') {
      const permiso = await Notification.requestPermission();
      return permiso === 'granted';
    }
    return false;
  }

  async dispararNotificacionPushLocal(titulo: string, cuerpo: string): Promise<void> {
    const habilitado = await this.solicitarPermisoPushSiNecesario();
    if (!habilitado) return;

    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.showNotification(titulo, {
            body: cuerpo,
            icon: '/assets/icons/icon-192x192.png',
          });
          return;
        }
      }
      new Notification(titulo, { body: cuerpo });
    } catch (err) {
      console.error('Error al mostrar notificación push:', err);
    }
  }

  async obtenerPeliculasProximamente(): Promise<Pelicula[]> {
    return this.peliculasService.getPeliculasProximamente();
  }

  async cargarAlertasUsuario(usuarioId: string): Promise<void> {
    const { data, error } = await supabase
      .from('alertas_estreno')
      .select('pelicula_id, notificado, peliculas(id, nombre, fecha_estreno)')
      .eq('usuario_id', usuarioId);

    if (!error && data) {
      const ids = new Set<string>(data.map((d: any) => d.pelicula_id));
      this.alertasActivasIds.set(ids);
    }
  }

  async toggleAlertaEstreno(usuarioId: string, pelicula: Pelicula): Promise<boolean> {
    const actuales = new Set(this.alertasActivasIds());
    const yaActiva = actuales.has(pelicula.id);

    if (yaActiva) {
      const { error } = await supabase
        .from('alertas_estreno')
        .delete()
        .eq('usuario_id', usuarioId)
        .eq('pelicula_id', pelicula.id);

      if (error) throw error;
      actuales.delete(pelicula.id);
      this.alertasActivasIds.set(actuales);
      return false;
    } else {
      await this.solicitarPermisoPushSiNecesario();

      const { error } = await supabase
        .from('alertas_estreno')
        .insert([{ usuario_id: usuarioId, pelicula_id: pelicula.id, notificado: false }]);

      if (error) throw error;
      actuales.add(pelicula.id);
      this.alertasActivasIds.set(actuales);
      return true;
    }
  }

  /**
   * Revisa si alguna película con alerta activada ya tiene funciones cargadas/disponibles
   * y notifica al usuario.
   */
  async verificarEntradasDisponibles(usuarioId: string): Promise<void> {
    const { data: alertas, error } = await supabase
      .from('alertas_estreno')
      .select('id, pelicula_id, notificado, peliculas(id, nombre)')
      .eq('usuario_id', usuarioId)
      .eq('notificado', false);

    if (error || !alertas || alertas.length === 0) return;

    const nuevosAvisos: any[] = [];

    for (const alerta of alertas as any[]) {
      const { data: funciones } = await supabase
        .from('funciones')
        .select('id')
        .eq('pelicula_id', alerta.pelicula_id)
        .limit(1);

      if (funciones && funciones.length > 0) {
        const nombrePeli = alerta.peliculas?.nombre || 'una película que seguías';
        nuevosAvisos.push({
          peliculaId: alerta.pelicula_id,
          nombrePelicula: nombrePeli,
        });

        await this.dispararNotificacionPushLocal(
          '¡Entradas disponibles!',
          `Ya salieron a la venta las entradas para "${nombrePeli}".`,
        );

        await supabase
          .from('alertas_estreno')
          .update({ notificado: true })
          .eq('id', alerta.id);
      }
    }

    if (nuevosAvisos.length > 0) {
      this.avisosDisponibles.set(nuevosAvisos);
    }
  }
}