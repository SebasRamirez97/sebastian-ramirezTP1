import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FuncionesService } from '../../services/funciones';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-lista-funciones',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './lista-funciones.html',
  styleUrls: ['./lista-funciones.css']
})
export class ListaFuncionesComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private funcionesService = inject(FuncionesService);

  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  funciones = signal<any[]>([]);
  cargando = signal<boolean>(true);

  ngOnInit(): void {
    this.cargarTodasLasFunciones();
  }

  async cargarTodasLasFunciones(): Promise<void> {
    try {
      this.cargando.set(true);

      // Traemos TODAS las funciones del sistema
      const data = await this.funcionesService.getFunciones();
      this.funciones.set(data || []);
    } catch (error) {
      console.error('Error al cargar la agenda de funciones:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  // 🔹 Función trackBy requerida para *ngFor
  trackByFuncion(index: number, funcion: any): string {
    return funcion.id;
  }

  async eliminar(funcion: any): Promise<void> {
    const nombrePeli = funcion.peliculas?.nombre || 'esta película';
    const confirmar = window.confirm(`¿Estás seguro de eliminar la función de ${nombrePeli}?`);
    
    if (confirmar) {
      try {
        await this.funcionesService.eliminarFuncion(funcion.id);
        
        // Actualizamos la señal filtrando localmente el elemento eliminado
        this.funciones.update(lista => lista.filter(f => f.id !== funcion.id));
        
        alert('Función eliminada correctamente.');
      } catch (error: any) {
        alert(error.message);
      }
    }
  }
}