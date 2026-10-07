import { Component, ChangeDetectorRef } from '@angular/core'; // 👈 1. Importa ChangeDetectorRef
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
  codigoRetiro: string = '';
  cargando: boolean = false;
  mensajeExito: string | null = null;
  mensajeError: string | null = null;
  ordenDetalle: any = null;

  // 👈 2. Inyecta ChangeDetectorRef en el constructor
  constructor(
    private entradasService: EntradasService,
    private cdr: ChangeDetectorRef 
  ) {}

  async verificarOrden() {
    if (!this.codigoRetiro || this.codigoRetiro.trim() === '') {
      this.mensajeError = 'Por favor, ingrese un código de retiro.';
      return;
    }

    this.cargando = true;
    this.mensajeError = null;
    this.mensajeExito = null;
    this.ordenDetalle = null;
    this.cdr.detectChanges(); // 👈 Forzamos la actualización visual para mostrar "Verificando..."

    try {
      const resultado = await this.entradasService.verificarYAprobarOrden(this.codigoRetiro);
      this.ordenDetalle = resultado;
      this.mensajeExito = `¡Orden #${resultado.codigo_retiro || this.codigoRetiro} aprobada exitosamente!`;
      this.codigoRetiro = ''; 
    } catch (error: any) {
      console.error('Error capturado:', error);
      this.mensajeError = error.message || 'Ocurrió un error desconocido al verificar la orden.';
    } finally {
      this.cargando = false; 
      this.cdr.detectChanges(); // 👈 3. Forzamos a Angular a refrescar la vista para quitar el estado de carga y pintar el éxito/error
    }
  }
}