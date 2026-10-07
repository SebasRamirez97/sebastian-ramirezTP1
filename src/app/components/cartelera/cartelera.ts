import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; // 👈 1. Importa ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-cartelera',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cartelera.html',
  styleUrls: ['./cartelera.css']
})
export class CarteleraComponent implements OnInit {
  peliculas: Pelicula[] = [];
  cargando: boolean = true;

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef // 👈 2. Inyéctalo aquí
  ) {}

  async ngOnInit() {
 
    try {
      this.peliculas = await this.peliculasService.getPeliculas();
     
    } catch (error) {
      
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // 👈 3. Fuerza a Angular a actualizar el HTML
    }
  }

  verDetalle(id?: string) {
    if (id) {
      this.router.navigate(['/peliculas', id]);
    }
  }
}