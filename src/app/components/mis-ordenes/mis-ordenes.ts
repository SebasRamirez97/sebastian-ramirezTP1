import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { supabase } from '../../services/supabaseClient';

@Component({
  selector: 'app-mis-ordenes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mis-ordenes.html',
  styleUrls: ['./mis-ordenes.css']
})
export class MisOrdenesComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private router = inject(Router);

  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  misOrdenes = signal<any[]>([]);
  cargando = signal<boolean>(true);
  ordenSeleccionada = signal<any | null>(null); // Para el modal de detalles y QR

  async ngOnInit(): Promise<void> {
    await this.cargarMisOrdenes();
  }

  async cargarMisOrdenes(): Promise<void> {
    try {
      this.cargando.set(true);
      const { data: authData } = await supabase.auth.getUser();
      const usuarioId = authData?.user?.id;

      if (!usuarioId) {
        this.cargando.set(false);
        return;
      }

      const { data, error } = await supabase
        .from('ordenes')
        .select(`
          id,
          codigo_retiro,
          metodo_pago,
          total,
          created_at,
          items_candy,
          entradas (
            id,
            fila,
            numero_asiento,
            estado,
            funciones (
              fecha_inicio,
              formato,
              salas (nombre),
              peliculas (nombre, imagen)
            )
          )
        `)
        .eq('usuario_id', usuarioId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.misOrdenes.set(data || []);

    } catch (error: any) {
      console.error('Error al cargar órdenes:', error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // 🔹 Funciones trackBy para los bucles *ngFor
  trackByOrden(index: number, orden: any): string {
    return orden.id;
  }

  trackByEntrada(index: number, entrada: any): string {
    return entrada.id;
  }

  trackByCandy(index: number, candy: any): string {
    return candy.nombre;
  }

  verDetallesOrden(orden: any): void {
    this.ordenSeleccionada.set(orden);
  }

  cerrarDetalles(): void {
    this.ordenSeleccionada.set(null);
  }

  volver(): void {
    this.router.navigate(['/home']);
  }
}