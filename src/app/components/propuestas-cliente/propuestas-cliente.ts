import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { supabase } from '../../services/supabaseClient';
import { PropuestasService, PropuestaPelicula } from '../../services/propuestas.service';

@Component({
  selector: 'app-propuestas-cliente',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './propuestas-cliente.html',
  styleUrl: './propuestas-cliente.css',
})
export class PropuestasClienteComponent implements OnInit {
  private propuestasService = inject(PropuestasService);

  cargando = signal<boolean>(true);
  enviando = signal<boolean>(false);
  mensaje = signal<{ tipo: 'ok' | 'err'; texto: string } | null>(null);
  propuestaActiva = signal<PropuestaPelicula | null>(null);
  historial = signal<PropuestaPelicula[]>([]);

  titulo = '';
  descripcion = '';
  motivo = '';

  private usuarioId: string | null = null;
  private usuarioEmail: string | null = null;

  async ngOnInit(): Promise<void> {
    const { data } = await supabase.auth.getUser();
    this.usuarioId = data?.user?.id ?? null;
    this.usuarioEmail = data?.user?.email ?? null;
    await this.cargarDatos();
  }

  async cargarDatos(): Promise<void> {
    this.cargando.set(true);
    try {
      if (!this.usuarioId) {
        this.mensaje.set({ tipo: 'err', texto: 'Iniciá sesión para proponer una película.' });
        return;
      }

      const [activa, todas] = await Promise.all([
        this.propuestasService.getPropuestaPendienteUsuario(this.usuarioId),
        this.propuestasService.getMisPropuestas(this.usuarioId),
      ]);

      this.propuestaActiva.set(activa);
      this.historial.set(todas.filter((p) => p.id !== activa?.id));
    } catch (e: any) {
      this.mensaje.set({ tipo: 'err', texto: e.message });
    } finally {
      this.cargando.set(false);
    }
  }

  async enviarPropuesta(): Promise<void> {
    if (!this.usuarioId) return;

    if (!this.titulo.trim() || !this.descripcion.trim() || !this.motivo.trim()) {
      this.mensaje.set({ tipo: 'err', texto: 'Completá título, descripción y motivo.' });
      return;
    }

    this.enviando.set(true);
    this.mensaje.set(null);

    try {
      await this.propuestasService.crearPropuesta(
        {
          titulo: this.titulo,
          descripcion: this.descripcion,
          motivo: this.motivo,
        },
        this.usuarioId,
        this.usuarioEmail,
      );

      this.titulo = '';
      this.descripcion = '';
      this.motivo = '';
      this.mensaje.set({ tipo: 'ok', texto: '¡Propuesta enviada! Quedó pendiente de revisión.' });
      await this.cargarDatos();
    } catch (e: any) {
      this.mensaje.set({ tipo: 'err', texto: e.message });
    } finally {
      this.enviando.set(false);
    }
  }
}