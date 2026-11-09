import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminCuponesService } from '../../services/admin-cupones.service';
import { DateFormatPipe } from '../../pipes/date-format-pipe'; // 👈 Importa tu pipe

@Component({
  selector: 'app-tabla-cupones',
  standalone: true,
  imports: [CommonModule, FormsModule, DateFormatPipe], // 👈 Agrégalo aquí
  templateUrl: './tabla-cupones.html',
  styleUrls: ['./tabla-cupones.css']
})
export class TablaCuponesComponent implements OnInit {
  private couponService = inject(AdminCuponesService);

  // 🔹 Estados con Signals
  cupones = signal<any[]>([]);
  cargando = signal<boolean>(true);
  mensajeFeedback = signal<string>('');
  esError = signal<boolean>(false);

  // Cupón que se está editando actualmente en el modal
  cuponSeleccionado = signal<any | null>(null);
  mostrarModalEdicion = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    await this.cargarCupones();
  }

  async cargarCupones(): Promise<void> {
    try {
      this.cargando.set(true);
      const { data, error } = await this.couponService.obtenerCupones();
      if (error) throw error;
      this.cupones.set(data || []);
    } catch (error: any) {
      this.esError.set(true);
      this.mensajeFeedback.set('Error al cargar los cupones: ' + error.message);
    } finally {
      this.cargando.set(false);
    }
  }

  // Abrir modal de edición con los datos del cupón
  abrirModalEdicion(cupon: any): void {
    // Hacemos una copia para editar sin mutar el array directamente hasta guardar
    this.cuponSeleccionado.set({ ...cupon });
    this.mostrarModalEdicion.set(true);
  }

  cerrarModalEdicion(): void {
    this.mostrarModalEdicion.set(false);
    this.cuponSeleccionado.set(null);
  }

  // Guardar cambios del cupón editado
  async guardarCambiosCupon(): Promise<void> {
    const cupon = this.cuponSeleccionado();
    if (!cupon) return;

    try {
      const updates = {
        discount_percentage: Number(cupon.discount_percentage),
        min_age: cupon.min_age ? Number(cupon.min_age) : null,
        tipo: cupon.tipo,
        fecha_inicio: cupon.fecha_inicio || null,
        fecha_fin: cupon.fecha_fin || null,
        fecha_especifica: cupon.fecha_especifica || null
      };

      const { error } = await this.couponService.actualizarCupon(cupon.id, updates);
      if (error) throw error;

      this.mensajeFeedback.set('¡Cupón actualizado con éxito!');
      this.esError.set(false);
      this.cerrarModalEdicion();
      await this.cargarCupones();
    } catch (error: any) {
      this.mensajeFeedback.set('Error al actualizar el cupón: ' + error.message);
      this.esError.set(true);
    }
  }

  // Inhabilitar o cambiar estado activo del cupón de manera rápida
  async toggleEstadoCupon(cupon: any): Promise<void> {
    try {
      const nuevoEstado = cupon.active === false ? true : false;
      const { error } = await this.couponService.actualizarCupon(cupon.id, { active: nuevoEstado });
      
      if (error) throw error;
      
      // Refrescamos la lista local
      this.cupones.update(lista => 
        lista.map(c => c.id === cupon.id ? { ...c, active: nuevoEstado } : c)
      );
    } catch (error: any) {
      console.error('Error al cambiar el estado del cupón', error);
    }
  }

  // Eliminar cupón
  async eliminarCupon(id: string): Promise<void> {
    if (!confirm('¿Estás seguro de que deseas eliminar este cupón?')) return;

    try {
      const { error } = await this.couponService.eliminarCupon(id);
      if (error) throw error;
      
      this.cupones.update(lista => lista.filter(c => c.id !== id));
    } catch (error: any) {
      alert('No se pudo eliminar el cupón: ' + error.message);
    }
  }

  trackByCupon(index: number, cupon: any): string {
    return cupon.id;
  }
}