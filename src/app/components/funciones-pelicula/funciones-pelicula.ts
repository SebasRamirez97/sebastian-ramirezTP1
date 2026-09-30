// 1. Importar ChangeDetectorRef
import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; 
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
  peliculaId!: string;
  funciones: any[] = []; 
  cargando: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private funcionesService: FuncionesService,
    private cdr: ChangeDetectorRef // 2. Inyectar ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.peliculaId = this.route.snapshot.paramMap.get('id') || '';
    
    if (this.peliculaId) {
      this.cargarFunciones();
    }
  }

  async cargarFunciones(): Promise<void> {
    try {
      this.cargando = true;
      // Para que se vea el estado "Cargando..." si la red está lenta
      this.cdr.detectChanges(); 

      this.funciones = await this.funcionesService.getFuncionesPorPelicula(this.peliculaId);
      
      // 3. Ya llegaron los datos, le avisamos a Angular
      this.cdr.detectChanges(); 
      
    } catch (error) {
      console.error('Error al cargar las funciones desde la base de datos:', error);
    } finally {
      this.cargando = false; 
      // 4. Aseguramos que la pantalla se actualice para ocultar el mensaje de "Cargando..."
      this.cdr.detectChanges(); 
    }
  }

  volver(): void {
    this.location.back();
  }
}