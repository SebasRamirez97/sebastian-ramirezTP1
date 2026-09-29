import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PeliculasService } from '../../services/peliculas';
import { Pelicula } from '../../models/pelicula.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  topPeliculas: Pelicula[] = [];
  cargando: boolean = true;

  constructor(
    private peliculasService: PeliculasService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  async ngOnInit() {
    try {
      this.topPeliculas = await this.peliculasService.getTopPeliculas(3);
    } catch (error) {
      console.error('Error al cargar top películas:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges(); // Fuerza la actualización en pantalla
    }
  }

  verDetalle(id?: string) {
    if (id) {
      this.router.navigate(['/peliculas', id]);
    }
  }

  verCarteleraCompleta() {
    this.router.navigate(['/cartelera']);
  }
}