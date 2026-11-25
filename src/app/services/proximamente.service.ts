import { Injectable, OnDestroy, inject, signal } from '@angular/core';
import { supabase } from './supabaseClient';
import { PeliculasService } from './peliculas';
import { PreventaService } from './preventa.service';
import { Pelicula } from '../models/pelicula.model';
import { formatearFechaLocal, obtenerHoyLocal } from '../utils/fechas.util';

export interface AvisoEstrenoPreventa {
  peliculaId: string;
  nombrePelicula: string;
  enPreventa: boolean;
  porcentajePreventa: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProximamenteService implements OnDestroy {
  private peliculasService = inject(PeliculasService);
  private preventaService = inject(PreventaService);

  alertasActivasIds = signal<Set<string>>(new Set());
  avisosDisponibles = signal<AvisoEstrenoPreventa[]>([]);

  private intervaloChequeo: ReturnType<typeof setInterval> | null = null;
  private listenerVisibilidad: (() => void) | null = null;
  private usuarioMonitoreadoId: string | null = null;

  iniciarMonitoreoGlobal(usuarioId: string): void {
    if (!usuarioId) return;

    if (this.usuarioMonitoreadoId === usuarioId && this.intervaloChequeo !== null) {
      return;
    }

    this.detenerMonitoreoGlobal();
    this.usuarioMonitoreadoId = usuarioId;

    const ejecutarChequeo = async (): Promise<void> => {
      try {
        await this.cargarAlertasUsuario(usuarioId);
        await this.verificarEntradasDisponibles(usuarioId);
      } catch (err) {
        console.error('Error en monitoreo global de preventas:', err);
      }
    };

    void ejecutarChequeo();

    this.intervaloChequeo = setInterval(() => {
      void ejecutarChequeo();
    }, 60_000);

    if (typeof document !== 'undefined') {
      this.listenerVisibilidad = () => {
        if (document.visibilityState === 'visible') {
          void ejecutarChequeo();
        }
      };
      document.addEventListener('visibilitychange', this.listenerVisibilidad);
    }
  }

  detenerMonitoreoGlobal(): void {
    if (this.intervaloChequeo !== null) {
      clearInterval(this.intervaloChequeo);
      this.intervaloChequeo = null;
    }
    if (this.listenerVisibilidad && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.listenerVisibilidad);
      this.listenerVisibilidad = null;
    }
    this.usuarioMonitoreadoId = null;
  }

  ngOnDestroy(): void {
    this.detenerMonitoreoGlobal();
  }

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

      await this.verificarEntradasDisponibles(usuarioId);
      return true;
    }
  }

  /**
   * Notifica cuando una película con alerta activa entra en ventana de preventa
   * (o ya se estrenó / tiene funciones disponibles en preventa).
   */
  async verificarEntradasDisponibles(usuarioId: string): Promise<void> {
    const { data: alertas, error } = await supabase
      .from('alertas_estreno')
      .select(
        `
        id,
        pelicula_id,
        notificado,
        peliculas (
          id,
          nombre,
          fecha_estreno,
          preventa_activa,
          dias_preventa,
          porcentaje_preventa
        )
      `,
      )
      .eq('usuario_id', usuarioId)
      .eq('notificado', false);

    if (error || !alertas || alertas.length === 0) return;

    const hoy = obtenerHoyLocal();
    const nuevosAvisos: AvisoEstrenoPreventa[] = [...this.avisosDisponibles()];

    for (const alerta of alertas as any[]) {
      const peli = Array.isArray(alerta.peliculas) ? alerta.peliculas[0] : alerta.peliculas;
      if (!peli) continue;

      const estadoPrev = this.preventaService.evaluarPeliculaYFuncion(peli, null);
      const estrenoStr = peli.fecha_estreno ? formatearFechaLocal(peli.fecha_estreno) : '';
      const yaEstrenada = Boolean(estrenoStr && hoy >= estrenoStr);

      const { data: funciones } = await supabase
        .from('funciones')
        .select('id')
        .eq('pelicula_id', alerta.pelicula_id)
        .limit(1);

      const tieneFunciones = Boolean(funciones && funciones.length > 0);
      const habilitadaParaVenta = estadoPrev.enPreventa || yaEstrenada;

      if (habilitadaParaVenta && (estadoPrev.enPreventa || tieneFunciones)) {
        const nombrePeli = peli.nombre || 'una película que seguías';

        if (!nuevosAvisos.some((a) => a.peliculaId === alerta.pelicula_id)) {
          nuevosAvisos.push({
            peliculaId: alerta.pelicula_id,
            nombrePelicula: nombrePeli,
            enPreventa: estadoPrev.enPreventa,
            porcentajePreventa: estadoPrev.porcentajePreventa,
          });
        }

        if (estadoPrev.enPreventa) {
          await this.dispararNotificacionPushLocal(
            '🎟️ ¡Entró en preventa!',
            `"${nombrePeli}" ya está en preventa anticipada (+${estadoPrev.porcentajePreventa}%).`,
          );
        } else {
          await this.dispararNotificacionPushLocal(
            '🎬 ¡Entradas disponibles!',
            `Ya salieron a la venta las entradas para "${nombrePeli}".`,
          );
        }

        await supabase
          .from('alertas_estreno')
          .update({ notificado: true })
          .eq('id', alerta.id);
      }
    }

    this.avisosDisponibles.set(nuevosAvisos);
  }
}