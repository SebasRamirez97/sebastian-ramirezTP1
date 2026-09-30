import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  funciones: any[] = [];
  cargando: boolean = true;

  constructor(
    private funcionesService: FuncionesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarTodasLasFunciones();
  }

  async cargarTodasLasFunciones(): Promise<void> {
    try {
      this.cargando = true;
      this.cdr.detectChanges(); // Mostramos el loading

      // Traemos TODAS las funciones del sistema
      this.funciones = await this.funcionesService.getFunciones();
      
      this.cdr.detectChanges(); // Actualizamos la vista con los datos
    } catch (error) {
      console.error('Error al cargar la agenda de funciones:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // Ocultamos el loading
    }
  }

  async eliminar(funcion: any): Promise<void> {
    const nombrePeli = funcion.peliculas?.nombre || 'esta película';
    const confirmar = window.confirm(`¿Estás seguro de eliminar la función de ${nombrePeli}?`);
    
    if (confirmar) {
      try {
        await this.funcionesService.eliminarFuncion(funcion.id);
        
        // Filtramos la lista localmente para que desaparezca de la tabla al instante sin recargar la página
        this.funciones = this.funciones.filter(f => f.id !== funcion.id);
        this.cdr.detectChanges();
        
        alert('Función eliminada correctamente.');
      } catch (error: any) {
        alert(error.message);
      }
    }
  }
}