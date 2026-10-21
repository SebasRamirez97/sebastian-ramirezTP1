import { Component, OnInit, signal, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common'; 
import { Location } from '@angular/common';
import { FuncionesService } from '../../services/funciones'; 

@Component({
  selector: 'app-funciones-pelicula',
  standalone: true,
  imports: [RouterLink, CommonModule], 
  templateUrl: './funciones-pelicula.html',
  styleUrls: ['./funciones-pelicula.css']
})
export class FuncionesPeliculaComponent implements OnInit {
  // 🔹 Inyección moderna con inject()
  private route = inject(ActivatedRoute);
  private location = inject(Location);
  private funcionesService = inject(FuncionesService);

  // 🔹 Definición de estados con Signals (adiós a ChangeDetectorRef)
  peliculaId = signal<string>('');
  funciones = signal<any[]>([]); 
  cargando = signal<boolean>(true);

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.peliculaId.set(id);
    
    if (this.peliculaId()) {
      await this.cargarFunciones();
    }
  }

  async cargarFunciones(): Promise<void> {
    try {
      this.cargando.set(true);
      const data = await this.funcionesService.getFuncionesPorPelicula(this.peliculaId());
      this.funciones.set(data || []);
    } catch (error) {
      console.error('Error al cargar las funciones desde la base de datos:', error);
    } finally {
      this.cargando.set(false); 
    }
  }

  // 🔹 Función trackBy para *ngFor de funciones
  trackByFuncion(index: number, funcion: any): string {
    return funcion.id;
  }

  volver(): void {
    this.location.back();  
  }
}