import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EntradasService } from '../../services/entradas.services';

@Component({
  selector: 'app-verificar-orden',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verificar-orden.component.html',
  styleUrls: ['./verificar-orden.component.css']
})
export class VerificarOrdenComponent {
  // 🔹 Inyección moderna con inject()
  private entradasService = inject(EntradasService);

  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  codigoRetiro = signal<string>('');
  cargando = signal<boolean>(false);
  mensajeExito = signal<string | null>(null);
  mensajeError = signal<string | null>(null);
  ordenDetalle = signal<any>(null);

  // Métodos auxiliares para manejar ngModel con Signals de manera limpia
  actualizarCodigo(event: any): void {
    this.codigoRetiro.set(event);
  }

  async verificarOrden(): Promise<void> {
    const codigo = this.codigoRetiro();

    if (!codigo || codigo.trim() === '') {
      this.mensajeError.set('Por favor, ingrese un código de retiro.');
      return;
    }

    this.cargando.set(true);
    this.mensajeError.set(null);
    this.mensajeExito.set(null);
    this.ordenDetalle.set(null);

    try {
      const resultado = await this.entradasService.verificarYAprobarOrden(codigo);
      this.ordenDetalle.set(resultado);
      this.mensajeExito.set(`¡Orden #${resultado.codigo_retiro || codigo} aprobada exitosamente!`);
      this.codigoRetiro.set(''); 
    } catch (error: any) {
      console.error('Error capturado:', error);
      this.mensajeError.set(error.message || 'Ocurrió un error desconocido al verificar la orden.');
    } finally {
      this.cargando.set(false); 
    }
  }
}